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

var utils = require('$:/plugins/flibbles/uglify/utils.js');

// Export name and synchronous status
exports.name = "uglify-download";
exports.after = ["startup"];
exports.synchronous = true;

var currentTiddler = "$:/plugins/flibbles/uglify-wizard/current";

exports.startup = function() {
	$tw.rootWidget.addEventListener("tm-uglify-download", function(event) {
		// This event does three things in order
		// 1. It sets currentTiddler to the first tiddler to compress
		// 2. It pauses so Tiddlywiki can redraw
		// 3. It compresses
		// 4. If there is another to compress, go to 1, otherwise 5
		// 5. Initiate a download
		// By pausing, it allows the dom to make progress updates.
		var wiki = $tw.wiki,
			targets = utils.allEligibleTiddlers(wiki),
			index = 0;
		function prepNext() {
			if (index < targets.length) {
				wiki.addTiddler({title: currentTiddler, text: targets[index]});
				$tw.utils.nextTick(function() {
					// wrapping it in two nextTicks ensures that redrawing
					// the page happens between compresses.
					$tw.utils.nextTick(function() {
						var target = targets[index];
						index++;
						// Force it to compress
						wiki.getTiddlerUglifiedText(target)
						prepNext();
					});
				});
			} else {
				event.type = "tm-download-file";
				event.widget.dispatchEvent(event);
				wiki.deleteTiddler(currentTiddler);
			}
		};
		prepNext();
	});
};

})();
