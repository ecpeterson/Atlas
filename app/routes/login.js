
// app/routes/login.js

module.exports = function(app, passport) {
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

	// PROFILE PAGE ============================================================
	// we will want this to be protected, so that you have to be logged in to
	// visit it. we will use route middleware to verify this: isLoggedIn.
	app.get('/profile', app.isLoggedIn, function(req, res) {
		res.render('profile.ejs', {
			user : req.user // pass the user out of the session to the template
		});
	});

	// LOGOUT ==================================================================
	app.get('/logout', function(req, res) {
		req.logout();
		res.redirect('/');
	});
};
