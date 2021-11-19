/*\
title: Test/wikitext/comment.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with inline and block comments.

\*/

describe('wikitext uglifier', function() {
describe('comment', function() {

const test = $tw.utils.test.wikitext.test;
const cmp = $tw.utils.test.wikitext.cmp;
const t = "\\whitespace trim\n";

it('inline sharing line with content can always go', function() {
	test("First <!--comment-->\nText", "First \nText");
	test("\\whitespace trim\nFirst <!--comment-->\nText", "FirstText");
});

it('inline filling a line might have to stay', function() {
	test("<div>\n\tText\n\t<!--Comment-->\n</div>", "<div>\n\tText\n\t\n");
	test("\\whitespace trim\n<div>\n\tText\n\t<!--C-->\n</div>", "<div>Text");
	test("Text\n<!--Comment-->\n\nSecond", "Text\n<!---->\n\nSecond");
	test("\\whitespace trim\nText\n<!--Comment-->\n\nSecond", "Text\n\nSecond");
	test("Text\n<!--Comment--> \n\nSecond", "Text\n \n\nSecond");
	test("\\whitespace trim\nText\n<!--stuff--> \n\nSecond", "Text\n\nSecond");
	test("Text\n <!--Comment-->\n\nSecond", "Text\n \n\nSecond");
	test("\\whitespace trim\nText\n <!--stuff-->\n\nSecond", "Text\n\nSecond");
});

it('inline that are sequential', function() {
	// Sequential comments can goof pruning
	test("<div>\n\nFirst\n<!--1--><!--2-->\nSecond\n</div>",
		"<div>\n\nFirst\n<!---->\nSecond\n");
	test("<div>\n\nFirst\n<!--1--><!--2--><!--3-->\nSecond\n</div>",
		"<div>\n\nFirst\n<!---->\nSecond\n");
	test("<div>\n\nFirst\n<!--1--><!--2--> <!--3-->\nSecond\n</div>",
		"<div>\n\nFirst\n \nSecond\n");
});

it('inline on sequential lines', function() {
	// Lines of comments can't prune very well without whitespace trimming
	test("First\n<!--1-->\n<!--2-->\nText", "First\n<!---->\n<!---->\nText");
	test("\\whitespace trim\nFirst\n<!--1-->\n<!--2-->\nText", "FirstText");
});

it('inline does not splice or create blocks', function() {
	test("<div>\n\nFirst\n<!--Comment-->\nSecond\n</div>",
		"<div>\n\nFirst\n<!---->\nSecond\n");
	test("\\whitespace trim\n<div>\n\nFirst\n<!--Comment-->\nSecond\n</div>",
		"<div>\n\nFirstSecond");
	test("<div>\n<!--Comment-->\nText\n</div>", "<div>\n<!---->\nText\n");
	test("\\whitespace trim\n<div>\n<!--Comment-->\nText\n</div>", "<div>Text");
	test("First\n<!--1--> \nText", "First\n \nText");
	test("\\whitespace trim\nFirst\n<!--1--> \nText", "FirstText");
	test("First\n <!--1-->\nText", "First\n \nText");
	test("\\whitespace trim\nFirst\n <!--1-->\nText", "FirstText");
	// Pesky carriage-returns
	test("<div>\r\n<!--comment-->\r\nText\r\n</div>", "<div>\n<!---->\nText\n");
	test("\\whitespace trim\r\n<div>\r\n<!--comment-->\r\nText\r\n</div>", "<div>Text");
	test("A\r\n<!--comment-->\r\nB", "A\n<!---->\nB");
});

it('preceding content that cannot be at end', function() {
	test(  "<$reveal/>\n<!--comment-->", "<$reveal/>\n<!---->");
	test(t+"<$reveal/>\n<!--comment-->", "<$reveal/>");
	test(  "<$reveal/>\n<!--comment-->X", "<$reveal/>\nX");
	test(t+"<$reveal/>\n<!--comment-->X", "<$reveal/>X");
	test(  "<$reveal/>\n<!--comment--> ", "<$reveal/>\n ");
	test(t+"<$reveal/>\n<!--comment--> ", "<$reveal/>");
	test(  "<$reveal/>\n<!--comment-->\n", "<$reveal/>\n<!---->\n");
	test(t+"<$reveal/>\n<!--comment-->\n", "<$reveal/>");
	test(  "<$reveal/>\n<!--comment-->\n\n", "<$reveal/>\n<!---->");
	test(t+"<$reveal/>\n<!--comment-->\n\n", "<$reveal/>");
	test(  "<$reveal/>\n<!--comment-->\nX", "<$reveal/>\n<!---->\nX");
	test(t+"<$reveal/>\n<!--comment-->\nX", "<$reveal/>X");
	test(  "<$reveal/>\n<!--comment-->\n ", "<$reveal/>\n<!---->\n ");
	test(t+"<$reveal/>\n<!--comment-->\n ", "<$reveal/>");
	test(  "<$reveal/>\n<!--comment-->\n\nX", "<$reveal/>\n<!---->\n\nX");
	test(t+"<$reveal/>\n<!--comment-->\n\nX", "<$reveal/><!---->\n\nX");
	test(  "<div>\n\n<$reveal/>\n<!--c--></div>","<div>\n\n<$reveal/>\n</div>");
	test(t+"<div>\n\n<$reveal/>\n<!--c--></div>","<div>\n\n<$reveal/>");
});

it('block', function() {
	test("<div>\n\n<!--Comment-->\nText\n</div>", "<div>\n\nText\n");
	test("\\whitespace trim\n<div>\n\n<!--C-->\nText\n</div>", "<div>\n\nText");
	test("<div>\n\n<!--Comment-->Text\n</div>", "<div>\n\nText\n");
	test("\\whitespace trim\n<div>\n\n<!--C-->Text\n</div>", "<div>\n\nText");
	test("A\n\n<!--Comment-->\n\nB", "A\n\nB");
	test("A\n\n<!--Comment-->\n\n\n\nB", "A\n\nB");
	test("A\n\n<!--Comment--><!--Comment-->\n\nB", "A\n\nB");
	test("A\n\n<!--Comment-->\n<!--Comment-->\n\nB", "A\n\nB");
	test("A\n\n<!--Comment-->\n\n<!--Comment-->\n\nB", "A\n\nB");
	// whitespace that's not linefeeds
	test("A\n\n<!--Comment--> \n\nB", "A\n\n \n\nB");
	test("\\whitespace trim\nA\n\n<!--Comment--> \n\nB", "A\n\n \n\nB");
	// Pesky carriage-returns
	test("A\r\n\r\n<!--Comment-->\r\n\r\nB", "A\n\nB");
});

it('pragma', function() {
	test("<!--Comment-->\n\n\\define m( ) M\n<<m>>", "\\define m()M\n<<m>>");
	test("<!--Comment-->\r\n\\define m( ) M\r\n<<m>>", "\\define m()M\n<<m>>");
});

});});
