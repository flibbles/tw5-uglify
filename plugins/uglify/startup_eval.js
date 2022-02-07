/*\
title: $:/plugins/flibbles/uglify/startup_eval.js
module-type: startup
tags: $:/tags/flibbles/uglify/Stub
type: application/javascript

Introduces the new evalGlobal to the core utilities so that sourceMapURL
is added to the end of all javascript files.

It's important that this file be named alphabetically before the other
uglify startup module. This must come first.

\*/

/*jslint node: true, browser: true */
/*global $tw: false */

'use strict';

exports.name = 'uglify_mapping';
exports.synchronous = true;
// Before commands, or else the server hook may get called before this does.
exports.before = ['commands'];

var old = $tw.utils.appendSourceURL;

$tw.utils.appendSourceURL = function(code, filename) {
	const tempPrefix = "$:/plugins/flibbles/filters/js/w";
	if (filename.substr(0,tempPrefix.length) === tempPrefix) {
		return code + "\n\n//# sourceMappingURL=/uglify/map/" + filename;
	} else {
		return old(code, filename);
	}
};

// TODO: do I need to URL escape the filename?
