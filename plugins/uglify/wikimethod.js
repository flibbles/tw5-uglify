/*\
title: $:/plugins/flibbles/uglify/wikimethod.js
module-type: wikimethod
type: application/javascript

\*/

/*jslint node: true, browser: true */
/*global $tw: false */
'use strict';

var cacher = require('./cache.js');
var logger = require('./logger.js');
var utils = require('./utils.js');
var getDirective = require('./startup_eval.js').getDirective;
var uglifiers = $tw.modules.getModulesByTypeAsHashmap("uglifier", "type");

exports.getTiddlerSourceMap = function(title, options) {
	var wiki = this,
		uglifier,
		exists = this.tiddlerExists(title),
		source = this.getShadowSource(title);
	if (source) {
		var fields = compressTiddler(this, source, options);
		if (fields.map) {
			if (typeof fields.map === "string") {
				fields.map = JSON.parse(fields.map);
			}
			if (fields.map[title]) {
				return fields.map[title];
			}
		}
	} else if (exists) {
		var fields = compressTiddler(this, title, options);
		if (typeof fields.map === "string") {
			fields.map = JSON.parse(fields.map);
			fields.map.sources[0] = title;
		}
		return fields.map;
	}
};

/**This returns the compressed tiddlers regardless of whether it would be
 * compressed during saving or serving.
 */
exports.getTiddlerUglifiedText = function(title, options) {
	return compressTiddler(this, title, options).text;
};

function compressTiddler(wiki, title, options) {
	var uglifier,
		options = options || {},
		signature = utils.getSignature(wiki);
	try {
		var cache = wiki.getCacheForTiddler(title, 'uglify', function() { return {}; });
		if (cache.signature !== signature) {
			cache.signature = signature;
			var tiddler = wiki.getTiddler(title);
			if (!tiddler) {
				return undefined;
			}
			var pluginInfo = utils.getPluginInfo(wiki, title);
			var uglifier = undefined;
			if (pluginInfo) {
				uglifier = {uglify: function(text, title) {
					return compressPlugin(wiki, title, pluginInfo);
				}};
			} else {
				uglifier = wiki.getUglifier(tiddler.fields.type);
			}
			if (uglifier) {
				// it will be up to getFileCache to call the callback now
				var onSave = options.onSave;
				options.onSave = undefined;
				var fields = cacher.getFileCacheForTiddler(wiki, title, tiddler.fields.text, function() {
					logger.log('Compressing:', title);
					return compressOrNot(uglifier, title, tiddler.fields.text,wiki);
				}, onSave);
				$tw.utils.extend(cache, fields);
			} else {
				cache.text = tiddler.fields.text || '';
			}
		}
		// We put on directives now, so their independent of the cache
		cache = addDirectiveToBootFiles(wiki, cache, title);
	} finally {
		// If we're here, it means we never saved the file.
		// Either we're on browser, the cache was good, or an error occured.
		if (options.onSave) {
			options.onSave(null, false);
		}
	}
	return cache;
};

exports.compressionEnabled = function() {
	return utils.getSetting(this, 'compress');
};

// Returns the given uglifier, but only if it hasn't been deactivated.
// undefined otherwise.
exports.getUglifier = function(type) {
	type = type || "text/vnd.tiddlywiki";
	return (utils.getSetting(this, type) || undefined) && uglifiers[type];
};

function stubbingEnabled(wiki) {
	return !$tw.browser && utils.getSetting(wiki, 'stub');
};

function compressPlugin(wiki, title, pluginInfo) {
	var newTiddlers = Object.create(null),
		maps = Object.create(null),
		newInfo = $tw.utils.extend({}, pluginInfo),
		uglifier,
		containsStubbing = stubbingEnabled(wiki) && pluginContainsStubbing(wiki, pluginInfo),
		options = {wiki: wiki};
	for (var title in pluginInfo.tiddlers) {
		var fields = pluginInfo.tiddlers[title];
		if (containsStubbing && !removeStubTag(fields)) {
			// This plugin is stubbed, and this tiddler has no stub.
			// We ignore it.
			continue;
		}
		var abridgedFields = cleanShadowFields(fields);
		uglifier = wiki.getUglifier(fields.type);
		if (fields.text && uglifier) {
			var results = compressOrNot(uglifier, title, fields.text, wiki);
			abridgedFields.text = results.text;
			if (results.map) {
				var mapObj = JSON.parse(results.map);
				// Plugin javascript need a semicolon so they skip a line
				// Because boot.js will add this whole (function(...){ thing.
				mapObj.mappings = ";" + mapObj.mappings;
				mapObj.sources[0] = title;
				maps[title] = mapObj;
			}
		}
		newTiddlers[title] = abridgedFields;
	}
	newInfo.tiddlers = newTiddlers;
	return {
		map: JSON.stringify(maps, null),
		text: JSON.stringify(newInfo, null) };
};

function pluginContainsStubbing(wiki, pluginInfo) {
	var tagged = wiki.getTiddlersWithTag("$:/tags/flibbles/uglify/Stub");
	if (tagged) {
		for (var i = 0; i < tagged.length; i++) {
			if (pluginInfo.tiddlers[tagged[i]]) {
				return true;
			}
		}
	}
	return false;
};

// returns true if the stub was there, and was removed.
function removeStubTag(fields) {
	var tags = $tw.utils.parseStringArray(fields.tags) || [],
		index = tags.indexOf("$:/tags/flibbles/uglify/Stub");
	if (index >= 0) {
		// Remove the Stub tag from the list.
		tags.splice(index, 1);
		return true;
	}
	return false;
};

function cleanShadowFields(fields) {
	var cleanedFields = Object.create(null);
	for (var field in fields) {
		// We don't need to copy the title field. It's redundant
		// since the key to this object is the title.
		if (field === 'title') {
			continue;
		}
		// Also, empty tags fields are pointless, but easy for
		// plugin writers to accidentally make. Drop em.
		if (field === 'tags' && !fields.tags) {
			continue;
		}
		cleanedFields[field] = fields[field];
	}
	return cleanedFields;
};

function compressOrNot(uglifier, title, text, wiki) {
	try {
		var fields = uglifier.uglify(text, {wiki: wiki});
		return fields;
	} catch (e) {
		logger.warn(compileFailureWarning(title, e));
		// Return the uncompressed text as a backup
		return {text: text};
	}
};

// If this is a system target, we give a chance to add
// directives in case this is a server which needs to tweak
// boot.js and such.
// This occurs INDEPENDENTLY of file writing. We don't want
// these directives in the file cache.
function addDirectiveToBootFiles(wiki, fields, title) {
	if (utils.isSystemTarget(title)) {
		var tiddler = wiki.getTiddler(title);
		if (tiddler && tiddler.fields.type === "application/javascript") {
			fields = Object.create(fields);
			fields.text = fields.text + getDirective(wiki, title, true);
		}
	}
	return fields;
};

function compileFailureWarning(title, error) {
	var reportFields = ['message', 'line', 'col', 'pos'];
	var dataString = 'Failed to compress ' + title + '\n';
	$tw.utils.each(reportFields, function(field) {
		if (error[field]) {
			dataString += "\n    * " + field + ": " + error[field];
		}
	});
	return dataString;
};
