
// app/models/workspace.js

var mongoose = require('mongoose');

// define the schema for our bulb model
var workspaceSchema = mongoose.Schema({
	title : { type : String, default : 'Default Workspace Title' },
	text : String,
	users : [ String ]
});

// METHODS =====================================================================

// cf. app/models/user.js for how to attach methods to a bulb object

workspaceSchema.methods.hasAccess = function(user_id) {
	return (this.users.indexOf(user_id) > -1);
};

var Workspace = mongoose.model('Workspace', workspaceSchema);

module.exports = Workspace;
