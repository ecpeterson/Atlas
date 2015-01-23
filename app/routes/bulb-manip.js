
// app/routes/bulb-manip.js

var Bulb = require('../models/bulb.js');

module.exports = function(app) {
	// REQUEST INDIVIDUAL BULB DATA ============================================
	app.get('/bulb/:id', app.isLoggedIn, function(req, res) {
		Bulb.findOne({ _id : req.params.id }, function(err, bulb) {
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

	// DELETE INDIVIDUAL BULB ==================================================
	app.delete('/bulb/:id', app.isLoggedIn, function(req, res) {
		Bulb.findOne({ _id : req.params.id }, function(err, bulb) {
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
		Bulb.findOne({ _id : req.params.id }, function(err, bulb) {
			if (err)
				res.send({ msg : err });

			if (!(bulb.hasWriteAccess(req.user._id))) {
				res.send({ msg : 'Access forbidden.' });
				return;
			}

			var newBulb = req.body;

			// copy over the non-internal bulb attributes and save the new bulb
			bulb.title = newBulb.title;
			bulb.text = newBulb.text;
			bulb.resolved = newBulb.resolved;
			bulb.modificationTime = new Date();

			// the list of outgoing references needs to be validated.
			// TODO: is this too abusive of the database? can we 'map' all the
			// id strings to bulbs in one go?
			var validatedOutgoingNodes = newBulb.outgoingNodes.filter(
				function(element) {
					Bulb.findOne({ _id : element }, function(err, bulb) {
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
				});
			bulb.outgoingNodes = validatedOutgoingNodes;

			// TODO: the node's parents also need to be validated
			bulb.parents = newBulb.parents;

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
};
