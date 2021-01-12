/*\
title: test/cache.js
type: application/javascript
tags: $:/tags/test-spec

Tests the file caching mechanism.

\*/

var library = require('$:/plugins/flibbles/uglify/cache.js');

function cache(wiki, title, textKey, method, onsave) {
	return library.getFileCacheForTiddler(wiki, title, textKey, method, onsave);
};

function newName() {
	var bit = (Date.now() % 1000000).toString();
	return bit + Math.floor(Math.random() * 1000000);
};

describe('caching', function() {

var fs = require('fs');

it('caches in configurable directory', function(done) {
	var wiki = new $tw.Wiki();
	// defaults to .cache
	var name = newName();
	var path = './.cache/'+name+'.tid';
	cache(wiki, name, 'textContent', () => 'compressedContent', function(err) {
		fs.stat(path, function(statErr, stats) {
			fs.rm(path, function(rmErr) {
				done(statErr || rmErr || expect(stats).toBeTruthy());
			});
		});
	}, 250);
});

});
