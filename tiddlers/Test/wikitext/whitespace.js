/*\
title: Test/wikitext/whitespace.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with whitespace and whitespace trimming.

\*/

describe('wikitext uglifier', function() {
describe('whitespace', function() {

const test = $tw.utils.test.wikitext.test;
const cmp = $tw.utils.test.wikitext.cmp;
const t = "\\whitespace trim\n";
const nt = "\\whitespace notrim\n";

it('purges carriage returns when it can', function() {
	test('A\r\nB', 'A\nB');
	test('A\r\n\r\nB', 'A\n\nB');
});

it('trims', function() {
	test("\\whitespace trim\n\n\n''Content''\n\n\n", "''Content''");
	test("\\whitespace trim\n<div>\n\t''Text''\n</div>", "<div>''Text''");
	test("\\whitespace trim\n<div>\n\nText\n</div>", "<div>\n\nText");
});

it('weird arguments', function() {
	test("\\whitespace whatevs\nContent  //B//", "Content  //B//");
	test("\\whitespace whatevs trim\nContent  //B//", "Content//B//");
	test("\\whitespace trim whatevs\nContent  //B//", "Content//B//");
	test("\\whitespace trim notrim\nContent  //B//", "Content  //B//");
});

it('trims around blocks', function() {
	test(  "A\n\n\nB", "A\n\n\nB");
	test(t+"A\n\n\nB", "A\n\nB");
	test(  "A\r\n\r\n\r\nB", "A\n\n\nB");
	test(t+"A\r\n\r\n\r\nB", "A\n\nB");
	test(  "A\n\n \n\nB", "A\n\n \n\nB");
	test(t+"A\n\n \n\nB", "A\n\nB");
	test(  " A\n\n\nB", " A\n\n\nB");
	test(t+" A\n\n\nB", "A\n\nB");
});

it('whitespace with no pragma', function() {
	// These are special cases. Without pragma, we need to assume
	// the wikitext might be plaintext, either in a macro which becomes
	// an attribute, or as a tiddler which should be flagged as
	// text/plain, but isn't.
	test(  "\n\nText", "\n\nText");
	test(t+"\n\nText", "Text");
	test(  "\nText", "\nText");
	test(t+"\nText", "Text");
	test(  "  Text", "  Text");
	test(t+"  Text", "Text");
	test(  "\n  Text", "\n  Text");
	test(t+"\n  Text", "Text");
	test(  "\r\n  Text", "\n  Text");
	test(t+"\r\n  Text", "Text");
	test(  "\r\nText", "\nText");
	test(t+"\r\nText", "Text");
	test(  "\r\n\r\nText", "\n\nText");
	test(t+"\r\n\r\nText", "Text");
});

it('whitespace after pragma', function() {
	const rule = "\\rules except wikitext\n";
	test(  rule+"\n\nText", rule+"Text");
	test(t+rule+"\n\nText", rule+"Text");
	test(  rule+"\n  Text", rule+"Text");
	test(t+rule+"\n  Text", rule+"Text");
	test(  rule+"\n\n  Text", rule+"Text");
	test(t+rule+"\n\n  Text", rule+"Text");
	test(  rule+"\r\nText", rule+"Text");
	test(t+rule+"\r\nText", rule+"Text");
	test(  rule+"\r\n\r\nText", rule+"Text");
	test(t+rule+"\r\n\r\nText", rule+"Text");
});

it('whitespace before pragma', function() {
	const rule = "\\rules except wikitext\n";
	test("\n\n"+rule+"Text", rule+"Text");
	test("\r\n"+rule+"Text", rule+"Text");
	test("\r\n\r\n"+rule+"Text", rule+"Text");
});

it('cannot be trimmed for sure around placeholders', function() {
	// notice how the \whitespace trim isn't going away?
	test("\\define m(v)\n\\whitespace trim\n<div>\n\t<span>$v$</span>\n</div>\n\\end\n<<m [[''fancy'' content]]>>",
		"\\define m(v)\n\\whitespace trim\n<div><span>$v$</span>\n\\end\n<<m [[''fancy'' content]]>>");
	test("\\define m(v)\n\\whitespace trim\n<div>\n\n\t<span>\n\n$v$\n</span></div>\n\\end\n<<m [[* ''fancy'' content]]>>",
		"\\define m(v)\n\\whitespace trim\n<div>\n\n<span>\n\n$v$\n</span>\n\\end\n<<m [[* ''fancy'' content]]>>");
});

it('multiple pragma', function() {
	test(t+nt+"<div>\n\tText\n</div>", "<div>\n\tText\n");
	test(nt+t+"<div>\n\tText\n</div>", "<div>Text");
});

});});
