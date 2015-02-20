
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
	shares : [ String ] //,
	// BLOB of attachments?
});

// METHODS =====================================================================

// cf. app/models/user.js for how to attach methods to a bulb object

bulbSchema.methods.hasReadAccess = function(user_id, callback) {
	var Workspace = this.model('Workspace');
	
	// simple ownership check
	if (this.ownerId == user_id)
		return callback(true);

	// check the path to see if we share a workspace
	this.findPath(function (path) {
		if (path.workspace) {
			Workspace.findById(path.workspace, function (err, workspace) {
				if (err)
					return;

				if (workspace.hasAccess(user_id))
					return callback(true);
			});
		} else
			// we don't have access.
			return callback(false);
	});
};

bulbSchema.methods.hasWriteAccess = function(user_id, callback) {
	var Workspace = this.model('Workspace');

	// simple ownership check
	if (this.ownerId == user_id)
		return callback(true);

	// check the path to see if we share a workspace
	this.findPath(function (path) {
		if (path.workspace) {
			Workspace.findById(path.workspace, function (err, workspace) {
				if (err)
					return;

				if (workspace.hasAccess(user_id))
					return callback(true);
			});
		} else
			// we don't have access.
			return callback(false);
	});
};

bulbSchema.methods.findPath = function(callback) {
	var Bulb = this.model('Bulb');

	var result = { workspace : '',
				   path : [] };

	var aux = function (bulb, result) {
		if (!bulb)
			return callback(result);

		// prepend this bulb to the path we're building
		result.path.unshift(bulb._id);

		// if we have a workspace, great, set it and run the callback
		if (bulb.parentWorkspace) {
			result.workspace = bulb.parentWorkspace;
			return callback(result);
		}

		// if we don't have a workspace, maybe we have a parent container
		if (bulb.parentContainer) {
			return Bulb.findById(bulb.parentContainer, function (newBulb) {
				return aux(newBulb, result);
			});
		}

		// if we have neither a workspace nor a container, we're toplevel.
		return callback(result);
	}

	return aux(this, result);
};

var Bulb = mongoose.model('Bulb', bulbSchema);

module.exports = Bulb;
