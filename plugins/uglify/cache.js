/*\
title: $:/plugins/flibbles/uglify/cache.js
module-type: library
type: application/javascript

This exports one file: getFileCacheForTiddler, which behaves like
getCacheForTiddler, except  that its cache is in a file, not in memory.

\*/

/*jslint node: true, browser: true */
/*global $tw: false */
'use strict';

var logger = require('./logger.js');

/**
 * @param onSave is an async callback that takes (err, saved, value)
 *    err - an error or if there was an error saving the cache
 *    saved - boolean, true if the file cache was refreshed, false otherwise
 *    value - the results of method.
 */
exports.getFileCacheForTiddler = function(wiki, title, textKey, method, onSave) {
	var processedText;
	if (typeof textKey !== 'string') {
		throw new Error('Expected string for file cache key, not ' + textKey);
	}
	if ($tw.node && cachingEnabled(wiki)) {
		var cachedFields = loadTiddlerCache(wiki, title),
			checksum = hashString(textKey);
		if (cachedFields) {
			if (checksum === parseInt(cachedFields.checksum)) {
				var oldText = cachedFields.text;
				if (onSave) {
					onSave(null, false, oldText);
				}
				return oldText;
			}
		}
		processedText = method();
		saveTiddlerCache(wiki, title, checksum, processedText, onSave);
	} else {
		processedText = method();
		if (onSave) {
			onSave(null, false, processedText);
		}
	}
	return processedText;
};

function hashString(string) {
    for(var i = 0, h = 0; i < string.length; i++)
        h = Math.imul(31, h) + string.charCodeAt(i) | 0;
    return h;
};

function saveTiddlerCache(wiki, title, checksum, text, onSave) {
	var newTiddler = new $tw.Tiddler({title: title, text: text, checksum: checksum}),
		filepath = exports.generateCacheFilepath(wiki, title),
		fileInfo = {
			hasMetaFile: false,
			type: 'application/x-tiddler',
			filepath: filepath};
	onSave = onSave || function(err) {
		if (err) {
			// That empty string puts a space before the alert so it lines up
			// with all the log messages. I'm neurotic like that.
			logger.alert('', logger.componentName + ':', err);
		}
	};
	$tw.utils.saveTiddlerToFile(newTiddler, fileInfo, function(err) {
		onSave(err, true, text);
	});
};

function cachingEnabled(wiki) {
	return wiki.getTiddlerText('$:/config/flibbles/uglify/cache', 'yes') === 'yes';
};

function cachingDir(wiki) {
	var title = '$:/config/flibbles/uglify/cacheDirectory';
	return wiki.getCacheForTiddler(title, 'uglifycachedir', function() {
		var text = wiki.getTiddlerText(title, './.cache');
		return text.trim();
	});
};

function loadTiddlerCache(wiki, title) {
	var filepath = exports.generateCacheFilepath(wiki, title);
	try {
		var info = $tw.loadTiddlersFromFile(filepath);
		if (info.tiddlers.length > 0) {
			var tiddler = info.tiddlers[0];
			return tiddler;
		}
	} catch (err) {
		// Do nothing. It probably wasn't there.
	}
	return undefined;
};

if ($tw.node) {
	var path = require('path');

	exports.generateCacheFilepath = function(wiki, title) {
		// Remove any forward or backward slashes so we don't create directories
		// Remove any characters that can't be used in cross-platform filenames
		var filename = $tw.utils.transliterate(title.replace(/\/|\\|<|>|~|\:|\"|\||\?|\*|\^/g,"_"));
		// Having it start with a '.' can be problematic in some cases.
		if (filename[0] == '.') {
			filename = filename.replace('.', '_');
		}
		filename = filename.replace(/[^\x00-\x7F]/g, function(ch) {
			return ch.charCodeAt(0).toString();
		});
		// Truncate the filename if it is too long
		if(filename.length > 200) {
			filename = filename.substr(0,200);
		}
		// If the resulting filename is blank (eg because the title is just punctuation characters)
		if(!filename) {
			filename = '.tid';
		}
		return path.resolve(cachingDir(wiki), filename + '.tid');
	};
}
