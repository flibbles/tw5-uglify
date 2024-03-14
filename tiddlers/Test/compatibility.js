/*\
title: Test/compatibility.js
type: application/javascript
tags: $:/tags/test-spec

Tests some general compatibility concerns. This isn't perfect, but it helps
pick up some anti-IE11 stuff.

\*/

describe('compatibility', function() {

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

});
