
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

bulbSchema.methods.hasReadAccess = function(user_id) {
	return ((this.ownerId == user_id) ||
			// check for workspace permissions
			false);
};

bulbSchema.methods.hasWriteAccess = function(user_id) {
	return ((this.ownerId == user_id) ||
			// check for workspace permissions
			false);
};

bulbSchema.methods.findParentWorkspace = function(user_id) {
	var Bulb = this.model('Bulb');

	var aux = function (bulb) {
		// check to be sure we have read access.
		if (!bulb.hasReadAccess(user_id))
			return { msg : 'Bad read access to ' + bulbId + '.' };

		// if we live in a workspace, announce it
		if (bulb.parentWorkspace)
			return { workspace : bulb.parentWorkspace };

		// if we live in a container, recurse on it
		if (bulb.parentContainer)
			return Bulb.findById(bulb.parentContainer,
				function(err, containerBulb) {
					if (err)
						return { msg : err };

					aux(containerBulb);
				});

		// otherwise, we're out of options.
		return { workspace : '' };
	};

	return aux(this);
};

var Bulb = mongoose.model('Bulb', bulbSchema);

module.exports = Bulb;
