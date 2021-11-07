/*\
title: $:/plugins/flibbles/uglify/utils.js
module-type: library
type: application/javascript

Utility methods for Uglify

\*/

/*jslint node: true, browser: true */
/*global $tw: false */
'use strict';

var systemTargets = {'$:/boot/boot.css': true, '$:/boot/boot.js': true, '$:/boot/bootprefix.js': true};

var modulesAddedToConfig = false;

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
		var def = getConfig(wiki)[key],
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
	for (var key in getConfig(wiki)) {
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

// Returns all tiddlers that would be compressed
exports.allEligibleTiddlers = function(wiki) {
	var titles = [];
	if (wiki.compressionEnabled()) {
		titles.push.apply(titles, Object.keys(systemTargets));
		var indexer = $tw.wiki.getIndexer('FieldIndexer');
		$tw.utils.each(['plugin', 'theme', 'language'], function(type) {
			var plugins = indexer.lookup('plugin-type', type);
			$tw.utils.each(plugins, function(title) {
				if (!blacklisted(wiki, title)) {
					titles.push(title);
				}
			});
		});
		titles.sort();
	}
	return titles;
};

// Create a config entry for each uglifier module.
function getConfig(wiki) {
	if (!modulesAddedToConfig) {
		var uglifiers = $tw.modules.getModulesByTypeAsHashmap('uglifier', 'type');
		$tw.utils.each(uglifiers, function(module, type) {
			config[type] = 'yes';
			configType[type] = Boolean;
		});
		modulesAddedToConfig = true;
	}
	return config;
};

function blacklisted(wiki, title) {
	return exports.getSetting(wiki, 'blacklist').indexOf(title) >= 0;
};
