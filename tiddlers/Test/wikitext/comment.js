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
	test("\\whitespace trim\nFirst <!--comment-->\ntext", "Firsttext");
});

it('only comments', function() {
	test("<!-- Comment -->", "");
	test("<!-- Comment -->\n\n", "");
	test("\n\n<!-- Comment -->", "");
	test("<!-- Comment -->", "");
});

it('inline filling a line might have to stay', function() {
	test("<div>\n\tText\n\t<!--Comment-->\n</div>", "<div>\n\tText\n\t\n");
	test("\\whitespace trim\n<div>\n\tText\n\t<!--C-->\n</div>", "<div>Text");
	test("Text\n<!--Comment-->\n\nsecond", "Text\n<!---->\n\nsecond");
	test("\\whitespace trim\nText\n<!--Comment-->\n\nsecond", "Text\n\nsecond");
	test("Text\n<!--Comment--> \n\nsecond", "Text\n \n\nsecond");
	test("\\whitespace trim\nText\n<!--stuff--> \n\nsecond", "Text\n\nsecond");
	test("Text\n <!--Comment-->\n\nsecond", "Text\n \n\nsecond");
	test("\\whitespace trim\nText\n <!--stuff-->\n\nsecond", "Text\n\nsecond");
});

it('inline that are sequential', function() {
	// Sequential comments can goof pruning
	test("<div>\n\nFirst\n<!--1--><!--2-->\nsecond\n</div>",
		"<div>\n\nFirst\n<!---->\nsecond\n");
	test("<div>\n\nFirst\n<!--1--><!--2--><!--3-->\nsecond\n</div>",
		"<div>\n\nFirst\n<!---->\nsecond\n");
	test("<div>\n\nFirst\n<!--1--><!--2--> <!--3-->\nsecond\n</div>",
		"<div>\n\nFirst\n \nsecond\n");
});

it('inline on sequential lines', function() {
	// Lines of comments can't prune very well without whitespace trimming
	test("First\n<!--1-->\n<!--2-->\ntext", "First\n<!---->\n<!---->\ntext");
	test("\\whitespace trim\nFirst\n<!--1-->\n<!--2-->\ntext", "Firsttext");
});

it('inline does not splice or create blocks', function() {
	test("<div>\n\nFirst\n<!--Comment-->\nsecond\n</div>",
		"<div>\n\nFirst\n<!---->\nsecond\n");
	test("\\whitespace trim\n<div>\n\nFirst\n<!--Comment-->\nsecond\n</div>",
		"<div>\n\nFirstsecond");
	test("<div>\n<!--Comment-->\nText\n</div>", "<div>\n<!---->\nText\n");
	test("\\whitespace trim\n<div>\n<!--Comment-->\nText\n</div>", "<div>Text");
	test("First\n<!--1--> \nText", "First\n \nText");
	test("\\whitespace trim\nFirst\n<!--1--> \ntext", "Firsttext");
	test("First\n <!--1-->\ntext", "First\n \ntext");
	test("\\whitespace trim\nFirst\n <!--1-->\ntext", "Firsttext");
	// Pesky carriage-returns
	test("<div>\r\n<!--comment-->\r\nText\r\n</div>", "<div>\n<!---->\nText\n");
	test("\\whitespace trim\r\n<div>\r\n<!--comment-->\r\nText\r\n</div>", "<div>Text");
	test("A\r\n<!--comment-->\r\nB", "A\n<!---->\nB");
});

// See git issue #14
it('inline does not create blocks given following newlines', function() {
	test(  "<table>\n\t<!-- comment -->\n\t<tr>Line",
	       "<table>\n\t<!---->\n\t<tr>Line");
	test(  "\t<!-- comment -->\n\t<tr>Line",
	       "\n<tr>Line");
	test(t+"<table>\n\t<!-- comment -->\n\t<tr>Line",
	       "<table><tr>Line");
	test(t+"\t<!-- comment -->\n\t<tr>Line",
	       "\n<tr>Line");
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
	test(  "<div>\n\n<$reveal/>\n<!--c--></div>","<div>\n\n<$reveal/>\n<!---->");
	test(t+"<div>\n\n<$reveal/>\n<!--c--></div>","<div>\n\n<$reveal/>");
});

it('separating widgets from placeholders', function() {
	test("\\define M(x)\n<$reveal/><!--c-->\n$x$\n\\end\n<<M '\nph'>>",
	     "\\define M(x)\n<$reveal/><!---->\n$x$\n\\end\n<<M'\nph'>>");
});

it('block', function() {
	test(  "<div>\n\n<!--Comment-->\nText\n</div>", "<div>\n\nText\n");
	test(t+"<div>\n\n<!--Comment-->\nText\n</div>", "<div>\n\nText");
	test(  "<div>\n\n<!--Comment-->Text\n</div>", "<div>\n\nText\n");
	test(t+"<div>\n\n<!--Comment-->Text\n</div>", "<div>\n\nText");
	test(  "A\n\n<!--Comment-->\n\nB", "A\n\nB");
	test(  "A\n\n<!--Comment-->\n\n\n\nB", "A\n\nB");
	test(  "A\n\n<!--Comment--><!--Comment-->\n\nB", "A\n\nB");
	test(  "A\n\n<!--Comment-->\n<!--Comment-->\n\nB", "A\n\nB");
	test(  "A\n\n<!--Comment-->\n\n<!--Comment-->\n\nB", "A\n\nB");
	// whitespace that's not linefeeds
	test(  "A\n\n<!--Comment--> \n\nB", "A\n\nB");
	test(t+"A\n\n<!--Comment--> \n\nB", "A\n\nB");
	test(  "A\n\n <!--Comment-->\n\nB", "A\n\nB");
	test(t+"A\n\n <!--Comment-->\n\nB", "A\n\nB");
	// Pesky carriage-returns
	test(  "A\r\n\r\n<!--Comment-->\r\n\r\nB", "A\n\nB");
});

it('pragma', function() {
	test("<!--Comment-->\n\n\\define m( ) M\n<<m>>", "\\define m()M\n<<m>>");
	test("<!--Comment-->\r\n\\define m( ) M\r\n<<m>>", "\\define m()M\n<<m>>");
	test("\\define s()S\n\n<!--Comment-->\n\n\\define m( ) M\n<<m>>", "\\define s()S\n\\define m()M\n<<m>>");
	test("\\define s()S\r\n\r\n<!--Comment-->\r\n\r\n\\define m( ) M\n<<m>>", "\\define s()S\n\\define m()M\n<<m>>");
	// And if it's the ONLY pragma
	test("\n\n<!--Comment-->\n\nText", "Text");
});

});});
