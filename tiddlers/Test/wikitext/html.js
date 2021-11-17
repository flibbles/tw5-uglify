/*\
title: Test/wikitext/html.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with html and widgets.

// TODO:
Test row of widgets inside block widget, an also inline widget
\*/

describe('wikitext uglifier', function() {
describe('html', function() {

var test = $tw.utils.test.wikitext.test;

it('inline widgets with a newline after them', function() {
	// This is a special case. widgets are considered blocks only if
	// they have two newlines after them, or one newline and the EOF
	// This means widgets with one newline followed by anything else
	// are inline, but if they're suddenly at the EOF , they're block
	// The only way to prevent this is not to let them go to EOF.
	test("<div>\n\n<$reveal/></div>", "<div>\n\n<$reveal/>");
	test("<div>\n\n<$reveal/>\n</div>", "<div>\n\n<$reveal/>\n</div>");
	test("<div>\n\n<$reveal/>\n</div>\n", "<div>\n\n<$reveal/>\n</div>");
	test("<div>\n\n<$reveal/>\n\n</div>", "<div>\n\n<$reveal/>\n");
	test("<div>\n\n<$reveal></$reveal>\n</div>", "<div>\n\n<$reveal></$reveal>\n");
	test("<div>\n\n<$reveal>\n\n</$reveal>\n</div>", "<div>\n\n<$reveal>\n\n");
	test("<div>\n\n<$reveal>\n\nC\n\n</$reveal>\n</div>", "<div>\n\n<$reveal>\n\nC");
	test("<div>\n\n<$reveal>\n\nC\n</$reveal>\n</div>", "<div>\n\n<$reveal>\n\nC\n");
	test("<div>\n\n<$reveal>\n\n<$reveal/>\n\n</$reveal>\n</div>", "<div>\n\n<$reveal>\n\n<$reveal/>\n");
	test("<div>\n\n<span>\n\n<$reveal/>\n</span>\n</div>", "<div>\n\n<span>\n\n<$reveal/>\n</span>");
	test("<div>\n\n<span>\n\n<$reveal/></span>\n</div>", "<div>\n\n<span>\n\n<$reveal/>");
	// whitespace trimming removes the need for this special handling
	test("\\whitespace trim\n<div>\n\n<$reveal/>\n</div>", "<div>\n\n<$reveal/>");
	test("\\whitespace trim\n<div>\n\n<span>\n\n<$reveal/>\n</span>\n</div>",
		"<div>\n\n<span>\n\n<$reveal/>");
	// If it couldn't have been a block to begin with,
	// then no special handling
	test("<div><$reveal/>\n</div>", "<div><$reveal/>\n");
	test("<div>\n<$reveal/>\n</div>", "<div>\n<$reveal/>\n");
	test("<div>\r\n<$reveal/>\r\n</div>", "<div>\n<$reveal/>\n");
	// widgets and comments
	test("<$reveal/>\n<!--comment-->", "<$reveal/>\n<!---->");
	test("\\whitespace trim\n<$reveal/>\n<!--comment-->", "<$reveal/>");
	test("<div>\n\n<$reveal/>\n<!--comment--></div>", "<div>\n\n<$reveal/>\n<!---->");
	test("\\whitespace trim\n<div>\n\n<$reveal/>\n<!--comment--></div>", "<div>\n\n<$reveal/>");
	// One case we get wrong. The reveal can never be block, but it's hard
	// to tell, so we preserve trailing closing tags to be safe.
	test("<div><$span/>\n\n<$reveal />\n</div>",
		"<div><$span/>\n\n<$reveal/>\n</div>");
	test("<div><$span/>\r\n\r\n<$reveal />\r\n</div>",
		"<div><$span/>\n\n<$reveal/>\n</div>");
});

it('block widgets with a newline after them', function() {
	// This is like the tests above, only much more rare. It involves
	// the user making weird widgets, but we'll handle it.
	test("<$reveal >\n</$reveal>", "<$reveal>\n</$reveal>");
	test("<$reveal >\n<!-- Comment --></$reveal>", "<$reveal>\n</$reveal>");
	test("<div><$reveal >\n</$reveal>", "<div><$reveal>\n</$reveal>");
	test("<div>\n\n<$reveal >\n</$reveal>", "<div>\n\n<$reveal>\n</$reveal>");
	// but whitespace trimming removes this need again
	test("\\whitespace trim\n<$reveal >\n</$reveal>", "<$reveal>");
	test("\\whitespace trim\n<div>\n\n<$reveal >\n</$reveal>", "<div>\n\n<$reveal>");
});

});});
