/*\
title: $:/plugins/flibbles/uglify/compressedText
module-type: wikimethod
type: application/javascript

\*/

/*jslint node: true, browser: true */
/*global $tw: false */
'use strict';

var compressor = require('./javascript/uglify.js');

var systemTargets = {'$:/boot/boot.js': true, '$:/boot/bootprefix.js': true};

exports.getTiddlerCompressedText = function(title) {
	var wiki = this;
	return this.getCacheForTiddler(title, 'uglify', function() {
		var pluginInfo = wiki.getPluginInfo(title);
		if (pluginInfo) {
			var newInfo = $tw.utils.extend({}, pluginInfo);
			if (title === '$:/plugins/flibbles/uglify' && stubbingEnabled(wiki)) {
				newInfo.tiddlers = pluginStubTiddlers(pluginInfo);
			} else {
				newInfo.tiddlers = compressSubtiddlers(title, pluginInfo);
			}
			return JSON.stringify(newInfo, null);
		} else { 
			var tiddler = wiki.getTiddler(title);
			if (!tiddler) {
				return undefined;
			}
			if (tiddler.fields.type === 'application/javascript') {
				return compressor.compress(tiddler.fields);
			}
			return tiddler.text || '';
		}
	});
};

exports.compressionEnabled = function() {
	var config = this.getTiddler('$:/config/flibbles/uglify/javascript');
	return !config || (config.fields.text === 'yes');
};

function stubbingEnabled(wiki) {
	var config = wiki.getTiddler('$:/config/flibbles/uglify/stub');
	return !config || (config.fields.text === 'yes');
};

function pluginStubTiddlers(pluginInfo) {
	var tiddlers = Object.create(null);
	$tw.utils.each(pluginInfo.tiddlers, function(fields, title) {
		var tags = $tw.utils.parseStringArray(fields.tags);
		if (tags && tags.indexOf('$:/tags/flibbles/uglify/Stub') >= 0) {
			tiddlers[title] = fields;
		}
	});
	return tiddlers;
};

var logger = new $tw.utils.Logger('uglifier', {colour: 'green'});

function compressSubtiddlers(title, pluginInfo) {
	logger.log("Compressing:", title);
	var newTiddlers = Object.create(null);
	for (var title in pluginInfo.tiddlers) {
		var fields = pluginInfo.tiddlers[title];
		if (fields.type === 'application/javascript') {
			fields = $tw.utils.extend({}, fields);
			fields.text = compressor.compress(fields);
		}
		newTiddlers[title] = fields;
	}
	return newTiddlers;
};
