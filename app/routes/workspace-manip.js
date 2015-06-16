
// app/routes/workspace-manip.js

var Workspace = require('../models/workspace.js');
var Bulb = require('../models/bulb.js');

module.exports = function(app) {
	// USER INTERFACE TO WORKSPACES ============================================
	app.get('/workspace', app.isLoggedIn, function(req, res) {
		res.render('workspace.ejs');
	});

	// REQUEST LIST OF TOPLEVEL WORKSPACE CHILD NODES ==========================
	app.get('/workspace/:id/children', app.isLoggedIn, function(req, res) {
		Workspace.findById(req.params.id, function (err, workspace) {
			if (err || !workspace) {
				res.send({ msg : err });
				return;
			}

			if (!workspace.hasAccess(req.user._id)) {
				res.send({ msg : 'Bad access to workspace ' + req.params.id });
				return;
			}

			Bulb.find({ parentWorkspace: workspace._id }, function(err, bulbs) {
				if (err) {
					res.send({ msg : err });
					return;
				}

				function aux (inbox, outbox) {
					if (inbox.length == 0) {
						res.send(outbox);
						return;
					}

					var bulb = inbox.pop();
					bulb.findPath(function (path) {
						var b = bulb.toObject();
						b.pathData = path;
						outbox.push(b);
						aux(inbox, outbox);
					});
				};

				aux(bulbs, []);
			});
		});
	});

	// REQUEST INDIVIDUAL WORKSPACE DATA =======================================
	app.get('/workspace/:id', app.isLoggedIn, function(req, res) {
		Workspace.findById(req.params.id, function (err, workspace) {
			if (err || !workspace) {
				res.send({ msg : err });
				return;
			}

			if (!workspace.hasAccess(req.user._id)) {
				res.send({ msg : 'Bad access to workspace ' + req.params.id });
				return;
			}

			res.json(workspace);
			return;
		});
	});

	// MODIFY WORKSPACE ========================================================
	app.put('/workspace/:id', app.isLoggedIn, function(req, res) {
		Workspace.findById(req.params.id, function(err, workspace) {
			if (err || !workspace) {
				res.send({ msg : err });
				return;
			}

			if (!workspace.hasAccess(req.user._id)) {
				res.send({ msg : 'Access forbidden.' });
				return;
			}

			var newWorkspace = req.body;
			if (newWorkspace.title)
				workspace.title = newWorkspace.title;
			if (newWorkspace.users && newWorkspace.users.length != 0)
				workspace.users = newWorkspace.users;
			if (newWorkspace.text)
				workspace.text = newWorkspace.text;

			workspace.save(function (err) {
				if (err) {
					res.send({ msg : err });
					return;
				}

				res.json(workspace);
			});
		});
	});

	// DELETE WORKSPACE ========================================================
	app.delete('/workspace/:id', app.isLoggedIn, function(req, res) {
		Workspace.findById(req.params.id, function(err, workspace) {
			if (err || !workspace) {
				res.send({ msg : err });
				return;
			}

			if (!workspace.hasAccess(req.user._id)) {
				res.send({ msg : 'Access forbidden.' });
				return;
			}

			workspace.remove(function (err) {
				res.send({ msg : err });
			});
		});

		// XXX: if this workspace had children, they all need to be orphaned.
	});

	// CREATE NEW WORKSPACE ====================================================
	app.post('/newworkspace', app.isLoggedIn, function(req, res) {
		var workspace = new Workspace();
		workspace.users.push(req.user._id);

		workspace.save(function (err) {
			if (err) {
				res.send({ msg : err });
				return;
			}

			res.json(workspace);
		});
	});

	// REQUEST LIST OF WORKSPACES ACTIVE USER PARTICIPATES IN ==================
	app.get('/workspaces', app.isLoggedIn, function(req, res) {
		Workspace.find({ users : req.user._id }, function(err, workspaces) {
			if (err || !workspaces) {
				res.send({ msg : err });
				return;
			}

			res.send(workspaces);
			return;
		});
	});
}
