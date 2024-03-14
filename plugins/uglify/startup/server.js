/*\
title: $:/plugins/flibbles/uglify/startup/server.js
module-type: startup
type: application/javascript

Performs all necessary startup work for Uglify.

\*/

/*jslint node: true, browser: true */
/*global $tw: false */

'use strict';

var utils = require('../utils.js');

exports.name = 'uglify';
exports.synchronous = true;
// Before commands, or else the server hook may get called before this does.
exports.before = ['commands'];

var ViewWidgetProto = require('$:/core/modules/widgets/view.js').view.prototype;
var oldGetValue;

exports.startup = function() {
	// This task gets uglifying out of the way immediately when servers start.
	// on NodeJS so it doesn't wait until the first request. If compression is
	// initially disabled, nothing happens, and if it's later enabled, it does
	// get done on the next request.
	$tw.hooks.addHook('th-server-command-post-start', precache);

	if (utils.getSetting($tw.wiki, "sourcemap")) {
		var tiddler = new $tw.Tiddler($tw.wiki.getTiddler("$:/temp/library/flibbles/uglify.js"), {library: "yes"});
		$tw.wiki.addTiddler(tiddler);
	}

	// Hotswaps the old ViewWidget getValue method with ours, which is
	// unfortuantely the only way to inject uglified code into ViewWidget
	// since we need to remain <v5.1.23 compliant.
	oldGetValue = ViewWidgetProto.getValue;
	ViewWidgetProto.getValue = getPluginCompressedText;
};

// This is the method that replaces viewWidget.getValue.
// This method is the crux of Uglify.
function getPluginCompressedText(options) {
	if(!this.viewIndex
	&& !this.viewSubtiddler
	&& this.viewField === 'text'
	&& utils.shouldCompress(this.wiki,this.viewTitle)) {
		return this.wiki.getTiddlerUglifiedText(this.viewTitle);
	}
	return oldGetValue.call(this, options);
};

function precache() {
	// The this is a server. Create this state tiddler which clients will
	// use to realize they should enable sourceMapping.
	// $:/state tiddlers will transfer to client, but they won't write to file
	// ...just the way we want it.
	$tw.wiki.addTiddler({title: "$:/state/flibbles/uglify/server", text: "yes"});
	// The server will precompress everything that can be
	// compressed so that we don't stall on the first client request.
	$tw.utils.each(utils.allEligibleTiddlers($tw.wiki), precacheTiddler);
};

function precacheTiddler(title) {
	$tw.wiki.getTiddlerUglifiedText(title);
}
