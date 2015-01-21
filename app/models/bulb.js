
// app/models/bulb.js

var mongoose = require('mongoose');

// define the schema for our bulb model
var bulbSchema = mongoose.Schema({
	type : String,
	ownerId : String,
	title : String,
	resolved : Boolean,
	text : String,
	outgoingNodes : [ String ],
	modificationTime : Date,
	parents : {
		workspaceId : String,
		containerId : String,
		originalId : String
	},
	shares : [ String ] //,
	// BLOB of attachments?
});

// METHODS =====================================================================

// cf. app/models/user.js for how to attach methods to a bulb object

var bulbTypes = {
	STANDARD : "STANDARD",
	CONTAINER : "CONTAINER",
	WORKSPACE : "WORKSPACE"
};

bulbSchema.methods.hasReadAccess = function(user_id) {
	return (((this.type == bulbTypes.STANDARD) &&
				(this.ownerId == user_id)) ||
			// other bulb types
			false);
};

bulbSchema.methods.hasWriteAccess = function(user_id) {
	return (((this.type == bulbTypes.STANDARD) &&
				(this.ownerId == user_id)) ||
			// other bulb types
			false);
};

var Bulb = mongoose.model('Bulb', bulbSchema);

Bulb.types = bulbTypes;

module.exports = Bulb;
