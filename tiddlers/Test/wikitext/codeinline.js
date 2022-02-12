/*\
title: Test/wikitext/codeinline.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with code blocks.

\*/

describe('wikitext uglifier', function() {
describe('codeinline', function() {

const test = $tw.utils.test.wikitext.test;
const t = "\\whitespace trim\n";

it('works with single or double', function() {
	test("``Cont`ent``X", "``Cont`ent``X");
	test("``Content``X", "`Content`X");
	test("`Content`X", "`Content`X");
});

it('cuts tail', function() {
	test(  "`Content`", "`Content");
	test(  "`Content`\n", "`Content`\n");
	test(t+"`\nContent\n`\n  \n", "`\nContent\n");
	// Whitespace trim doesn't mess with this
	test("\\whitespace trim\n`\nContent\n\n\n`", "`\nContent\n\n\n");
});

it('cuts tail from inside widgets', function() {
	test(  "<span>\n`\nText`\n</span>", "<span>\n`\nText`\n");
	test(t+"<span>\n`\nText`\n</span>", "<span>`\nText");
});

it('does not expand entities within it', function() {
	test("A&#32;B\n\n`\nText&#32;This\n`", "A B\n\n`\nText&#32;This\n");
});

});});
