
// app/routes/bulb-manip.js

var Bulb = require('../models/bulb.js');

module.exports = function(app) {
	// REQUEST INDIVIDUAL BULB DATA ============================================
	app.get('/bulb/:id', app.isLoggedIn, function(req, res) {
		Bulb.findOne({ _id : req.params.id }, function(err, bulb) {
			// check for errors
			if (err)
				res.send({ msg : err });

			res.send(bulb);
		});
	});

	// DELETE INDIVIDUAL BULB ==================================================
	app.delete('/bulb/:id', app.isLoggedIn, function(req, res) {
		Bulb.remove({ _id : req.params.id }, function (err) {
			res.send({ msg : err });
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
			// return the array of bulbs
			res.json(bulbs);
		});
	});

	// CONSTRUCT NEW BULB ======================================================
	app.post('/newbulb', app.isLoggedIn, function(req, res) {
		var bulb = new Bulb();

		// populate the bulb with some default information
		bulb.ownerId = req.user._id;
		bulb.type = Bulb.types.STANDARD;
		bulb.title = "Default Title";

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
