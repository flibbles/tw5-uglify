/*\
title: Test/json.js
type: application/javascript
tags: $:/tags/test-spec

Tests the uglify compressor and what it does to json and plugins.

\*/

describe('json uglifier', function() {

beforeEach(function() {
	spyOn(console, 'log');
});

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
	expect(wiki.getTiddlerUglifiedText('name')).toBe('{"tiddlers":{"test":{"text":"text"}},"ugly":true}');
	
});

it('does not add text fields if not there', function() {
	const wiki = new $tw.Wiki();
	const tiddlers = [ {title: 'A', tags: 'A'}, ];
	wiki.addTiddler($tw.utils.test.noCache());
	$tw.utils.test.addPlugin(wiki, 'name', tiddlers);
	var output = wiki.getTiddlerUglifiedText('name');
	expect(output).toBe('{"tiddlers":{"A":{"tags":"A"}},"ugly":true}');
});

it('removes empty tags fields', function() {
	const wiki = new $tw.Wiki();
	const tiddlers = [
		{title: 'A', tags: '', text: 'A text'},
		{title: 'B', text: 'B text'},
		{title: 'C', tags: 'Ctag', text: 'C text'}];
	wiki.addTiddler($tw.utils.test.noCache());
	$tw.utils.test.addPlugin(wiki, 'name', tiddlers);
	var output = JSON.parse(wiki.getTiddlerUglifiedText('name'));
	expect(output.tiddlers.A.tags).toBeUndefined();
	expect(output.tiddlers.B.tags).toBeUndefined();
	expect(output.tiddlers.C.tags).toBe('Ctag');
});

it('does not pick up overridden types', function() {
	const wiki = new $tw.Wiki();
	const text = 'exports.value = 5; //comment';
	const tiddlers = [
		{title: '$:/name/js.js', type: 'application/javascript', text: text}];
	// We turn off wikitext compression to ensure that doesn't stop it either.
	$tw.utils.test.exec(wiki, 'cache=no', 'text/vnd.tiddlywiki=no');
	$tw.utils.test.addPlugin(wiki, '$:/name', tiddlers);
	wiki.addTiddler({title: "$:/name/js.js", type: 'text/vnd.tiddlywiki', text: text});
	var output = JSON.parse(wiki.getTiddlerUglifiedText('$:/name'));
	expect(output.tiddlers['$:/name/js.js'].text).toBe('exports.value=5;');
	expect(output.tiddlers['$:/name/js.js'].type).toBe('application/javascript');
});

it('does not pick up overridden text', function() {
	const wiki = new $tw.Wiki();
	const title = '$:/name/js.js';
	const text = 'exports.value = 5; //comment';
	const tiddlers = [
		{title: title, type: 'application/javascript', text: text}];
	// We turn off wikitext compression to ensure that doesn't stop it either.
	$tw.utils.test.exec(wiki, 'cache=no');
	$tw.utils.test.addPlugin(wiki, '$:/name', tiddlers);
	wiki.addTiddler({title: title, type: 'application/javascript', text: 'exports.value = 3; //comment'});
	var output = JSON.parse(wiki.getTiddlerUglifiedText('$:/name'));
	expect(output.tiddlers[title].text).toBe('exports.value=5;');
});

it('json within plugins', function() {
	const wiki = new $tw.Wiki();
	const text = '{\n\t"A": "value",\n\t"B": "other"\n}';
	const tiddlers = [
		{title: '$:/name/json', type: 'application/json', text: text}];
	// We compress the plugin through this macro instead of just calling
	// the wikimethod, because we want to make sure uglify still compresses
	// plugins despite the settings, and the wikimethod always compresses.
	const macro = Object.create($tw.macros.jsontiddler);
	macro.wiki = wiki;
	$tw.utils.test.exec(wiki, 'cache=no');
	$tw.utils.test.addPlugin(wiki, '$:/name', tiddlers);
	var output = JSON.parse(JSON.parse(macro.run('$:/name')).text);
	expect(output.tiddlers['$:/name/json'].text).toBe(JSON.stringify(JSON.parse(text)));
	expect(output.ugly).toBe(true);
	// Now we confirm that if we turn off json compression, that pluglins
	// still compress, but the json inside of them does not.
	$tw.utils.test.exec(wiki, 'application/json=no');
	output = JSON.parse(JSON.parse(macro.run('$:/name')).text);
	expect(output.tiddlers['$:/name/json'].text).toBe(text);
	expect(output.ugly).toBe(true);
});

it('leaves non-system tiddlers pretty', function() {
	const wiki = new $tw.Wiki();
	const text = 'exports.value = 5; //comment';
	const tiddlers = [
		{title: '$:/A', type: 'application/javascript', text: text},
		{title: 'C', type: 'application/javascript', text: text}];
	wiki.addTiddler($tw.utils.test.noCache());
	$tw.utils.test.addPlugin(wiki, 'name', tiddlers);
	var output = JSON.parse(wiki.getTiddlerUglifiedText('name'));
	expect(output.tiddlers['$:/A'].text).not.toContain('comment');
	expect(output.tiddlers['C'].text).toContain('comment');
});

it('does not treat vanilla json as plugins', function() {
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
		description: "description",
		text: input});
	expect(wiki.getTiddlerUglifiedText('name')).toBe('{"tiddlers":{"test":{"title":"test","text":"text"}}}');
});

it('malformed', function() {
	var log = $tw.utils.Logger.prototype;
	spyOn(log, 'alert');
	function test(text) {
		const wiki = new $tw.Wiki();
		wiki.addTiddler($tw.utils.test.noCache());
		wiki.addTiddler({ title: 'name', type: 'application/json', text: text });
		log.alert.calls.reset();
		expect(wiki.getTiddlerUglifiedText('name')).toBe(text);
		expect(log.alert).toHaveBeenCalled();
		return log.alert.calls.mostRecent().args.join(' ');
	};
	var message = test('{ "this": ["is", "malformed"],}');
	expect(message).toContain("* pos: 30");
	message = test('{\n\tx"this": ["is", "malformed"]\n}');
	expect(message).toContain("* pos: 3");
});

});
