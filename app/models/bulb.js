
// app/models/bulb.js

var mongoose = require('mongoose');

// define the schema for our bulb model
var bulbSchema = mongoose.Schema({
	ownerId : String,
	title : { type : String, default : 'Default Title' },
	resolved : { type : Boolean, default : false },
	text : String,
	outgoingNodes : [ String ],
	modificationTime : { type : Date, default : Date.now },
	parentWorkspace : String,
	parentContainer : String,
	parentOriginal : String,
	shares : [ String ],
	preamble : String //,
	// BLOB of attachments?
});

// METHODS =====================================================================

// cf. app/models/user.js for how to attach methods to a bulb object

bulbSchema.methods.hasWriteAccess = function(user_id, callback) {
	var Workspace = this.model('Workspace');

	// simple ownership check
	if (this.ownerId == user_id) {
		return callback(true);
	}

	// check the path to see if we share a workspace
	this.findPath(function (path) {
		if (path.workspace) {
			Workspace.findById(path.workspace, function (err, workspace) {
				if (err) // default value: no access.
					return callback(false);

				if (workspace.hasAccess(user_id)) {
					return callback(true);
				}
			});
		} else {
			// we don't have access.
			return callback(false);
		}
	});
};

// this could potentially be different at some point in the future.
bulbSchema.methods.hasReadAccess = bulbSchema.methods.hasWriteAccess;

bulbSchema.methods.findPath = function(callback) {
	var Bulb = this.model('Bulb');

	var result = { workspace : '',
				   path : [] };

	var aux = function (bulb, result) {
		if (!bulb) {
			return callback(result);
		}

		// prepend this bulb to the path we're building
		result.path.unshift(bulb._id);

		// if we have a workspace, great, set it and run the callback
		if (bulb.parentWorkspace) {
			result.workspace = bulb.parentWorkspace;
			return callback(result);
		}

		// if we don't have a workspace, maybe we have a parent container
		if (bulb.parentContainer) {
			return Bulb.findById(new mongoose.Types.ObjectId(bulb.parentContainer),
					function (err, newBulb) {
				if (err) // we did our best.
					return callback(result);
				return aux(newBulb, result);
			});
		}

		// if we have neither a workspace nor a container, we're toplevel.
		return callback(result);
	}

	return aux(this, result);
};

bulbSchema.methods.augmentForExport = function(callback) {
	var bulb = this;
	var Bulb = this.model('Bulb');//,
		//Workspace = this.model('Workspace');

	bulb.findPath(function (path) {
		var ret = bulb.toObject();
		ret.pathData = path;

		var pathToTraverse = path.path.slice(0,-1);

		function aux (pathList, preambleString) {
			if (pathList.length == 0) {
				ret.virulentPreamble = preambleString;
				console.log("we're returning " + JSON.stringify(ret));
				return callback(ret);
			}

			return Bulb.findById(
				new mongoose.Types.ObjectId(pathList.slice(0,1)[0]),
				function (err, pathBulb) {
					if (err) // we did our best.
						return callback(ret);

					if (typeof(pathBulb.preamble) != "undefined") {
						if (preambleString.length != 0)
							preambleString += '\n\n';
						preambleString += pathBulb.preamble;
					}

					// drop the last guy, recurse
					return aux(pathList.slice(1), preambleString);
				});
		}

		// if (path.workspace != '')
		// 	Workspace.findById(function (err, workspace) {
		// 		if (err) // we did our best.
		// 			return callback(ret);

		// 		if (type(workspace.preamble) != "undefined") {
		// 			return aux(pathToTraverse, workspace.preamble);
		// 		} else {
		// 			return aux(pathToTraverse, '');
		// 		}
		// 	});
		// else
			return aux(pathToTraverse, '');
	});

	return;
};

bulbSchema.methods.convertToLaTeX = function(depth, callback) {
	function titleToLabel(bulb) {
		return bulb.title.replace(/[^a-z]/gi, '');
	}

	var Bulb = this.model('Bulb');

	this.augmentForExport(function (bulb) {
		var ret = "";

		if (depth == 0) {
			ret += "\\section{" + bulb.title + "}\n";
		} else if (depth == 1) {
			ret += "\\subsection{" + bulb.title + "}\n";
		} else {
			ret += "\\subsubsection{" + bulb.title + "}\n";
		}

		// give this thing a label
		ret += "\\label{" + titleToLabel(bulb) + "}\n\n";

		// start scoping the "preamble"
		ret += "{\n";

		ret += bulb.virulentPreamble + "\n\n";
		ret += bulb.preamble + "\n\n";
		ret += bulb.text + "\n\n";

		// append references to nearby / child nodes
		// convert bulb.outgoingNodes to bulb titles and labels
		// find all bulbs in Bulb that have this bulb as a parent

		return Bulb.find({
			'parentContainer': bulb._id
		}, function(err, childDocs) {
			if (err) {
				return "Export failed.";
			}

			ret += "\n\n\\noindent Children: ";

			var i;

			for (i = 0; i < childDocs.length; i++) {
				ret += childDocs[i].title;
				ret += " (\\Cref{" + titleToLabel(childDocs[i]) + "}), ";
			}

			return Bulb.find({
			    '_id': { $in:
			    	bulb.outgoingNodes.map(function(numericId) {
			    		return new mongoose.Types.ObjectId(numericId);
			    	})
			    }
			}, function(err, linkDocs){
				// linkDocs contains all the *link* bulb objects
				if (err) {
					return "Export failed.";
				}

				ret += "\n\n\\noindent Link references: ";

				var j;

				for (j = 0; j < linkDocs.length; j++) {
					ret += linkDocs[j].title;
					ret += " (\\Cref{" + titleToLabel(linkDocs[j]) + "}), ";
				}

				// end scoping the "preamble"
				ret += "\n\n}\n";
				return callback(ret);
			});
		});
	});
};

var Bulb = mongoose.model('Bulb', bulbSchema);

module.exports = Bulb;
