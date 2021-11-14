/*\
title: Test/plugins.js
type: application/javascript
tags: $:/tags/test-spec

Tests the uglify compressor and what it does to plugins.

\*/

describe('plugin uglifier', function() {

function compress(input, title) {
	title = title || 'test';
	return $tw.wiki.getUglifier('application/javascript').uglify(input, title);
};

it('removes title fields and pretty print', function() {
	const wiki = new $tw.Wiki();
	const input = `{
		"tiddlers": {
			"test": {
				"title": "test",
				"text": "text"
			}
		}
	}`;
	wiki.addTiddler($tw.utils.test.noCache());
	wiki.addTiddler({
		title: 'name',
		type: "application/json",
		"plugin-type": "plugin",
		description: "description",
		text: input});
	spyOn(console, 'log');
	expect(wiki.getTiddlerUglifiedText('name')).toBe('{"tiddlers":{"test":{"text":"text"}}}');
	
});

it('does not add text fields if not there', function() {
	const wiki = new $tw.Wiki();
	const tiddlers = [ {title: 'A', tags: 'A'}, ];
	wiki.addTiddler($tw.utils.test.noCache());
	$tw.utils.test.addPlugin(wiki, 'name', tiddlers);
	spyOn(console, 'log');
	var output = wiki.getTiddlerUglifiedText('name');
	expect(output).toBe('{"tiddlers":{"A":{"tags":"A"}}}');
});

it('removes empty tags fields', function() {
	const wiki = new $tw.Wiki();
	const tiddlers = [
		{title: 'A', tags: '', text: 'A text'},
		{title: 'B', text: 'B text'},
		{title: 'C', tags: 'Ctag', text: 'C text'}];
	wiki.addTiddler($tw.utils.test.noCache());
	$tw.utils.test.addPlugin(wiki, 'name', tiddlers);
	spyOn(console, 'log');
	var output = JSON.parse(wiki.getTiddlerUglifiedText('name'));
	expect(output.tiddlers.A.tags).toBeUndefined();
	expect(output.tiddlers.B.tags).toBeUndefined();
	expect(output.tiddlers.C.tags).toBe('Ctag');
});

});
