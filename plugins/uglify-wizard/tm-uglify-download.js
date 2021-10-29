/*\
title: $:/plugins/flibbles/uglify-wizard/tm-uglify-download.js
type: application/javascript
module-type: startup

Startup module for creating the tm-uglify-download action

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

// Export name and synchronous status
exports.name = "uglify-download";
exports.after = ["startup"];
exports.synchronous = true;

var statusTiddler = "$:/plugins/flibbles/uglify-wizard/status";

exports.startup = function() {
	$tw.rootWidget.addEventListener("tm-uglify-download", function(event) {
		// This event does three things in order
		// 1. It sets statusTiddler to "working"
		// 2. It initiates the compression and download of the wiki
		// 3. It deletes the statusTiddler
		// The reason for doing it here instead of as three actions,
		// is becase we need to inject a pause between 1 and 2 so
		// the DOM can update.
		var wiki = $tw.wiki;
		wiki.addTiddler({title: statusTiddler, text: "working"});
		$tw.utils.nextTick(function() {
			$tw.utils.nextTick(function() {
				event.type = "tm-download-file";
				event.widget.dispatchEvent(event);
				wiki.deleteTiddler(statusTiddler);
			});
		});
	});
};

})();
