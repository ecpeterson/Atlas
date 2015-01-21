
// app/models/bulb.js

var mongoose = require('mongoose');

var bulbTypes = {
	STANDARD : "STANDARD",
	CONTAINER : "CONTAINER",
	WORKSPACE : "WORKSPACE"
};

// define the schema for our bulb model
var bulbSchema = mongoose.Schema({
	type : { type : String, default : bulbTypes.STANDARD },
	ownerId : String,
	title : { type : String, default : 'Default Title' },
	resolved : { type : Boolean, default : false },
	text : String,
	outgoingNodes : [ String ],
	modificationTime : { type : Date, default : Date.now },
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
