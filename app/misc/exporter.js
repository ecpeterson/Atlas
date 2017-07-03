
// app/misc/exporter.js

var Bulb = require('../models/bulb.js');

module.exports = function() {
    function run(userid, inbox, outbox, callback) {
        // if the inbox is empty, it's time to quit.
        if (inbox.length == 0)
            return callback(outbox);

        // chunk out the first entry in the non-empty inbox
        var curBulb = inbox[0];

        curBulb.hasReadAccess(userid, function(ans) {
            if (!ans) {
                return callback({msg : "Bad read access."});
            }

            // ok we're initialized and we have read access.
            // convert this bulb into LaTeX code.
            return curBulb.convertToLaTeX(0 // this is an unused depth field
                                           , function (newText) {
                outbox += newText;

                // now we need to find the descendant bulbs
                return Bulb.find({
                    'parentContainer': curBulb._id
                }, function(err, childDocs) {
                    if (err) {
                        return "Export failed.";
                    }

                    return run(userid, childDocs.concat(inbox.slice(1)), outbox,
                        callback);
                });
            });
        });
    };

    return { "run": run };
}();
