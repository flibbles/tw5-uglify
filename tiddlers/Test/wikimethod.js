/*\
title: Test/wikimethod.js
type: application/javascript
tags: $:/tags/test-spec

This ensures that only a stub of the plugin shows up on the browser.

\*/

const logger = require('$:/plugins/flibbles/uglify/logger.js');

describe('wikimethod: getTiddlerUglifiedText', function() {

it('on failure, be graceful', async function() {
	// We test many things in this beastly test...
	const pluginName = 'plugin_' + $tw.utils.test.uniqName();
	const filepath = './.cache/' + pluginName + '.tid';
	const goodText = 'exports.func = function(argName) {return argName;}';
	const badText = 'function func() { content does not compile;';
	const tiddlers = [
		{title: 'bad.js', type: 'application/javascript', text: badText},
		{title: 'good.js', type: 'application/javascript', text: goodText}];

	const wiki = new $tw.Wiki();
	var text;
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers);
	var logs;
	var errors = $tw.utils.test.collect(logger, 'alert', function() {
		logs = $tw.utils.test.collect(console, 'log', function() {
			text = wiki.getTiddlerUglifiedText(pluginName);
			// Test: The bad code is there, uncompressed but usable
			expect(text).toContain(badText);
			// Test: The good code is still fully compressed
			expect(text).toContain('exports.func');
			expect(text).not.toContain('argName');
		});
		expect(logs.length).toBe(1);
	});
	// Test: The logged error is helpful
	expect(errors.length).toBe(1);
	expect(errors[0]).toContain('bad.js');
	expect(errors[0]).toContain('line: 1');

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

});
