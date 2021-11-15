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
		nonos = [".startsWith", ".endsWith", ".assign.", ".assign("],
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
				expect(tiddler.text.search(regExp)).toBe(-1);
			}
		}
	});
});

});
