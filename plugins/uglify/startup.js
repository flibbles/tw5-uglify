/*\
title: $:/plugins/flibbles/uglify/startup
module-type: startup
type: application/javascript

If starting a server, this task gets uglifying out of the way immediately
on NodeJS so it doesn't wait until the first request. If compression is
initially disabled, nothing happens, and if it's later enabled, it does
get done on the next request.

If we're not running a server, don't bother precaching.
\*/

/*jslint node: true, browser: true */
/*global $tw: false */

'use strict';

exports.name = 'uglify';
exports.synchronous = true;
exports.before = ['commands'];
exports.platforms = ['node'];

var systemTargets = ["$:/boot/boot.js", "$:/boot/bootprefix.js"];

exports.startup = function() {
	$tw.hooks.addHook('th-server-command-post-start', precache);
};

function precache() {
	if ($tw.wiki.compressionEnabled()) {
		var indexer = $tw.wiki.getIndexer('FieldIndexer');
		var titles = indexer.lookup('plugin-type', 'plugin');
		$tw.utils.each(titles, precacheTiddler);
		$tw.utils.each(systemTargets, precacheTiddler);
	}
};

function precacheTiddler(title) {
	$tw.wiki.getTiddlerCompressedText(title);
}
