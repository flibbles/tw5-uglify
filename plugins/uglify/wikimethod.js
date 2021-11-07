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
exports.getTiddlerUglifiedText = function(title) {
	var wiki = this, uglifier;
	// Currently we only support stubbing uglify itself.
	// Support for stubbing other plugins may come later.
	if (title === '$:/plugins/flibbles/uglify' && stubbingEnabled(this)) {
		return pluginStub(wiki, title);
	}
	return this.getCacheForTiddler(title, 'uglify', function() {
		var tiddler = wiki.getTiddler(title);
		if (!tiddler) {
			return undefined;
		}
		var pluginInfo = utils.getPluginInfo(wiki, title);
		if (pluginInfo) {
			var newInfo = $tw.utils.extend({}, pluginInfo);
			return cacher.getFileCacheForTiddler(wiki, title, tiddler.fields.text, function() {
				logger.log('Compressing:', title);
				newInfo.tiddlers = compressSubtiddlers(wiki, title, pluginInfo);
				return JSON.stringify(newInfo, null);
			});
		} else if (uglifier = wiki.getUglifier(tiddler.fields.type)) {
			return cacher.getFileCacheForTiddler(wiki, title, tiddler.fields.text, function() {
				logger.log('Compressing:', title);
				return uglifier.uglify(tiddler.fields.text, title);
			});
		}
		return tiddler.fields.text || '';
	});
};

exports.compressionEnabled = function() {
	return utils.getSetting(this, 'compress');
};

// Returns the given uglifier, but only if it hasn't been deactivated.
// undefined otherwise.
exports.getUglifier = function(type) {
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
	var newTiddlers = Object.create(null), uglifier;
	for (var title in pluginInfo.tiddlers) {
		var fields = pluginInfo.tiddlers[title];
		var abridgedFields = Object.create(null);
		// We do not need to copy the title field. It's redundant since the
		// key to this object is the title.
		for (var field in fields) {
			if (field !== 'title') {
				abridgedFields[field] = fields[field];
			}
		}
		if (uglifier = wiki.getUglifier(fields.type)) {
			abridgedFields.text = uglifier.uglify(fields.text, title);
		}
		newTiddlers[title] = abridgedFields;
	}
	return newTiddlers;
};
