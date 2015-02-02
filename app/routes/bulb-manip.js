
// app/routes/bulb-manip.js

var Bulb = require('../models/bulb.js');

module.exports = function(app) {
	// REQUEST INDIVIDUAL BULB DATA ============================================
	app.get('/bulb/:id', app.isLoggedIn, function(req, res) {
		Bulb.findById(req.params.id, function(err, bulb) {
			// check for errors
			if (err)
				res.send({ msg : err });

			if (!(bulb.hasReadAccess(req.user._id))) {
				res.send({ msg : 'Access forbidden.' });
				return;
			}

			bulb.text = '';

			res.send(bulb);
		});
	});

	// REQUEST INDIVIDUAL BULB WITH TEXT =======================================
	app.get('/bulb/:id/text', app.isLoggedIn, function(req, res) {
		Bulb.findById(req.params.id, function(err, bulb) {
			// check for errors
			if (err)
				res.send({ msg : err });

			if (!(bulb.hasReadAccess(req.user._id))) {
				res.send({ msg : 'Access forbidden.' });
				return;
			}

			res.send(bulb);
		});
	});

	// REQUEST INDIVIDUAL BULB'S CONTAINING WORKSPACE ==========================

	app.get('/bulb/:id/workspace', app.isLoggedIn, function(req, res) {
		Bulb.findById(req.params.id, function(err, bulb) {
			if (err) {
				res.send({ msg : err });
				return;
			}

			res.send(bulb.findParentWorkspace(req.user._id));
			return;
		});
	});

	// REQUEST CONTAINER BULB'S IMMEDIATE CHILDREN =============================

	app.get('/bulb/:id/children', app.isLoggedIn, function(req, res) {
		Bulb.findById(req.params.id, function(err, bulb) {
			if (err) {
				res.send({ msg : err });
				return;
			}

			if (!bulb.hasReadAccess(req.user._id)) {
				res.send({ msg : 'Bad read access to ' + req.params.id + '.'});
				return;
			}

			bulb.find({ parentContainer : req.params.id }, function(err, bulbs) {
				if (err) {
					res.send({ msg : err });
					return;
				}

				res.send(bulbs);
				return;
			});
		});
	});

	// DELETE INDIVIDUAL BULB ==================================================
	app.delete('/bulb/:id', app.isLoggedIn, function(req, res) {
		Bulb.findById(req.params.id, function(err, bulb) {
			// check for errors
			if (err)
				res.send({ msg : err });

			if (!(bulb.hasWriteAccess(req.user._id))) {
				res.send({ msg : 'Access forbidden.' });
				return;
			}

			Bulb.remove({ _id : req.params.id }, function (err) {
				res.send({ msg : err });
			});
		});
	});

	// UPDATE INDIVIDUAL BULB ==================================================
	app.put('/bulb/:id', app.isLoggedIn, function(req, res) {
		Bulb.findById(req.params.id, function(err, bulb) {
			if (err)
				res.send({ msg : err });

			if (!(bulb.hasWriteAccess(req.user._id))) {
				res.send({ msg : 'Access forbidden.' });
				return;
			}

			var newBulb = req.body;

			// copy over the non-internal bulb attributes and save the new bulb
			bulb.title = newBulb.title;
			if (newBulb.text)
				bulb.text = newBulb.text;
			bulb.resolved = newBulb.resolved;
			bulb.modificationTime = new Date();

			// the list of outgoing references needs to be validated.
			// TODO: is this too abusive of the database? can we 'map' all the
			// id strings to bulbs in one go?
			if (newBulb.outgoingNodes) {
				var validatedOutgoingNodes = newBulb.outgoingNodes.filter(
					function(element) {
						var ret;
						ret = Bulb.findOne({ _id : element }, function(err, bulb) {
							if (err) {
								// is this too lazy? if we, like, fail to connect
								// to the database, we don't want to just delete
								// all of the node's references... do we?
								return false;
							}
							else {
								return bulb.hasReadAccess(req.user._id);
							}
						});

						return ret;
					});
				bulb.outgoingNodes = validatedOutgoingNodes;
			} else {
				bulb.outgoingNodes = [];
			}

			// TODO: the node's parents also need to be validated
			bulb.parentContainer = newBulb.parentContainer;
			bulb.parentWorkspace = newBulb.parentWorkspace;
			bulb.parentOriginal = newBulb.parentOriginal;

			bulb.save(function(err) {
				if (err)
					res.send({ msg : err });

				res.json(bulb);
			});
		});
	});

	// REQUEST BULBS VISIBLE TO USER ===========================================
	app.get('/visiblebulbs', app.isLoggedIn, function(req, res) {
		// there are three kinds of nodes visible to the user:
		// 1) nodes they actually own,
		// 2) workspace nodes which their names are attached to,
		// 3) nodes inside of workspace nodes which their names are attached to.
		// 
		// for now, i'm just going to return a list of nodes they actually own.
		Bulb.find({ ownerId : req.user._id }, function(err, bulbs) {
			// check for errors
			if (err) {
				res.send({ msg : err });
				return;
			}

			// strip out the text from the bulbs. 'forEach' works over 'map'
			// here because bulbs are *persistent objects* with mutable fields.
			bulbs.forEach(function (bulb) {
				bulb.text = '';
			});

			// return the array of bulbs
			res.send(bulbs);
		});
	});

	// CONSTRUCT NEW STANDARD BULB =============================================
	app.post('/newbulb', app.isLoggedIn, function(req, res) {
		var bulb = new Bulb();
		bulb.ownerId = req.user._id; // take immediate ownership of the new bulb

		// write the bulb to the database
		bulb.save(function(err) {
			// if there's an error, deal with it.
			if (err)
				res.send({ msg : err });

			// otherwise...
			res.json(bulb);
		});
	});

	// GET MINIMAL BULB DATA FROM LIST OF BULBS ================================
	app.post('/graphdata', app.isLoggedIn, function(req, res) {
		var resultList = [];

		// if there's no id list to iterate through...
		if (!req.body.ids) {
			// then bail.
			res.send([]);
			return;
		}

		req.body.ids.forEach(function (bulbId) {
			Bulb.findById(bulbId, function(err, bulb) {
				// check for errors: can't find the bulb or can't read it
				if (err) {
					resultList.push({ _id : bulbId,
									  title : 'Database query failed with error'
									          + err + '.',
									  outgoingNodes : [] });
					return;
				}

				if (!(bulb.hasWriteAccess(req.user._id))) {
					resultList.push({ _id : bulbId,
									  title : 'Read access forbidden.',
									  outgoingNodes : [] });
					return;
				}

				// if we made it here, we can read the bulb. build a truncated
				// bulb object from it & push to the result list
				resultList.push({ _id: bulbId,
								  title: bulb.title,
								  outgoingNodes : bulb.outgoingNodes });
				return;
			});
		});

		// return all the titles we were asked for.
		res.send(resultList);
	});
};
