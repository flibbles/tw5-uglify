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
	cacheDirectory: './.cache/uglify'
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
	if (!wiki.compressionEnabled() || blacklisted(wiki, title)) {
		return false;
	}
	if (exports.getPluginInfo(wiki, title)) {
		return true;
	}
	if (!systemTargets[title]) {
		return false;
	}
	var tiddler = wiki.getTiddler(title)
	return tiddler && exports.getSetting(wiki, tiddler.fields.type || "text/vnd.tiddlywiki");
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
		$tw.utils.each(systemTargets, function(v, title) {
			if (exports.shouldCompress(wiki, title)) {
				titles.push(title);
			}
		});
		var indexer = $tw.wiki.getIndexer('FieldIndexer');
		$tw.utils.each(['plugin', 'theme', 'language'], function(type) {
			var plugins = indexer.lookup('plugin-type', type);
			$tw.utils.each(plugins, function(title) {
				if (exports.shouldCompress(wiki, title)) {
					titles.push(title);
				}
			});
		});
		titles.sort();
	}
	return titles;
};

// The signature is a string describing which uglifiers were applied to a
// given compression. Mismatching signatures means caches must be remade.
exports.getSignature = function(wiki) {
	return wiki.getGlobalCache('uglify-signature', function() {
		var actives = [];
		$tw.utils.each(uglifierModules(), function(module, type) {
			if (exports.getSetting(wiki, type)) {
				actives.push(type);
			}
		});
		actives.sort();
		if (exports.getSetting(wiki, "stub")) {
			// Include stubbing in the signature
			actives.push("stub");
		}
		return $tw.utils.stringifyList(actives);
	});
};

var version;
// Returns the version of uglify.
exports.getVersion = function() {
	if (version === undefined) {
		version = $tw.wiki.getTiddler('$:/plugins/flibbles/uglify').fields.version;
	}
	return version;
};

// Create a config entry for each uglifier module.
function getConfig(wiki) {
	if (!modulesAddedToConfig) {
		$tw.utils.each(uglifierModules(), function(module, type) {
			config[type] = 'yes';
			configType[type] = Boolean;
		});
		modulesAddedToConfig = true;
	}
	return config;
};

var _modules;

function uglifierModules() {
	if (_modules === undefined) {
		_modules = $tw.modules.getModulesByTypeAsHashmap('uglifier', 'type');
	}
	return _modules;
};

function blacklisted(wiki, title) {
	return exports.getSetting(wiki, 'blacklist').indexOf(title) >= 0;
};
