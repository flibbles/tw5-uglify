/*\
title: Test/cache.js
type: application/javascript
tags: $:/tags/test-spec

Tests the file caching mechanism.

\*/

const library = require('$:/plugins/flibbles/uglify/cache.js');
const utils = require('$:/plugins/flibbles/uglify/utils.js');
const logger = require('$:/plugins/flibbles/uglify/logger.js');
const cacheTiddler = '$:/config/flibbles/uglify/cache';
const dirTiddler = '$:/config/flibbles/uglify/cacheDirectory';
const testDir = './.testcache';

function cacheSync(wiki, title, textKey, method, onsave) {
	return library.getFileCacheForTiddler(wiki, title, textKey, method, onsave);
};

function cache(wiki, title, textKey, method) {
	var promise = new Promise((resolve, reject) => {
		library.getFileCacheForTiddler(wiki, title, textKey, method, function(err, saved, cachedResults) {
			if (err) {
				reject(err);
			} else {
				resolve({output: cachedResults, saved: saved});
			}
		});
	});
	return promise;
};

/* testWikis do their caching in a test directory, which we'll delete later */
function testWiki() {
	const wiki = new $tw.Wiki();
	wiki.addTiddler({title: dirTiddler, text: testDir});
	return wiki;
};

describe('caching', function() {

it('passes exception up if initializer throws without onComplete', async function() {
	const wiki = testWiki();
	const name = $tw.utils.test.uniqName();
	function thrower() {
		throw 'test exception';
	};
	expect(function() {
		cacheSync(wiki, name, 'key1', thrower);
	}).toThrow('test exception');
	try {
		// Test to make sure the file never got written
		await fs.access(testDir + '/' + name + '.tid');
		fail('file got written despite the exception');
	} catch (err) {
	}
	wiki.addTiddler({title: cacheTiddler, text: 'no'});
	expect(function() {
		cacheSync(wiki, $tw.utils.test.uniqName(), 'key2', thrower);
	}).toThrow('test exception');
});

it('passes exceptions to onComplete if supplied; caching on', function(done) {
	const wiki = testWiki();
	const name = $tw.utils.test.uniqName();
	const path = testDir + '/' + name + '.tid';
	cache(wiki, name, 'key1', function() { throw 'test exception'; } )
		.then(function(info) {
			done('Exception was not passed to callback method');
		})
		.catch(async function(err) {
			expect(err).toBe('test exception');
			try {
				await fs.access(path); // ensure it exists
				done('file got written despite the exception');
			} catch {
				done();
			}
		});
});

it('passes exceptions to onComplete if supplied; caching off', function(done) {
	const wiki = testWiki();
	wiki.addTiddler({title: cacheTiddler, text: 'no'});
	cache(wiki, $tw.utils.test.uniqName(), 'key1', function() { throw 'test exception'; } )
		.then(function(info) {
			done('Exception was not passed to callback method');
		})
		.catch(function(err) {
			done(expect(err).toBe('test exception'));
		});
});

// Node only tests
if ($tw.node) {

	const fs = require('fs/promises');

	it('can use a default directory', async function() {
		var wiki = new $tw.Wiki();
		// defaults to .cache
		var name = $tw.utils.test.uniqName();
		var path = './.cache/uglify/'+name+'.tid';
		var info = await cache(wiki, name, 'textContent', () => 'output');
		expect(info.saved).toBe(true);
		await fs.access(path); // ensure it exists
		await fs.rm(path);
	});

	it('insists on being passed a string', function() {
		// because just using toString() would likely result in unreliable
		// hashes.
		const wiki = testWiki();
		const name = $tw.utils.test.uniqName();
		expect(function() {
			cacheSync(wiki, name, {tiddler: {title: 'textContent'}}, () => '');
		}).toThrowError('Expected string for file cache key, not [object Object]');
	});

	it('can be disabled', async function(done) {
		var wiki = new $tw.Wiki();
		wiki.addTiddler({title: cacheTiddler, text: 'no'});
		var name = $tw.utils.test.uniqName();
		var path = './.cache/'+name+'.tid';
		var info = await cache(wiki, name, 'textContent', () => 'output');
		expect(info.saved).toBe(false);
		try {
			await fs.access(path);
			done(new Error(`File ${path} was written but caching is disabled`));
		} catch (err) {
			done();
		}
	});

	it('overwrites existing caches, not make iterative ones', async function() {
		const wiki = testWiki();
		var name = $tw.utils.test.uniqName();
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

	it('handles bad writes with callback', async function(done) {
		const wiki = new $tw.Wiki();
		const name = $tw.utils.test.uniqName();
		wiki.addTiddler({title: dirTiddler, text: './tiddlywiki.info'});
		try {
			await cache(wiki, name, 'anything', () => 'output');
			// Oddly, we can't test that 'output' was returned because of how
			// promises work. oh well, we'll test it in the bad write test
			// WITHOUT the callback.
			done(new Error('an error should have been emited. Tiddlywiki.info is not a directory'));
		} catch (err) {
			done(!err);
		}
	});

	it('handles bad writes without callback', function(done) {
		const wiki = new $tw.Wiki();
		const name = $tw.utils.test.uniqName();
		const oldAlert = logger.alert;
		// yeah... there's no try/finally for setting the logger.alert back.
		// Can't do it here. Just have to hope this test works as expected.
		logger.alert = function(/* messages */) {
			var message = Array.prototype.join.call(arguments, ' ');
			expect(message).toContain('not a directory');
			expect(message).toContain('uglify:');
			logger.alert = oldAlert;
			done();
		}
		wiki.addTiddler({title: dirTiddler, text: './tiddlywiki.info'});
		var output = cacheSync(wiki, name, 'anything', () => 'output');
		expect(output).toBe('output');
	});

	it('works', async function() {
		var info,
			accessCount = 0;
		const wiki = testWiki(),
			name = $tw.utils.test.uniqName();
		function outputter() {
			accessCount++;
			return 'output ' + accessCount;
		};
		info = await cache(wiki, name, 'input1', outputter);
		expect(info.output).toBe('output 1');
		expect(info.saved).toBe(true);
		expect(accessCount).toBe(1);
		info = await cache(wiki, name, 'input1', outputter);
		expect(info.output).toBe('output 1');
		expect(info.saved).toBe(false);
		expect(accessCount).toBe(1);
		info = await cache(wiki, name, 'input2', outputter);
		expect(info.output).toBe('output 2');
		expect(info.saved).toBe(true);
		expect(accessCount).toBe(2);
	});

	it('can handle strange tiddler names', function() {
		const wiki = new $tw.Wiki();
		function test(input, expected) {
			const output = library.generateCacheFilepath(wiki, input);
			const cacheDir = '/.cache/uglify/';
			const start = output.indexOf(cacheDir) + cacheDir.length;
			expect(output.substr(start)).toBe(expected);
		};
		test('$:/plugin/file', '$__plugin_file.tid');
		test('C:\\windows\\file', 'C__windows_file.tid');
		test('..file', '_.file.tid');
		test('.file', '_file.tid');
		test('-file', '-file.tid'); // Legal, albeit hard to use on terminal
		test('', '.tid.tid'); // Strange, but valid
		test('café', 'cafe.tid');
		test('ﬂᴂȿ', 'flaes.tid');
		test('\x8D\x8E', '141142.tid');
		test('ﬂ\x8E', 'fl142.tid');
	});

	it('can handle peculiar cache directories', function() {
		function test(inputDir, expected) {
			const wiki = new $tw.Wiki();
			wiki.addTiddler({title: dirTiddler, text: inputDir});
			const output = library.generateCacheFilepath(wiki, 'test');
			expect(output).toBe(expected);
		};
		// absolute paths
		test('/tmp/uglifycache/', '/tmp/uglifycache/test.tid');
		test('/usr/local/lib/node_modules/tiddlywiki/.cache/',
			'/usr/local/lib/node_modules/tiddlywiki/.cache/test.tid');
		// without ending '/'
		test('/noslashcache', '/noslashcache/test.tid');
		// ending newline. This can happen easily if
		// someone made the file with vi or something.
		test('/newline/\n', '/newline/test.tid');
		test('/newline\n', '/newline/test.tid');
		// These ones are... less likely
		test('\n/newline', '/newline/test.tid');
		test('/newline\n\n', '/newline/test.tid');
		test('/newline\r\n', '/newline/test.tid');
	});

	it('refreshes on version change', async function() {
		const wiki = testWiki();
		var name = $tw.utils.test.uniqName(), info;
		info = await cache(wiki, name, 'textKey', () => 'output');
		expect(info.saved).toBe(true);
		info = await cache(wiki, name, 'textKey', () => 'output');
		expect(info.saved).toBe(false);

		// Once the version is "changed", the cache should resave again.
		spyOn(utils, 'getVersion').and.returnValue('different')
		info = await cache(wiki, name, 'textKey', () => 'output');
		expect(info.saved).toBe(true);
		info = await cache(wiki, name, 'textKey', () => 'output');
		expect(info.saved).toBe(false);
	});

	afterAll(async function() {
		await fs.rmdir(testDir, {recursive: true});
	});

} else { // !$tw.node

	it('doesn\'t try caching on the browser', async function() {
		const wiki = new $tw.Wiki();
		// Set this to 'yes', even though it shouldn't need to be overridden.
		wiki.addTiddler({title: cacheTiddler, text: 'yes'});
		// First check without onComplete passed.
		const output = cacheSync(wiki, 'titleA', 'keyA', () => 'expectedA');
		expect(output).toBe('expectedA');
		const results = await cache(wiki, 'titleB', 'keyB', () => 'expectedB');
		expect(results.output).toBe('expectedB');
		expect(results.saved).toBe(false);
	});
}

});
