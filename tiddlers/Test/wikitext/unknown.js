/*\
title: Test/wikitext/unknown.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with inline and block comments.

\*/

describe('wikitext uglifier', function() {
describe('unknown', function() {

const test = $tw.utils.test.wikitext.test;

it('keeps whitespace inside context', function() {
	test("\\whitespace trim\n?test?stuff?\n<div>\n\tContent\n</div>\n?test?",
		"\\whitespace trim\n?test?stuff?\n<div>\n\tContent\n</div>\n?test?");
	// Unknowns within unknowns can cause safety mode to turn off prematurely
	test("\\whitespace trim\n?test?stuff?\n<div>?test?inner?Content?test?</div>\n<div>\n\tLater\n</div>\n?test?",
		"\\whitespace trim\n?test?stuff?\n<div>?test?inner?Content?test?</div>\n<div>\n\tLater\n</div>\n?test?");
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
