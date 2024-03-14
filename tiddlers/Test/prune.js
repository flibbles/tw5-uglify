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
	var map = $tw.wiki.getPruneMap();
	// These things are definitely pruned
	expect(map["$:/plugins/flibbles/uglify/utils.js"]).toBe(true);
});

});
