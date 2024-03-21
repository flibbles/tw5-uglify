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
var utils = require('./utils.js');

/**
 * @param onSave is an async callback that takes (err)
 *    err - an error or if there was an error saving the cache
 *    saved - boolean, true if the file cache was refreshed, false otherwise
 *    This may be called before or after the method returns. One way or another
      it is called though.
 */
exports.getFileCacheForTiddler = function(wiki, title, textKey, initializer, onSave) {
	var processedFields;
	try {
		if (typeof textKey !== 'string') {
			throw new Error('Expected string for file cache key, not ' + textKey);
		}
		if ($tw.node && cachingEnabled(wiki)) {
			var cachedFields = loadTiddlerCache(wiki, title),
				checksum = hashString(textKey),
				signature = utils.getSignature(wiki);
			if (cachedFields) {
				if(checksum === parseInt(cachedFields.checksum)
				&& signature === cachedFields.signature) {
					return cachedFields;
				}
			}
			processedFields = initializer();
			saveTiddlerCache(wiki, title, checksum, signature, processedFields, onSave);
			// saveTiddlerCache will take care of the callback now.
			onSave = null;
		} else {
			processedFields = initializer();
		}
	} finally {
		if (onSave) {
			onSave(null, false);
		}
	}
	return processedFields;
};

function hashString(string) {
    for(var i = 0, h = 0; i < string.length; i++)
        h = Math.imul(31, h) + string.charCodeAt(i) | 0;
    return h;
};

// Promises to call onComplete
function saveTiddlerCache(wiki, title, checksum, signature, fields, onComplete) {
	var newTiddler = new $tw.Tiddler({checksum: checksum, signature: signature}, fields),
		filepath = exports.generateCacheFilepath(wiki, title),
		fileInfo = {
			hasMetaFile: false,
			type: 'application/x-tiddler',
			filepath: filepath};
	onComplete = onComplete || function(err) {
		if (err) {
			logger.warn(err);
		}
	};
	$tw.utils.saveTiddlerToFile(newTiddler, fileInfo, function(err) {
		onComplete(err, true, fields);
	});
};

function cachingEnabled(wiki) {
	return utils.getSetting(wiki, 'cache');
};

function cachingDir(wiki) {
	return utils.getSetting(wiki, 'cacheDirectory');
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
		var filename = $tw.utils.transliterate(title.replace(/\/|\\|<|>|~|\:|\"|\||\?|\*|\^/g,'_'));
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
