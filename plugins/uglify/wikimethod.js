/*\
title: $:/plugins/flibbles/uglify/wikimethod.js
module-type: wikimethod
type: application/javascript

\*/

/*jslint node: true, browser: true */
/*global $tw: false */
'use strict';

var compressor = require('./javascript/uglify.js');
var cacher = require('./cache.js');
var logger = require('./logger.js');
var utils = require('./utils.js');

var systemTargets = {'$:/boot/boot.js': true, '$:/boot/bootprefix.js': true};

exports.getTiddlerUglifiedText = function(title) {
	var wiki = this;
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
		var pluginInfo = wiki.getPluginInfo(title);
		if (pluginInfo) {
			var newInfo = $tw.utils.extend({}, pluginInfo);
			return cacher.getFileCacheForTiddler(wiki, title, tiddler.fields.text, function() {
				logger.log('Compressing:', title);
				newInfo.tiddlers = compressSubtiddlers(title, pluginInfo);
				return JSON.stringify(newInfo, null);
			});
		} else if (tiddler.fields.type === 'application/javascript') {
			return cacher.getFileCacheForTiddler(wiki, title, tiddler.fields.text, function() {
				logger.log('Compressing:', title);
				return compressor.compress(tiddler.fields.text, title);
			});
		}
		return tiddler.text || '';
	});
};

exports.compressionEnabled = function() {
	return utils.getSetting(this, 'compress');
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

function compressSubtiddlers(title, pluginInfo) {
	var newTiddlers = Object.create(null);
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
		if (fields.type === 'application/javascript') {
			abridgedFields.text = compressor.compress(fields.text, title);
		}
		newTiddlers[title] = abridgedFields;
	}
	return newTiddlers;
};
