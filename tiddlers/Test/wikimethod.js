/*\
title: Test/wikimethod.js
type: application/javascript
tags: $:/tags/test-spec

This ensures that only a stub of the plugin shows up on the browser.

\*/

const logger = require('$:/plugins/flibbles/uglify/logger.js');

describe('wikimethod: getTiddlerUglifiedText', function() {

async function getTiddlerUglifiedTextAsync(wiki, name) {
	function promises() {
		var results, savePromise;
		var resultsPromise = new Promise((resolveResults, rejectResults) => {
			savePromise = new Promise((resolveSave, rejectSave) => {
				try {
					results = wiki.getTiddlerUglifiedText(name, {
						onSave: function(err, saved) {
							err ? rejectSave(err) : resolveSave(saved);
						}
					});
					resolveResults(results);
				} catch (e) {
					rejectResults(e);
				}
			});
		});
		return Promise.all([resultsPromise, savePromise]);
	};
	var array = await promises();
	return array[0];
};

it('passes through nonuglifiable tiddlers', function() {
	var wiki = new $tw.Wiki();
	wiki.addTiddlers([
		{title: 'nonUglify',
		 text: 'pass through',
		 type: 'text/x-markdown'}]);
	expect(wiki.getTiddlerUglifiedText('nonUglify')).toEqual('pass through');
});

it('on failure, be graceful', async function() {
	// We test many things in this beastly test...
	const pluginName = 'plugin_' + $tw.utils.test.uniqName();
	const filepath = './.cache/uglify/' + pluginName + '.tid';
	const goodText = 'exports.func = function(argName) {return argName;}';
	const badText = 'function func() { content does not compile;';
	const tiddlers = [
		{title: 'bad.js', type: 'application/javascript', text: badText},
		{title: 'good.js', type: 'application/javascript', text: goodText}];

	const wiki = new $tw.Wiki();
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers);
	spyOn(console, 'log');
	spyOn(logger, 'alert');
	const text = await getTiddlerUglifiedTextAsync(wiki, pluginName);
	// Test: The bad code is there, uncompressed but usable
	expect(text).toContain(badText);
	// Test: The good code is still fully compressed
	expect(text).toContain('exports.func');
	expect(text).not.toContain('argName');
	expect(console.log.calls.count()).toEqual(1);

	// Test: The logged error is helpful
	expect(logger.alert.calls.count()).toEqual(1);
	var error = logger.alert.calls.mostRecent().args.join(' ');
	expect(error).toContain('bad.js');
	expect(error).toContain('line: 1');

	// The rest of this test concerns node.js file caching
	if($tw.node) {
		const fs = require('fs/promises');
		// Test: A filecache was created
		await fs.access(filepath);

		const wiki2 = new $tw.Wiki();
		$tw.utils.test.addPlugin(wiki2, pluginName, tiddlers);
		// Test: We can get the file again without any logging or errors
		const text2 = wiki.getTiddlerUglifiedText(pluginName);
		// Test: Expect the results to be identical
		expect(text2).toBe(text);
		await fs.rm(filepath);
	}
});

it('can toggle particular uglifiers', async function() {
	const pluginName = "plugin_" + $tw.utils.test.uniqName();
	const filepath = './.cache/uglify/' + pluginName + '.tid';
	const javascript = 'exports.jsPresent = function(arg) {return arg;}';
	const stylesheet = '/* comment */\n.class { cssPresent: red; }';
	const tiddlers = [
		{title: 'test.js', text: javascript, type: 'application/javascript'},
		{title: 'test.css', text: stylesheet, type: 'text/css'}];
	const wiki = new $tw.Wiki();
	var fs, content;
	spyOn(console, 'log');
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers);
	var output = await getTiddlerUglifiedTextAsync(wiki, pluginName);
	expect(output).toContain('jsPresent');
	expect(output).toContain('cssPresent');
	expect(output).not.toContain('argName');
	expect(output).not.toContain('comment');

	if ($tw.node) {
		fs = require('fs/promises');
		content = await fs.readFile(filepath);
		expect(output).toContain('jsPresent');
		expect(output).toContain('cssPresent');
		expect(output).not.toContain('argName');
		expect(output).not.toContain('comment');
	}

	// But now we disable css
	wiki.addTiddler($tw.utils.test.setting('text/css', 'no'));
	var output = await getTiddlerUglifiedTextAsync(wiki, pluginName);
	expect(output).toContain('jsPresent');
	expect(output).toContain('cssPresent');
	expect(output).not.toContain('argName');
	expect(output).toContain('comment');

	if($tw.node) {
		content = await fs.readFile(filepath);
		expect(output).toContain('jsPresent');
		expect(output).toContain('cssPresent');
		expect(output).not.toContain('argName');
		expect(output).toContain('comment');
		await fs.rm(filepath);
	}
});

});
