/*\
title: Test/templates.js
type: application/javascript
tags: $:/tags/test-spec

Tests some general purpose stuff about the plugin.

\*/

describe('templates', function() {

it("compresses when exporting offline-external-js", function() {
	const wiki = new $tw.Wiki();
	// This text is an excerpt from $:/core/templates/tiddlywiki5.js/tiddlers
	const text = '<$text text=<<jsontiddlers "[[$:/core]]">>/>';
	var tiddlers = [{title: "jsfile.js", text: "exports.mymethod = function() { var myvariable = 5; return myvariable; }", type: "application/javascript"}];
	$tw.utils.test.addPlugin(wiki, "$:/core", tiddlers);
	wiki.addTiddler($tw.utils.test.noCache());
	spyOn(console, 'log');
	var output = wiki.renderText("text/plain", "text/vnd.tiddlywiki", text);
	expect(output).toContain("mymethod");
	expect(output).not.toContain("myvariable");
});

it("compresses when exporting all-external-js", function() {
	const wiki = new $tw.Wiki();
	wiki.addTiddlers([
		$tw.wiki.getTiddler("$:/core/templates/tiddlywiki.js/load-tiddler"),
		{	title: "$:/boot/bootprefix.js",
			type: "application/javascript",
			text: "// Comment\nexports.method = function(argument) { return argument; }"},
		$tw.utils.test.noCache(),
		$tw.utils.test.setting("sourcemap", "yes"),
		{title: "$:/state/flibbles/uglify/server", text: "yes"}
	]);
	const text = '{{ $:/boot/bootprefix.js || $:/core/templates/tiddlywiki.js/load-tiddler}}';
	spyOn(console, 'log');
	var output = wiki.renderText("text/plain", "text/vnd.tiddlywiki", text);
	expect(output).not.toContain("Comment");
	expect(output).toContain("method");
	expect(output).toContain("sourceMappingURL=");
});

});