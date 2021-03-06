
// app/routes/bulb-manip.js

var Bulb = require('../models/bulb.js');
var User = require('../models/user.js');
var Exporter = require('../misc/exporter.js');

module.exports = function(app) {
	// REQUEST INDIVIDUAL BULB DATA ============================================
	app.get('/bulb/:id', app.isLoggedIn, function(req, res) {
		Bulb.findById(req.params.id, function(err, bulb) {
			// check for errors
			if (err || !bulb) {
				res.send({ msg : err });
				return;
			}

			bulb.hasReadAccess(req.user._id, function (ans) {
				if (!ans) {
					res.send({ msg : 'Access forbidden.' });
					return;
				}

				bulb.augmentForExport(function (obj) {
					obj.text = '';
					res.send(obj);
				});
			});
		});
	});

	// REQUEST INDIVIDUAL BULB WITH TEXT =======================================
	app.get('/bulb/:id/text', app.isLoggedIn, function(req, res) {
		Bulb.findById(req.params.id, function(err, bulb) {
			// check for errors
			if (err || !bulb) {
				res.send({ msg : err });
				return;
			}

			bulb.hasReadAccess(req.user._id, function (ans) {
				if (!ans) {
					res.send({ msg : 'Access forbidden.' });
					return;
				}

				res.send(bulb);
			});
		});
	});

	// REQUEST INDIVIDUAL BULB'S PATH ==========================================

	app.get('/bulb/:id/path', app.isLoggedIn, function(req, res) {
		Bulb.findById(req.params.id, function(err, bulb) {
			if (err || !bulb) {
				res.send({ msg : err });
				return;
			}

			// TODO: in fact, for security reasons we might want to run findPath
			// and then test for read access on each node that's returned.  this
			// can be exploited to reveal a little bit about the topology of
			// someone else's node collection, but no data about the nodes
			// themselves.
			bulb.hasReadAccess(req.user._id, function (ans) {
				if (!ans) {
					res.send({ msg : 'Access forbidden.' });
					return;
				}

				bulb.findPath(function (result) {
					res.send(result);
				});
			});
		});
	});

	// REQUEST CONTAINER BULB'S IMMEDIATE CHILDREN =============================

	app.get('/bulb/:id/children', app.isLoggedIn, function(req, res) {
		Bulb.findById(req.params.id, function(err, bulb) {
			if (err || !bulb) {
				res.send({ msg : err });
				return;
			}

			bulb.hasReadAccess(req.user._id, function (ans) {
				if (!ans) {
					res.send({ msg : 'Bad read access to ' + req.params.id +
						'.'});
					return;
				}

				Bulb.find({ parentContainer : req.params.id },
						function(err, bulbs) {
					if (err || !bulbs) {
						res.send({ msg : err });
						return;
					}

					// we've collected the bulbs, now we need to provide their
					// workspace attributes

					function aux (inbox, outbox) {
						if (inbox.length == 0) {
							res.send(outbox);
							return;
						}

						var bulb = inbox.pop();
						bulb.augmentForExport(function (obj) {
							outbox.push(obj);
							return aux(inbox, outbox);
						});
					};

					aux(bulbs, []);
					return;
				});
			});
		});
	});

	// DELETE INDIVIDUAL BULB ==================================================
	app.delete('/bulb/:id', app.isLoggedIn, function(req, res) {
		Bulb.findById(req.params.id, function(err, bulb) {
			// check for errors
			if (err || !bulb) {
				res.send({ msg : err });
				return;
			}

			bulb.hasWriteAccess(req.user._id, function (ans) {
				if (!ans) {
					res.send({ msg : 'Access forbidden.' });
					return;
				}

				// if this node had children, they all need to be moved into the
				// parent container. do this in parallel with the deletion.
				var parentContainer = bulb.parentContainer,
					parentWorkspace = bulb.parentWorkspace;
				Bulb.find({ parentContainer : req.params.id },
						function(err, bulbs) {
					if (err || !bulbs) {
						return;
					}

					return bulbs.forEach(function (b) {
						// set their parent container to our old container
						if (parentContainer) {
							b.parentContainer = parentContainer;
							return b.save();
						} else if (parentWorkspace && !b.parentWorkspace) {
							b.parentWorkspace = parentWorkspace;
							return b.save();
						} else
							return;
					});
				});

				// if this node received any pointers, remove them
				Bulb.find({ outgoingNodes : bulb._id }, function(err, bulbs) {
					if (err || !bulbs)
						return;

					return bulbs.forEach(function (b) {
						b.outgoingNodes = b.outgoingNodes.filter(function (n) {
							return n != req.params.id;
						});
						return b.save();
					});
				});

				// actually delete the bulb we were supposed to delete.
				Bulb.remove({ _id : req.params.id }, function (err) {
					return res.send({ msg : err });
				});
			});
		});
	});

	// UPDATE INDIVIDUAL BULB ==================================================
	app.put('/bulb/:id', app.isLoggedIn, function(req, res) {
		Bulb.findById(req.params.id, function(err, bulb) {
			if (err || !bulb) {
				res.send({ msg : err });
				return;
			}

			bulb.hasWriteAccess(req.user._id, function (ans) {
				if (!ans) {
					res.send({ msg : 'Access forbidden.' });
					return;
				}

				var newBulb = req.body;

				if (Date(bulb.modificationTime) >
							Date(newBulb.modificationTime)) {
					res.send({ msg : 'Bulb has changed since load.' });
					return;
				}

				// copy over the non-internal bulb attributes and save the new
				// bulb. refuse to overwrite the data in a node we replicated.
				if (!bulb.parentOriginal) {
					bulb.title = newBulb.title;
					if (newBulb.text)
						bulb.text = newBulb.text;
					bulb.resolved = newBulb.resolved;
					bulb.modificationTime = new Date();
					bulb.preamble = newBulb.preamble;
				}

				// XXX: this ought to be validated.
				bulb.outgoingNodes = newBulb.outgoingNodes;

				// TODO: the node's parents also need to be validated
				bulb.parentContainer = newBulb.parentContainer;
				bulb.parentWorkspace = newBulb.parentWorkspace;
				bulb.parentOriginal = newBulb.parentOriginal;

				// new user shares now need to be integrated.

				function aux(inbox, outbox) {
					// if we're out of work, then write the bulb out.
					if (inbox.length == 0) {
						bulb.shares = outbox;

						return bulb.save(function(err) {
							if (err)
								return res.send({ msg : err });

							return res.json(bulb);
						});
					}

					// if we're not out of work, then work.
					var userEmail = inbox[0];
					inbox = inbox.slice(1);
					return User.findOne(
						{ 'local.email' : userEmail },
						function(err, user) {
							if (err || !user) {
								return aux(inbox, outbox);
							}

							outbox.push(user._id);
							return aux(inbox, outbox);
						});
				}

				return aux(newBulb.newShares ? newBulb.newShares : [],
						   newBulb.shares ? newBulb.shares : []);
			});
		});
	});

	// CONSTRUCT NEW STANDARD BULB =============================================
	app.post('/newbulb', app.isLoggedIn, function(req, res) {
		var bulb = new Bulb();
		bulb.ownerId = req.user._id; // take immediate ownership of the new bulb

		// write the bulb to the database
		bulb.save(function(err) {
			// if there's an error, deal with it.
			if (err) {
				res.send({ msg : err });
				return;
			}

			// otherwise...
			return bulb.augmentForExport(function (b) {
				res.json(b);
			});
		});
	});

	// GET MINIMAL BULB DATA FROM LIST OF BULBS ================================
	app.post('/graphdata', app.isLoggedIn, function(req, res) {
		var aux = function (bulbList, resultList) {
			// if we're at the end of the list, then finish the task.
			if (bulbList.length == 0) {
				return res.send(resultList);
			}

			// otherwise, the list has some element in it.
			var bulbId = bulbList.pop();
			Bulb.findById(bulbId, function (err, bulb) {
				// check for errors: can't find the bulb or can't read it
				if (err || !bulb) {
					resultList.push({ _id : bulbId,
									  title : 'Query failed with error '
									          + err + '.',
									  outgoingNodes : [] });
					return aux(bulbList, resultList);
				}

				bulb.hasReadAccess(req.user._id, function (ans) {
					if (!ans) {
						// resultList.push({ _id : bulbId,
						// 	title : 'Read access forbidden.',
						// 	outgoingNodes : []});
						//
						// we actually don't have access to this node, so skip.
						return aux(bulbList, resultList);
					}

					// if we made it here, we can read the bulb. build a
					// truncated bulb object from it & push to the result list

					bulb.augmentForExport(function (obj) {
						resultList.push({ _id : obj._id,
										  title : obj.title,
										  outgoingNodes : obj.outgoingNodes,
										  pathData : obj.pathData });
						return aux(bulbList, resultList);
					});
				});
			});
		}

		aux(req.body.ids ? req.body.ids : [], []);
	});

	// MAKES A COPY OF A NONCOLLABORATIVELY SHARED NODE ========================
	app.post('/bulb/:id/copy', app.isLoggedIn, function(req, res) {
		Bulb.findById(req.params.id, function (err, bulb) {
			if (err || !bulb) {
				res.send({ msg : err });
				return;
			}

			if (bulb.shares.indexOf(req.user._id) == -1) {
				res.send({ msg : 'Access forbidden.' });
				return;
			}

			// create a duplicate of this node for our own collection.
			var dupBulb = new Bulb();
			dupBulb.ownerId = req.user._id;
			dupBulb.title = bulb.title;
			dupBulb.resolved = bulb.resolved;
			dupBulb.text = bulb.text;
			dupBulb.modificationTime = bulb.modificationTime;
			dupBulb.parentOriginal = req.params.id;
			// deliberately don't copy over members that have to do with the
			// topology of the original owner's graph.

			// save and throw back to caller
			dupBulb.save(function (err) {
				if (err) {
					res.send({ msg : err });
					return;
				}

				res.json(dupBulb);
			});
		});
	});

	// SYNCHRONIZES A REPLICATED BULB WITH THE ORIGINAL ========================
	app.post('/bulb/:id/sync', app.isLoggedIn, function(req, res) {
		Bulb.findById(req.params.id, function (err, dupBulb) {
			if (err || !dupBulb) {
				res.send({ msg : err });
				return;
			}

			dupBulb.hasWriteAccess(req.user._id, function (ans) {
				if (!ans) {
					res.send({ msg : 'Write access forbidden.' });
					return;
				}

				if (!dupBulb.parentOriginal) {
					res.send({ msg : 'Invalid operation: no parent.' });
					return;
				}

				Bulb.findById(dupBulb.parentOriginal, function(err, bulb) {
					if (err || !bulb) {
						res.send({ msg : err });
						return;
					}

					if (!bulb.shares ||
						bulb.shares.indexOf(req.user._id) == -1) {
						res.send({ msg : 'Read access forbidden.' });
						return;
					}

					// OK, we have access to everything, so perform a sync.
					dupBulb.title = bulb.title;
					dupBulb.resolved = bulb.resolved;
					dupBulb.text = bulb.text;
					dupBulb.modificationTime = bulb.modificationTime;

					// save and throw back to caller
					dupBulb.save(function (err) {
						if (err) {
							res.send({ msg : err });
							return;
						}

						res.json(dupBulb);
					});
				});
			});
		});
	});

	// BOUNCES TO THE DATA OF THE ORIGINAL OWNER OF THE NODE ===================
	app.get('/bulb/:id/originalowner', app.isLoggedIn, function(req, res) {
		Bulb.findById(req.params.id, function (err, bulb) {
			if (err || !bulb) {
				res.send({ msg : err });
				return;
			}

			if (bulb.parentOriginal) {
				res.redirect('/user/' + bulb.parentOriginal);
				return;
			} else {
				res.redirect('/user/' + bulb.ownerId);
				return;
			}
		})
	});

	// SEARCHES FOR NODES CONTAINING A FIXED SUBSTRING =========================
	app.post('/search', app.isLoggedIn, function(req, res) {
		Bulb.find(
			{
				title: new RegExp(req.body.str, "i")
			}, function(err1, titleDocs) {
			return Bulb.find(
				{
					text: new RegExp(req.body.str, "i")
				}, function(err2, bodyDocs) {
					var docs = [];
					if (!err1 && titleDocs)
						docs = docs.concat(titleDocs);
					if (!err2 && bodyDocs)
						docs = docs.concat(bodyDocs);

					function aux(inbox, outbox) {
						if (inbox.length == 0 ||
							outbox.length >= 20) {
							return res.send(outbox);
						}

						var bulb = inbox[0];
						inbox = inbox.slice(1);

						return bulb.hasReadAccess(req.user._id, function (ans) {
							if (!ans)
								return aux(inbox, outbox);

							bulb.augmentForExport(function (b) {
								outbox.push(b);
								return aux(inbox, outbox);
							});
						});
					}

					return aux(docs, []);
				});
		});
	});

	// RETURN A TEX DOCUMENT OF THIS NODE & CHILDREN ===========================
	app.get('/bulb/:id/export', app.isLoggedIn, function(req, res) {
		// in order to start the loop, dereference the URL id to a bulb document
		return Bulb.findById(req.params.id, function (err, startBulb) {
			// if we can't find it, we should just bail.
			if (err || !startBulb) {
				res.send({ msg : err });
				return;
			}

			// otherwise, we have a bulb, so start the loop.
			Exporter.run(req.user._id, [startBulb], "", function (output) {
				return res.send(output);
			});
		});
	});
};
