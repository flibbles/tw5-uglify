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
var uglifiers = $tw.modules.getModulesByTypeAsHashmap("uglifier", "type");

/**This returns the compressed tiddlers regardless of whether it would be
 * compressed during saving or serving.
 */
exports.getTiddlerUglifiedText = function(title, options) {
	var wiki = this,
		uglifier,
		options = options || {},
		signature = utils.getSignature(wiki);
	// Currently we only support stubbing uglify itself.
	// Support for stubbing other plugins may come later.
	if (title === '$:/plugins/flibbles/uglify' && stubbingEnabled(this)) {
		return pluginStub(wiki, title);
	}
	var cache = this.getCacheForTiddler(title, 'uglify', function() { return {}; });
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
				var newInfo = $tw.utils.extend({}, pluginInfo);
				newInfo.tiddlers = compressSubtiddlers(wiki, title, pluginInfo);
				return JSON.stringify(newInfo, null);
			}};
		} else {
			uglifier = wiki.getUglifier(tiddler.fields.type);
		}
		if (uglifier) {
			cache.text = cacher.getFileCacheForTiddler(wiki, title, tiddler.fields.text, function() {
				logger.log('Compressing:', title);
				return compressOrNot(uglifier, title, tiddler.fields.text,wiki);
			}, options.onComplete);
		} else {
			cache.text = tiddler.fields.text || '';
		}
	};
	return cache.text;
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

function pluginStub(wiki, title) {
	return wiki.getCacheForTiddler(title, 'uglifystub', function() {
		var pluginInfo = wiki.getPluginInfo(title);
		var newInfo = $tw.utils.extend({}, pluginInfo);
		var tiddlers = Object.create(null);
		$tw.utils.each(pluginInfo.tiddlers, function(fields, title) {
			var tags = $tw.utils.parseStringArray(fields.tags);
			if (tags && tags.indexOf('$:/tags/flibbles/uglify/Stub') >= 0) {
				tiddlers[title] = fields;
			}
		});
		newInfo.tiddlers = tiddlers;
		return JSON.stringify(newInfo);
	});
};

function compressSubtiddlers(wiki, title, pluginInfo) {
	var newTiddlers = Object.create(null), uglifier,
		options = {wiki: wiki};
	for (var title in pluginInfo.tiddlers) {
		var fields = pluginInfo.tiddlers[title];
		var abridgedFields = Object.create(null);
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
			abridgedFields[field] = fields[field];
		}
		uglifier = wiki.getUglifier(fields.type);
		if (fields.text && uglifier) {
			abridgedFields.text = compressOrNot(uglifier, title, fields.text, wiki);
		}
		newTiddlers[title] = abridgedFields;
	}
	return newTiddlers;
};

function compressOrNot(uglifier, title, text, wiki) {
	try {
		return uglifier.uglify(text, {wiki: wiki});
	} catch (e) {
		logger.warn(compileFailureWarning(title, e));
		// Return the uncompressed text as a backup
		return text;
	}
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
