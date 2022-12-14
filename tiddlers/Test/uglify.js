/*\
title: Test/uglify.js
type: application/javascript
tags: $:/tags/test-spec

Tests some general purpose stuff about the plugin.

\*/

describe('uglify', function() {

it("supports IE11", function() {
	// Also, backticks aren't allowed, but there isn't an easy way
	// to test for that.
	var plugins = ["$:/plugins/flibbles/uglify", "$:/plugins/flibbles/uglify-wizard"],
		nonos = [".startsWith", ".endsWith", ".assign(", ".trimStart(", ".trimEnd("],
		str = "(?:" + nonos.map($tw.utils.escapeRegExp).join('|') + ")",
		regExp = new RegExp(str);
	$tw.utils.each(plugins, function(plugin) {
		var info = $tw.wiki.getPluginInfo(plugin);
		if (info !== undefined) {
			for (var title in info.tiddlers) {
				var tiddler = info.tiddlers[title];
				if (tiddler.type !== "application/javascript") {
					continue;
				}
				var results = regExp.exec(tiddler.text);
				expect(results).toBeNull("Found non-IE11 function '" + (results||[])[0] + "' in " + title);
			}
		}
	});
});

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

});
