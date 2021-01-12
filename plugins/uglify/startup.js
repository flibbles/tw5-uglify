/*\
title: $:/plugins/flibbles/uglify/startup
module-type: startup
type: application/javascript

This startup task gets uglifying out of the way immediately on NodeJS so it
doesn't wait until the first request. If compression is initially disabled,
nothing happens, and if it's later enabled, it does get done on the next
request.

\*/

/*jslint node: true, browser: true */
/*global $tw: false */

'use strict';

exports.name = 'uglify';
exports.synchronous = true;
exports.after = ['startup', 'plugins'];
exports.platforms = ['node'];

var systemTargets = ["$:/boot/boot.js", "$:/boot/bootprefix.js"];

exports.startup = function() {
	if ($tw.wiki.compressionEnabled()) {
		var indexer = $tw.wiki.getIndexer('FieldIndexer');
		var titles = indexer.lookup('plugin-type', 'plugin');
		$tw.utils.each(titles, precache);
		$tw.utils.each(systemTargets, precache);
	}
};

function precache(title) {
	$tw.wiki.getTiddlerCompressedText(title);
}
