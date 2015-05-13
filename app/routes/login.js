
// app/routes/login.js

var User = require('../models/user.js');

module.exports = function(app, passport, transporter) {
	// LOGIN ===================================================================
	// show the login form
	app.get('/login', function(req, res) {
		res.render('login.ejs', {
			message : req.flash('loginMessage')
		});
	});

	// process the login form
	app.post('/login', passport.authenticate('local-login', {
		successRedirect : '/',
		failureRedirect : '/login',
		failureFlash : true
	}));

	// PASSWORD RESET ==========================================================
	app.get('/recover', function(req, res) {
		res.render('recover.ejs', {
			message: req.flash('recoverMessage')
		});
	});

	app.post('/recover', function(req, res) {
		User.findOne({ 'local.email' : req.body.email }, function(err, user) {
			if (err) {
				res.send({ msg : err });
				return;
			}

			var newPassword = '' + Math.round((Math.random()+1)*10000000);

			// send the target user an email saying his password has been reset
			var mailOptions = {
				from: 'Atlas',
				to: user.local.email,
				subject: 'Your password has been reset',
				text: 'Your password has been reset to ' + newPassword + '.'
			};

			transporter.sendMail(mailOptions, function(error, info) {
				if (error) {
					console.log(error);
				} else {
					// the email was sent, so the user will be aware of their
					// new password, which is now...
					user.local.password = user.generateHash(newPassword);
					user.save();
				}

				// in any case, send the requester home.
				res.redirect('/');
			});
		});
	});

	// SIGNUP ==================================================================
	// show the signup form
	app.get('/signup', function(req, res) {
		res.render('signup.ejs', {
			message : req.flash('signupMessage')
		});
	});

	// process the signup form
	//
	// you may be interested in
	//     http://stackoverflow.com/questions/15711127/express-passport-node-js-error-handling
	// which describes more complicated things you can do with callbacks rather
	// than with redirects.
	app.post('/signup', passport.authenticate('local-signup', {
		successRedirect : '/',
		failureRedirect : '/signup',
		failureFlash : true
	}));

	// LOGOUT ==================================================================
	app.get('/logout', function(req, res) {
		req.logout();
		res.redirect('/');
	});

	// PROFILE PAGE ============================================================
	app.get('/profile', app.isLoggedIn, function(req, res) {
		res.render('profile.ejs', {
			user : req.user // pass the user out of the session to the template
		});
		// NOTE: because this only sends the user object to the template, the
		// client never actually sees it and so no sensitive information is
		// revealed unless the template *chooses* to display it.
	});

	// UPDATE USER INFO ========================================================
	app.post('/profile', app.isLoggedIn, function(req, res) {
		// get the User object corresponding to the logged in user
		User.findOne({ _id : req.user._id }, function (err, thisUser) {
			if (err) {
				res.send({ msg : err });
				return;
			}

			// check that old password hashes to the right thing
			if (!thisUser.validPassword(req.body.oldpassword)) {
				res.send({ msg : 'Incorrect old password.' });
				return;
			}

			// read in updates from all the info fields. if blank, skip.
			if (req.body.fullname) {
				thisUser.local.fullname = req.body.fullname;
			}

			if (req.body.email) {
				thisUser.local.email = req.body.email;
			}

			if (req.body.newpassword &&
				(req.body.newpassword == req.body.newpassword2)) {
				thisUser.local.password =
					thisUser.generateHash(req.body.newpassword);
			}

			// save the user's changes
			thisUser.save(function(err) {
				if (err) {
					res.send({ msg : err });
				}
			});

			// pass control back to the profile display route
			res.redirect('/profile');
		});
	});

	// REQUEST INDIVIDUAL USER DATA ============================================
	app.get('/user/:id', app.isLoggedIn, function(req, res) {
		User.findOne({ _id : req.params.id }, function(err, user) {
			// check for errors
			if (err)
				res.send({ msg : err });

			res.send({ name : user.local.fullname,
					   email : user.local.email });
		});
	});
};
