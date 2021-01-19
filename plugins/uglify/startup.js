/*\
title: $:/plugins/flibbles/uglify/startup.js
module-type: startup
type: application/javascript

Performs all necessary startup work for Uglify.

\*/

/*jslint node: true, browser: true */
/*global $tw: false */

'use strict';

var utils = require('./utils.js');

exports.name = 'uglify';
exports.synchronous = true;
// Before commands, or else the server hook may get called before this does.
exports.before = ['commands'];

var ViewWidgetProto = require('$:/core/modules/widgets/view.js').view.prototype;
var oldGetValue;
var systemTargets = {'$:/boot/boot.js': true, '$:/boot/bootprefix.js': true};

exports.startup = function() {
	// This task gets uglifying out of the way immediately when servers start.
	// on NodeJS so it doesn't wait until the first request. If compression is
	// initially disabled, nothing happens, and if it's later enabled, it does
	// get done on the next request.
	$tw.hooks.addHook('th-server-command-post-start', precache);

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
	&& this.wiki.compressionEnabled()
	&& (this.wiki.getPluginInfo(this.viewTitle) || systemTargets[this.viewTitle])
	&& !blacklisted(this.wiki, this.viewTitle)) {
		return this.wiki.getTiddlerUglifiedText(this.viewTitle);
	}
	return oldGetValue.call(this, options);
};

function blacklisted(wiki, title) {
	return utils.getSetting(wiki, 'blacklist').indexOf(title) >= 0;
};

function precache() {
	if ($tw.wiki.compressionEnabled()) {
		var indexer = $tw.wiki.getIndexer('FieldIndexer');
		var titles = indexer.lookup('plugin-type', 'plugin');
		$tw.utils.each(titles, precacheTiddler);
		$tw.utils.each(Object.keys(systemTargets), precacheTiddler);
	}
};

function precacheTiddler(title) {
	$tw.wiki.getTiddlerUglifiedText(title);
}
