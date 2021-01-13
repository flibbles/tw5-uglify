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

/**
 * @param onSave is an async callback that takes (err, saved, value)
 *    err - an error or if there was an error saving the cache
 *    saved - boolean, true if the file cache was refreshed, false otherwise
 *    value - the results of method.
 */
exports.getFileCacheForTiddler = function(wiki, title, textKey, method, onSave) {
	var processedText = method();
	if ($tw.node && cachingEnabled(wiki)) {
		saveTiddlerCache(wiki, title, processedText, onSave);
	} else {
		if (onSave) {
			onSave(null, false, processedText);
		}
	}
	return processedText;
};

var path;
if ($tw.node) {
	path = require('path');
}

function saveTiddlerCache(wiki, title, text, onSave) {
	var newTiddler = new $tw.Tiddler({title: title, text: text});
	var filepath = generateCacheFilepath(wiki, title);
	var fileInfo = {
		hasMetaFile: false,
		type: 'application/x-tiddler',
		filepath: filepath};
	onSave = onSave || function(err) {
		console.log("Cached:", title, err);
	};
	$tw.utils.saveTiddlerToFile(newTiddler, fileInfo, function(err) {
		onSave(err, true, text);
	});
};

function cachingEnabled(wiki) {
	return wiki.getTiddlerText('$:/config/flibbles/uglify/cache', 'yes') === 'yes';
};

function cachingDir(wiki) {
	return wiki.getTiddlerText('$:/config/flibbles/uglify/cacheDirectory', './.cache');
};

function loadTiddlerCache(wiki, title) {
	var filepath = generateCacheFilepath(wiki, title);
	var info = $tw.loadTiddlersFromFile(filepath);
	if (info.tiddlers.length > 0) {
		var tiddler = info.tiddlers[0];
		return tiddler;
	}
	return undefined;
};

// TODO: This isn't really tested very much
function generateCacheFilepath(wiki, title) {
	// Remove any forward or backward slashes so we don't create directories
	var filename = title.replace(/\/|\\/g,"_");
	// Remove any characters that can't be used in cross-platform filenames
	filename = $tw.utils.transliterate(filename.replace(/<|>|~|\:|\"|\||\?|\*|\^/g,"_"));
	// Truncate the filename if it is too long
	if(filename.length > 200) {
		filename = filename.substr(0,200);
	}
	// If the resulting filename is blank (eg because the title is just punctuation characters)
	if(!filename) {
		// ...then just use the character codes of the title
		filename = "";
		$tw.utils.each(title.split(""),function(char) {
			if(filename) {
				filename += "-";
			}
			filename += char.charCodeAt(0).toString();
		});
	}
	return path.resolve(cachingDir(wiki), filename + '.tid');
};
