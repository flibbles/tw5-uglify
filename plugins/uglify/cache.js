/*\
title: $:/plugins/flibbles/uglify/cache.js
module-type: library
type: application/javascript

\*/

/*jslint node: true, browser: true */
/*global $tw: false */
'use strict';

exports.getFileCacheForTiddler = function(title, textKey, method) {
	return method();
};

function saveTiddlerCache(title, text) {
	var newTiddler = new $tw.Tiddler({title: title, text: text});
	var filepath = generateCacheFilepath(title);
	var fileInfo = {
		hasMetaFile: false,
		type: 'application/x-tiddler',
		filepath: filepath};
	console.warn("CONTENT:", text);
	$tw.utils.saveTiddlerToFile(newTiddler, fileInfo, function(err) {
		logger.log("Cached:", title, err);
	});
};

function loadTiddlerCache(title) {
	var path = generateCacheFilepath(title);
	var info = $tw.loadTiddlersFromFile(path);
	if (info.tiddlers.length > 0) {
		var tiddler = info.tiddlers[0];

	}
	return undefined;
};

function generateCacheFilepath(title) {
	return $tw.utils.generateTiddlerFilepath(title, {
		extension: ".tid",
		directory: './.cache'});
};
