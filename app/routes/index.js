
// app/routes/index.js

path = require('path');

module.exports = function(app) {
	// HOME PAGE ===============================================================
	// loads the index.ejs file
	app.get('/', app.isLoggedIn, function(req, res) {
		res.render('index.ejs');
	});

	// SHARE MARKDOWN.JS =======================================================
    app.get('/javascript/markdown.js', function(req, res) {
       	res.sendFile(path.resolve('node_modules/markdown/lib/markdown.js'));
    });
};
