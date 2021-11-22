/*\
title: Test/wikitext/unknown.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with an unknown wikitext rule which
recursively calls the wikiparser.

The rule is a test rule found in testblock.js and testinline.js

\*/

describe('wikitext uglifier', function() {
describe('unknown', function() {

const test = $tw.utils.test.wikitext.test;
const t = "\\whitespace trim\n";

it('keeps whitespace inside context', function() {
	test(t+"?test?stuff?\n<div>\n\tContent\n</div>\n?test?",
	     t+"?test?stuff?\n<div>\n\tContent\n</div>\n?test?");
	// Unknowns within unknowns can cause safety mode to turn off prematurely
	test(t+"?test?stuff?\n<div>?test?inner?Content?test?</div>\n<div>\n\tLater\n</div>\n?test?",
	     t+"?test?stuff?\n<div>?test?inner?Content?test?</div>\n<div>\n\tLater\n</div>\n?test?");
});

it('does not collapse blocks', function() {
	test(t+"<div>\n\n!title spaces\n\n<$reveal/>\n</div>",
	       "<div>\n\n!title spaces\n\n<$reveal/>");
	test(t+"<div>\n\n?test?t?\ntest spaces\n?test?\n\n<$reveal/>\n</div>",
	     t+"<div>\n\n?test?t?\ntest spaces\n?test?\n\n<$reveal/>");
});

});

// testing the testing framework here, but if this secretely didn't
// work then the whitespace tests wouldn't be ensuring anything.
describe('testblock and testinline', function() {

const wikitextType = "text/vnd.tiddlywiki";

function test(input, expected) {
	var options = {variables: {currentTiddler: 'test'}};
	var output = $tw.wiki.renderText("text/html", wikitextType, input, options);
	expect(output).toBe(expected);
};

it('block', function() {
	test("?test?cl?\n\n\n\tcontent\n\n?test?",
		'<p class="cl">content</p>');
	test("?test?cl?\n<span>\n\tcontent\n</span>\n?test?",
		'<p class="cl"><span>\n\tcontent\n</span>\n</p>');
	test("?test?cl?\n<div>\n\n\tcontent\n</div>\n?test?",
		'<div class="cl"><p>content\n</p></div>');
	test("?test?cl?\n<div>\n\n\tcontent\n\n</div>\n?test?",
		'<div class="cl"><p>content</p></div>');
});

it('inline', function() {
	test("F?test?cl?content?test?",
		'<p>F<span class="cl">content</span></p>');
	test("?test?cl?<div>\n\n\tcontent\n\n</div>\n?test?",
		'<p><span class="cl"><div><p>content</p></div>\n</span></p>');
	test("F?test?cl?\n\n\n\tcontent\n\n?test?",
		'<p>F<span class="cl">\n\n\n\tcontent\n\n</span></p>');
});

});});
