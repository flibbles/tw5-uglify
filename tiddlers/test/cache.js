/*\
title: test/cache.js
type: application/javascript
tags: $:/tags/test-spec

Tests the file caching mechanism.

\*/

const library = require('$:/plugins/flibbles/uglify/cache.js');
const cacheTiddler = '$:/config/flibbles/uglify/cache';
const dirTiddler = '$:/config/flibbles/uglify/cacheDirectory';
const testDir = './.testcache';

// TODO: Test bad caching directory and error handling

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

/* testWikis do their caching in a test directory, which we'll delete later */
function testWiki() {
	const wiki = new $tw.Wiki();
	wiki.addTiddler({title: dirTiddler, text: testDir});
	return wiki;
};

function newName() {
	var bit = (Date.now() % 1000000).toString();
	return bit + Math.floor(Math.random() * 1000000);
};

describe('caching', function() {

if ($tw.node) {

	const fs = require('fs/promises');

	it('can use a default directory', async function() {
		var wiki = new $tw.Wiki();
		// defaults to .cache
		var name = newName();
		var path = './.cache/'+name+'.tid';
		var info = await cache(wiki, name, 'textContent', () => 'output');
		expect(info.saved).toBe(true);
		const stats = await fs.stat(path); // TODO: chance this to fs.access, but it needs exception handling
		await fs.rm(path);
		expect(stats).toBeTruthy();
	});

	it('can be disabled', async function(done) {
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
		const wiki = testWiki();
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

	it('works', async function() {
		var info,
			accessCount = 0;
		const wiki = testWiki(),
			name = newName();
		function outputter() {
			accessCount++;
			return 'output';
		};
		info = await cache(wiki, name, 'input1', outputter);
		expect(info.saved).toBe(true);
		expect(accessCount).toBe(1);
		info = await cache(wiki, name, 'input1', outputter);
		expect(info.saved).toBe(false);
		expect(accessCount).toBe(1);
		info = await cache(wiki, name, 'input2', outputter);
		expect(info.saved).toBe(true);
		expect(accessCount).toBe(2);
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
