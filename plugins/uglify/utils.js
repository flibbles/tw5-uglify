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
	blacklist: '',
	stub: 'yes',
	cache: 'yes',
	cacheDirectory: './.cache'
};

var configType = {
	compress: Boolean,
	blacklist: Array,
	stub: Boolean,
	cache: Boolean
};

exports.getSetting = function(wiki, key) {
	var title = '$:/config/flibbles/uglify/'+key;
	return wiki.getCacheForTiddler(title, 'uglifysetting', function() {
		var def = config[key],
			value = wiki.getTiddlerText(title, def);
		switch (configType[key]) {
			case Boolean:
				return value.trim() === 'yes';
			case Array:
				return $tw.utils.parseStringArray(value);
			case String:
			default:
				return value ? value.trim() : undefined;
		}
	});
};

exports.getSettings = function(wiki) {
	var settings = Object.create(null);
	for (var key in config) {
		settings[key] = exports.getSetting(wiki, key);
	}
	return settings;
};

/**
 * Returns true if the given title is something which should be compressed
 * During saving or serving.
 */
exports.shouldCompress = function(wiki,title) {
	return wiki.compressionEnabled()
	    && (exports.getPluginInfo(wiki, title) || systemTargets[title])
	    && !blacklisted(wiki, title);
};

exports.getPluginInfo = function(wiki, title) {
	var info = wiki.getPluginInfo(title);
	if (info) {
		return info;
	}
	var tiddler = wiki.getTiddler(title);
	if (tiddler
	&& tiddler.fields['plugin-type']
	&& tiddler.fields.type === 'application/json') {
		// It's a plugin, but it's not installed.
		return wiki.getTiddlerDataCached(title, {tiddlers:[]});;
	}
	return undefined;
};

function blacklisted(wiki, title) {
	return exports.getSetting(wiki, 'blacklist').indexOf(title) >= 0;
};
