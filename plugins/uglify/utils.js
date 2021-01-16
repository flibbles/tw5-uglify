/*\
title: $:/plugins/flibbles/uglify/utils.js
module-type: library
type: application/javascript

Utility methods for Uglify

\*/

/*jslint node: true, browser: true */
/*global $tw: false */
'use strict';

var config = {
	javascript: 'yes',
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