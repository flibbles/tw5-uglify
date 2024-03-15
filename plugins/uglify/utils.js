/*\
title: $:/plugins/flibbles/uglify/utils.js
module-type: library
type: application/javascript

Utility methods for Uglify

\*/

/*jslint node: true, browser: true */
/*global $tw: false */
'use strict';

var systemTargets = {
	'$:/boot/boot.css': true,
	'$:/boot/boot.js': true,
	'$:/boot/bootprefix.js': true
};

var modulesAddedToConfig = false;

var config = {
	compress: 'yes',
	blacklist: '',
	sourcemap: 'server',
	cache: 'yes',
	cacheDirectory: './.cache/uglify'
};

var configType = {
	compress: Boolean,
	blacklist: Array,
	sourcemap: String,
	cache: Boolean
};

function getDefault(key) {
	return key.indexOf("prune/") == 0 ? "no" : getConfig()[key];
};

exports.getSetting = function(wiki, key) {
	var title = '$:/config/flibbles/uglify/'+key;
	return wiki.getCacheForTiddler(title, 'uglifysetting', function() {
		var def = getDefault(key),
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
	for (var key in getConfig()) {
		settings[key] = exports.getSetting(wiki, key);
	}
	var prefix = "$:/plugins/flibbles/uglify/prune/";
	wiki.eachShadowPlusTiddlers(function(tiddler, title) {
		if (title.substr(0, prefix.length) === prefix) {
			var key = title.substr(prefix.length-6);
			settings[key] = exports.getSetting(wiki, key);
		}
	});
	return settings;
};

exports.sourceMappingEnabled = function(wiki) {
	var setting = exports.getSetting(wiki, "sourcemap");
	if (setting === "server" && $tw.boot.origin) {
		return !!$tw.boot.origin;
	}
	return setting === "yes";
};

exports.setEnvironment = function(wiki) {
	var title = "$:/temp/library/flibbles/uglify.js";
	if (exports.sourceMappingEnabled(wiki)
	&& exports.getSetting(wiki, "compress")
	&& exports.getSetting(wiki, "application/javascript")) {
		var tiddler = new $tw.Tiddler($tw.wiki.getTiddler(title), {library: "yes"});
		wiki.addTiddler(tiddler);
	} else {
		wiki.deleteTiddler(title);
	}
};

/**
 * Returns true if the given title is something which should be compressed
 * During saving or serving.
 */
exports.shouldCompress = function(wiki, title) {
	if (!wiki.compressionEnabled() || blacklisted(wiki, title)) {
		return false;
	}
	if (exports.getPluginInfo(wiki, title)) {
		return true;
	}
	var tiddler = wiki.getTiddler(title)
	if (!tiddler || !exports.getSetting(wiki, tiddler.fields.type || "text/vnd.tiddlywiki")) {
		return false;
	}
	return exports.isSystemTarget(wiki, title);
};

exports.logFailure = function(title, error) {
	var reportFields = ['message', 'line', 'col', 'pos'];
	var dataString = 'Failed to compress ' + title + '\n';
	$tw.utils.each(reportFields, function(field) {
		if (error[field]) {
			dataString += "\n    * " + field + ": " + error[field];
		}
	});
	var logger = require('./logger.js');
	logger.warn(dataString);
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
		function check(title) {
			if (exports.shouldCompress(wiki, title)) {
				titles.push(title);
			}
		};
		$tw.utils.each(systemTargets, function(v, title) { check(title); });
		$tw.utils.each(wiki.each.byField("library", "yes"), check);
		var indexer = $tw.wiki.getIndexer('FieldIndexer');
		$tw.utils.each(['plugin', 'theme', 'language'], function(type) {
			var plugins = indexer.lookup('plugin-type', type);
			$tw.utils.each(plugins, check);
		});
		titles.sort();
	}
	return titles;
};

exports.isSystemTarget = function(wiki, title) {
	if (systemTargets[title]) {
		return true;
	}
	// It might be a library=yes module, like sjcl
	var tiddler = wiki && wiki.getTiddler(title);
	return tiddler
		&& tiddler.fields.type === "application/javascript"
		&& wiki.isSystemTiddler(title)
		&& tiddler.fields.library === "yes";
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
		var prefix = "$:/config/flibbles/uglify/prune/";
		wiki.eachShadowPlusTiddlers(function(tiddler, title) {
			if (title.substr(0, prefix.length) === prefix) {
				actives.push(title.substr(prefix.length-6));
			}
		});
		actives.sort();
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
function getConfig() {
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
