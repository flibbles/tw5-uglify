/*\
title: $:/plugins/flibbles/uglify/viewWidgetHack
module-type: startup
type: application/javascript

This hotswaps the old ViewWidget getValueAsText method with ours. We use this
\*/

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

exports.name = 'uglify-hotswap';
exports.synchronous = true;

var ViewWidgetProto = require('$:/core/modules/widgets/view.js').view.prototype;

var oldTextMethod = ViewWidgetProto.getValueAsText

if (oldTextMethod) {
	exports.startup = function() {
		var utils = require('./utils.js');

		var newMethod = utils.getPluginOrBootCompressedTextMethod(function(widget) {
			return oldTextMethod.call(widget);
		});
		// If oldTextMethod is present, it's only because we're working with an old
		// version of Tiddlywiki which doesn't support viewwidgetformat. We'll need
		// to monkey-patch ViewWidget to make Uglify work.
		ViewWidgetProto.getValueAsText = function() {
			return newMethod(this);
		}
	};
} else {
	exports.startup = function() {};
}

