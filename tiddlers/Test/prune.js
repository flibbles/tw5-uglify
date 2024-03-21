/*\
title: Test/prune.js
type: application/javascript
tags: $:/tags/test-spec

Tests the hidden pruning feature of uglify. Makes sure it prunes itself.

\*/

describe('uglify', function() {

var oldConfigValue;
var configTiddler = "$:/config/flibbles/uglify/prune/uglify";

// This is an annoying thing. But because we need to run the tests in this
// suite on $tw.wiki, we need to swap out specific configurations for the
// tests, but ONLY for the tests, which gives us this beforeAll and afterAll.
beforeAll(function() {
	var tiddler = $tw.wiki.getTiddler(configTiddler);
	if (tiddler) {
		oldConfigValue = tiddler.fields.text;
		$tw.wiki.deleteTiddler(configTiddler);
	}
});

afterAll(function() {
	if (oldConfigValue !== undefined) {
		var tiddler = new $tw.Tiddler($tw.wiki.getTiddler(configTiddler), {text: oldConfigValue});
		$tw.wiki.addTiddler(tiddler);
	}
});

beforeEach(function() {
	spyOn(console, 'log');
});

it("keeps essential files in uglify while pruning", function() {
	function isNotPruned(title) {
		expect(map[title]).toBeUndefined("should not be pruning " + title);
		expect($tw.wiki.getTiddler(title)).toBeDefined();
	};
	var map = $tw.wiki.getPruneMap();
	// A few things must not be pruned
	isNotPruned("$:/plugins/flibbles/uglify/readme");
	isNotPruned("$:/plugins/flibbles/uglify/license");
});

it("removes files from uglify", function() {
	var wiki = new $tw.Wiki();
	wiki.addTiddler($tw.wiki.getTiddler("$:/plugins/flibbles/uglify"));
	var map = wiki.getPruneMap();
	// These things are definitely pruned
	expect(map["$:/plugins/flibbles/uglify/utils.js"]).toBe(true);
});

it("can have pruning disabled", function() {
	const wiki = new $tw.Wiki(),
		pluginName = '$:/plugins/flibbles/uglify',
		tiddlerName = '$:/anything',
		text = 'exports.myFunc = function(argName) {return argName;}',
		tiddlers = [
			{title: tiddlerName, type: 'application/javascript', text: text}];
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers);
	wiki.addTiddler($tw.wiki.getTiddler("$:/plugins/flibbles/uglify/prune/uglify"));
	$tw.utils.test.exec(wiki, 'cache=no', 'prune/uglify=yes');
	var output = wiki.getTiddlerUglifiedText("$:/plugins/flibbles/uglify");
	expect(output).not.toContain("$:/anything");
	// Now we disable pruning
	$tw.utils.test.exec(wiki, 'prune/uglify=no');
	output = wiki.getTiddlerUglifiedText("$:/plugins/flibbles/uglify");
	expect(output).toContain("$:/anything");
});

it("'server' can pick up imported modules", function() {
	const wiki = new $tw.Wiki(),
		pluginName = '$:/plugins/flibbles/test',
		tiddlerName = '$:/plugin/flibbles/test/command.js',
		helpName = '$:/language/Help/command',
		text = 'exports.Command = function(params,commander,callback) {}',
		tiddlers = [
			{title: tiddlerName, type: 'application/javascript', text: text, 'module-type': 'command'},
			{title: helpName, text: 'This should be purged'},
			{title: '$:/readme', text: 'This is the readme file'}];
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers);
	wiki.addTiddler($tw.wiki.getTiddler("$:/plugins/flibbles/uglify/prune/server"));
	$tw.utils.test.exec(wiki, 'cache=no', 'prune/server=yes');
	var output = JSON.parse(wiki.getTiddlerUglifiedText(pluginName));
	expect(output.tiddlers['$:/readme'].text).toBe('This is the readme file');
	expect(output.tiddlers[tiddlerName]).toBeUndefined();
	expect(output.tiddlers[helpName]).toBeUndefined();
});

});
