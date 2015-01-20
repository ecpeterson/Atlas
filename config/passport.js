
// config/passport.js

var LocalStrategy = require('passport-local').Strategy;

var User = require('../app/models/user');

module.exports = function(passport) {
	// PASSPORT SESSION SETUP =================================================
	// this is required for persistent login sessions. passport needs to be
	// able to de/serialize users out of session.

	// used to serialize user for the session
	passport.serializeUser(function(user, done) {
		done(null, user.id);
	});

	// used to deserialize the user
	passport.deserializeUser(function(id, done) {
		User.findById(id, function(err, user) {
			done(err, user);
		});
	});

	// LOCAL SIGNUP ===========================================================
	passport.use('local-signup', new LocalStrategy({
			// by default, 'usernameField' is set to 'username'. we're
			// overriding this to be 'email' instead.
			usernameField : 'email',
			passwordField : 'password',
			passReqToCallback : true
		},
		function(req, email, password, done) {
			// asynchronous.
			// User.findOne won't fire unless data is sent back
			process.nextTick(function() {
				// check to see if the user trying to log in already exists.
				User.findOne({ 'local.email' : email }, function(err, user) {
					// if there's an error, just bail.
					if (err)
						return done(err);

					// if we did find such a user, refuse to create a new one.
					if (user) {
						return done(null, false, req.flash('signupMessage',
							'That email is already taken.'));
					} else {
						// there's no such user, so agree to make a new one.
						var newUser = new User();
						newUser.local.email = email;
						newUser.local.password = newUser.generateHash(password);

						newUser.save(function(err) {
							if (err)
								throw err;
							return done(null, newUser);
						});
					}
				});
			});
		})
	);

	// LOCAL LOGIN ============================================================
	// we are using named strategies since we have one for login and one for
	// sign-up. by default, if there was no name, it would be called 'local'.

	passport.use('local-login', new LocalStrategy({
			usernameField : 'email',
			passwordField : 'password',
			passReqToCallback : true
		},
		function(req, email, password, done) {
			User.findOne({ 'local.email' : email }, function(err, user) {
				// if there's an error, bail.
				if (err)
					return done(err);

				// if there's no such user, bail.
				if (!user)
					return done(null, false, req.flash('loginMessage',
						'No user found.'));

				// if the password is wrong, bail.
				if (!user.validPassword(password))
					return done(null, false, req.flash('loginMessage',
						'Oops! Wrong password.'));

				return done(null, user);
			});
		})
	);
};
