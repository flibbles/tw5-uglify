/*\
title: Test/wikitext/codeblock.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with code blocks.

\*/

describe('wikitext uglifier', function() {
describe('comment', function() {

const test = $tw.utils.test.wikitext.test;

const cmp = $tw.utils.test.wikitext.cmp;

it('language string', function() {
	test("```\nContent\n```\nAfter", "```\nContent\n```\nAfter");
	test("```html\nContent\n```\nAfter", "```html\nContent\n```\nAfter");
});

it('carriage returns', function() {
	test("```\r\nContent\r\n```\r\nAfter", "```\nContent\n```\nAfter");
	// Cannot lose inner carriage returns, unfortunately
	test("```\r\nA\r\nB\r\n```\r\nAfter", "```\nA\r\nB\n```\nAfter");
});

it('cuts tail', function() {
	test("```\nContent\n```", "```\nContent");
	test("```\nContent\n```\n", "```\nContent");
	test("```\nContent\n```\n\n", "```\nContent");
	test("```\nContent\n```\n  \n", "```\nContent");
	// And if tailing whitespace is INSIDE?
	test("```\nContent\n\n```", "```\nContent\n");
	test("```\nContent\r\n```", "```\nContent");
	test("```\nContent\n\n\n```", "```\nContent\n\n");
	// Whitespace trim doesn't mess with this
	test("\\whitespace trim\n```\nContent\n\n\n```", "```\nContent\n\n");
});

it('cuts tail from inside widgets', function() {
	test("<div>\n\n```\nText\n```\n</div>", "<div>\n\n```\nText");
	test("<div>\n\n```\nText\n```\n</div>\n\n", "<div>\n\n```\nText");
	// And here are some broken ones.
	test("<div>\n\n```\nText\n```</div>", "<div>\n\n```\nText\n```</div>");
	test("<div>\n```\nText\n```\n</div>\n", "<div>\n```\nText\n```\n</div>\n");
});

});});
