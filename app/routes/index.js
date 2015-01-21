
// app/routes/index.js

module.exports = function(app) {
	// HOME PAGE ===============================================================
	// loads the index.ejs file
	app.get('/', app.isLoggedIn, function(req, res) {
		res.render('index.ejs');
	});
};
