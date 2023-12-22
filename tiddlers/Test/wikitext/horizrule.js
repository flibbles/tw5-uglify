/*\
title: Test/wikitext/horizrule.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with ---

\*/

describe('wikitext uglifier', function() {

describe('horizrule', function() {

const test = $tw.utils.test.wikitext.test;
const t = "\\whitespace trim\n";

it('handles', function() {
	test("--", "--");
	test("---", "---");
	test("----", "---");
	test("------", "---");
});

it('EOF', function() {
	test("---\n", "---");
	test("---\r\n", "---");
	test("---\n\n", "---");
	test("---\r\n\r\n", "---");
});

it('Block', function() {
	test("---\nContent", "---\nContent");
	test("----\nContent", "---\nContent");
	test("---\r\nContent", "---\nContent");
	test("---\n\nContent", "---\nContent");
	test("----Content", "----Content");
});

it('Inside element', function() {
	test("<div>\n\n---\n</div>", "<div>\n\n---");
	test("<div>\n\n---\n</div>x", "<div>\n\n---\n</div>x");
	test("<div>\n\n----\n</div>", "<div>\n\n---");
	test("<div>\n\n----\n</div>x", "<div>\n\n---\n</div>x");
	test("<div>\r\n\r\n---\r\n</div>", "<div>\n\n---");
	test("<div>\r\n\r\n---\r\n</div>x", "<div>\n\n---\n</div>x");
});

});});
