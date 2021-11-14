/*\
title: Test/wikitext.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier.
\*/

describe('wikitext uglifier', function() {

const wikitextType = "text/vnd.tiddlywiki";

function test(text) {
	var out = $tw.wiki.getUglifier(wikitextType).uglify(text, 'test');
	var prettyHtml = $tw.wiki.renderText("text/html", wikitextType, text);
	var uglyHtml = $tw.wiki.renderText("text/html", wikitextType, out);
	expect(uglyHtml).toBe(prettyHtml);
	var prettyPlain = $tw.wiki.renderText("text/plain", wikitextType, text);
	var uglyPlain = $tw.wiki.renderText("text/plain", wikitextType, out);
	expect(uglyPlain).toBe(prettyPlain);
};

/*
it('does an identity transform right now', function() {
	var tested = 0;
	$tw.utils.each($tw.wiki.allShadowTitles(), function(title) {
		var tiddler = $tw.wiki.getTiddler(title);
		var type = tiddler.fields.type;
		if (!type || type === wikitextType) {
			var text = tiddler.fields.text;
			if (text) {
				try {
					var out = $tw.wiki.getUglifier(wikitext).uglify(text, title);
					expect(out).toBe(text);
					tested++;
					if (out !== text) {
						console.log("INPUT");
						console.log(text);
						console.log("OUTPUT");
						console.log(out);
						return false;
					}
				} catch (err) {
					console.log("ERROR ON:", title);
					throw err;
				}
			}
		}
	});
	console.log("Tested " + tested + " tiddlers");
});
*/

});
