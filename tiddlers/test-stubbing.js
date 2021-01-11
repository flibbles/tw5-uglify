/*\
title: test/stubbing.js
type: application/javascript
tags: $:/tags/test-spec

This ensures that only a stub of the plugin shows up on the browser.

\*/

describe('stubbing', function() {

it("isn't too large", function() {
	var text = $tw.wiki.renderText("text/html", "text/vnd.tiddlywiki", "<$tiddler tiddler='$:/plugins/flibbles/uglify'><$view field='text' format='htmlencoded' /></$tiddler>")
	expect(text.length).toBeGreaterThan(100);
	expect(text.length).toBeLessThan(1000);
});

});
