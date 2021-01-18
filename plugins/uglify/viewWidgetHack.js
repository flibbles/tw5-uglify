/*\
title: $:/plugins/flibbles/uglify/viewWidgetHack.js
module-type: startup
type: application/javascript

This hotswaps the old ViewWidget getValue method with ours, which is unfortuantely
the only way to inject uglified code into ViewWidget since we need to remain
<v5.1.23 compliant.
\*/

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

exports.name = 'uglify-hotswap';
exports.synchronous = true;

var ViewWidgetProto = require('$:/core/modules/widgets/view.js').view.prototype;
var oldGetValue;
var systemTargets = {'$:/boot/boot.js': true, '$:/boot/bootprefix.js': true};

// This is the method that replaces viewWidget.getValue.
// This method is the crux of Uglify.
function getPluginCompressedText(options) {
	if(!this.viewIndex
	&& !this.viewSubtiddler
	&& this.viewField === 'text'
	&& this.wiki.compressionEnabled()
	&& (this.wiki.getPluginInfo(this.viewTitle) || systemTargets[this.viewTitle])) {
		return this.wiki.getTiddlerCompressedText(this.viewTitle);
	}
	return oldGetValue.call(this, options);
};

exports.startup = function() {
	oldGetValue = ViewWidgetProto.getValue;
	ViewWidgetProto.getValue = getPluginCompressedText;
};

