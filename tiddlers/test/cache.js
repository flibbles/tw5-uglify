/*\
title: test/cache.js
type: application/javascript
tags: $:/tags/test-spec

Tests the file caching mechanism.

\*/

var library = require('$:/plugins/flibbles/uglify/cache.js');
var cacheTiddler = '$:/config/flibbles/uglify/cache';
var dirTiddler = '$:/config/flibbles/uglify/cacheDirectory';

function cache(wiki, title, textKey, method, onsave) {
	return library.getFileCacheForTiddler(wiki, title, textKey, method, onsave);
};

function cache(wiki, title, textKey, method) {
	return new Promise((resolve, reject) => {
		return library.getFileCacheForTiddler(wiki, title, textKey, method, function(err, saved, cachedResults) {
			if (err) {
				reject(err);
			} else {
				resolve({output: cachedResults, saved: saved});
			}
		});
	});
};

function newName() {
	var bit = (Date.now() % 1000000).toString();
	return bit + Math.floor(Math.random() * 1000000);
};

describe('caching', function() {

if ($tw.node) {

	var fs = require('fs/promises');
	var testDir = './.testcache';

	it('caches in configurable directory', async function() {
		var wiki = new $tw.Wiki();
		// defaults to .cache
		var name = newName();
		var path = './.cache/'+name+'.tid';
		var info = await cache(wiki, name, 'textContent', () => 'output');
		expect(info.saved).toBe(true);
		const stats = await fs.stat(path);
		await fs.rm(path);
		expect(stats).toBeTruthy();
	});

	it('caching can be disabled', async function(done) {
		var wiki = new $tw.Wiki();
		wiki.addTiddler({title: cacheTiddler, text: 'no'});
		var name = newName();
		var path = './.cache/'+name+'.tid';
		var info = await cache(wiki, name, 'textContent', () => 'output');
		expect(info.saved).toBe(false);
		try {
			await fs.stat(path);
			done(new Error(`File ${path} was written but caching is disabled`));
		} catch (err) {
			done();
		}
	});

	it('overwrites existing caches, not make iterative ones', async function() {
		var wiki = new $tw.Wiki();
		wiki.addTiddler({title: dirTiddler, text: testDir});
		var name = newName();
		await cache(wiki, name, 'first', () => 'output1');
		await cache(wiki, name, 'second', () => 'output2');
		const files = await fs.readdir(testDir);
		var nameCount = 0;
		$tw.utils.each(files, function(file) {
			if (file.indexOf(name) >= 0) {
				nameCount++;
			}
		});
		expect(nameCount).toBe(1);
	});

	afterAll(async function() {
		await fs.rmdir(testDir, {recursive: true});
	})

} else { // !$tw.node

	it('doesn\'t try caching on the browser', async function() {
		var wiki = new $tw.Wiki();
		// Set this to 'yes', even though it should be overridden.
		wiki.addTiddler({title: cacheTiddler, text: 'yes'});
		function onSave(err) {
			throw new Error('onSave should never be called on the browser since caching is impossible there.');
		};
		var output = await cache(wiki, 'title', 'textKey', () => 'expected', onSave);
		expect(output).toBe('expected');
	});
}

});
