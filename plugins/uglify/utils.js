/*\
title: $:/plugins/flibbles/uglify/utils.js
module-type: library
type: application/javascript

Utility methods for Uglify

\*/

/*jslint node: true, browser: true */
/*global $tw: false */
'use strict';

var systemTargets = {'$:/boot/boot.js': true, '$:/boot/bootprefix.js': true};

var config = {
	compress: 'yes',
	stub: 'yes',
	cache: 'yes',
	cacheDirectory: './.cache'
};

exports.getSetting = function(wiki, key) {
	var title = '$:/config/flibbles/uglify/'+key;
	return wiki.getCacheForTiddler(title, 'uglifysetting', function() {
		var def = config[key],
			value = wiki.getTiddlerText(title, def);
		return value ? value.trim() : undefined;
	});
};

exports.getSettings = function(wiki) {
	var settings = Object.create(null);
	for (var key in config) {
		settings[key] = exports.getSetting(wiki, key);
	}
	return settings;
};

// This is the method that replaces viewWidget.getText some way or another.
// Maybe the viewwidgetformat replaces the 'text' viewwidgetformat, or
// maybe we monkey-patch ViewWidget directly. Either way, this method is the
// crux of Uglify.
exports.getPluginOrBootCompressedTextMethod = function(oldText) {
	return function(widget) {
		if (widget.wiki.compressionEnabled() && widget.viewField === "text") {
			if (systemTargets[widget.viewTitle] || widget.wiki.getPluginInfo(widget.viewTitle)) {
				return widget.wiki.getTiddlerCompressedText(widget.viewTitle);
			}
		}
		return oldText.call(this, widget);
	};
};
