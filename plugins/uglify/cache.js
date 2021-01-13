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

var path = require('path');

exports.getFileCacheForTiddler = function(wiki, title, textKey, method, onSave) {
	var processedText = method();
	if ($tw.node && cachingEnabled(wiki)) {
		saveTiddlerCache(wiki, title, processedText, onSave);
	}
	return processedText;
};

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
	$tw.utils.saveTiddlerToFile(newTiddler, fileInfo, onSave);
};

function cachingEnabled(wiki) {
	return wiki.getTiddlerText('$:/config/flibbles/uglify/cache', 'yes') === 'yes';
};

function cachingDir(wiki) {
	return wiki.getTiddlerText('$:/config/flibbles/uglify/cacheDirectory', './.cache');
};

function loadTiddlerCache(wiki, title) {
	var path = generateCacheFilepath(wiki, title);
	var info = $tw.loadTiddlersFromFile(path);
	if (info.tiddlers.length > 0) {
		var tiddler = info.tiddlers[0];
		return tiddler;
	}
	return undefined;
};

function generateCacheFilepath(wiki, title) {
	// Remove any forward or backward slashes so we don't create directories
	var filepath = title.replace(/\/|\\/g,"_");
	// Remove any characters that can't be used in cross-platform filenames
	filepath = $tw.utils.transliterate(filepath.replace(/<|>|~|\:|\"|\||\?|\*|\^/g,"_"));
	// Truncate the filename if it is too long
	if(filepath.length > 200) {
		filepath = filepath.substr(0,200);
	}
	// If the resulting filename is blank (eg because the title is just punctuation characters)
	if(!filepath) {
		// ...then just use the character codes of the title
		filepath = "";
		$tw.utils.each(title.split(""),function(char) {
			if(filepath) {
				filepath += "-";
			}
			filepath += char.charCodeAt(0).toString();
		});
	}
	return path.resolve(cachingDir(wiki), filepath + '.tid');
};
