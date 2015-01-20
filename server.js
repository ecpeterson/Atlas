
//
// server.js
//
// toplevel executable
//

// SET UP =====================================================================
var express = require('express'),
    app = express(),
    port = process.env.PORT || 8080,
    mongoose = require('mongoose'),
    passport = require('passport'),
    flash = require('connect-flash');

var morgan = require('morgan'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    session = require('express-session');

var configDB = require('./config/database.js');

// CONFIGURATION ==============================================================

// connect to the database
mongoose.connect(configDB.url);

// pass the passport object in for configuration
require('./config/passport')(passport);

app.use(morgan('dev'));  // log a lot
app.use(cookieParser()); // used for auth
app.use(bodyParser());   // used to read info from forms
app.set('view engine', 'ejs'); // templating engine

// secret used by passport
app.use(session({
	secret : 'temporarysecretpleasechangeme'
}));
app.use(passport.initialize());
app.use(passport.session()); // this gives persistent login sessions
app.use(flash()); // "use connect-flash for flash messages stored in session"

// ROUTES =====================================================================

// this loads our routes. passes in the app and the fully configured passport
require('./app/routes.js')(app, passport);

// LAUNCH =====================================================================

app.listen(port);
console.log('Now listening on port ' + port + '.');
