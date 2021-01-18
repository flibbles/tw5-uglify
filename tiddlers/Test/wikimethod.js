/*\
title: Test/wikimethod.js
type: application/javascript
tags: $:/tags/test-spec

This ensures that only a stub of the plugin shows up on the browser.

\*/

const logger = require('$:/plugins/flibbles/uglify/logger.js');

describe('wikimethod: getTiddlerUglifiedText', function() {

it('on failure, resorts to uncompressed code', function() {
	const plugin = '$:/plugins/anything';
	const badText = 'function func() { content does not compile;';
	const tiddlers = [
		{title: 'bad.js', type: 'application/javascript', text: badText}];

	const wiki = new $tw.Wiki();
	$tw.utils.test.addPlugin(wiki, plugin, tiddlers);
	var errors = $tw.utils.test.collect(logger, 'alert', function() {
		$tw.utils.test.collect(console, 'log', function() {
			const text = wiki.getTiddlerUglifiedText(plugin);
			expect(text).toContain(badText);
		});
	});
	expect(errors.length).toBe(1);
	expect(errors[0]).toContain('tiddler: bad.js');
	expect(errors[0]).toContain('line: 1');
	expect(errors[0]).toContain(plugin);
});

});
