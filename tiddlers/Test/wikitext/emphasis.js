/*\
title: Test/wikitext/emphasis.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with ''bold'', //italics//, and others

\*/

describe('wikitext uglifier', function() {
describe('emphasis', function() {

const test = $tw.utils.test.wikitext.test;
const t = "\\whitespace trim\n";


it('all the different kinds', function() {
	test("''<$text text='A'/>''\n\nB", "''<$text text=A/>''\n\nB");
	test("//<$text text='A'/>//\n\nB", "//<$text text=A/>//\n\nB");
	test("~~<$text text='A'/>~~\n\nB", "~~<$text text=A/>~~\n\nB");
	test(",,<$text text='A'/>,,\n\nB", ",,<$text text=A/>,,\n\nB");
	test("^^<$text text='A'/>^^\n\nB", "^^<$text text=A/>^^\n\nB");
	test("__<$text text='A'/>__\n\nB", "__<$text text=A/>__\n\nB");
});

it('drops tails', function() {
	test("//<$text text='A'/>//", "//<$text text=A/>");
	test("<div>//<$text text='A'/>//</div>", "<div>//<$text text=A/>");
	test("<div>//<span><$reveal /></span>//</div>", "<div>//<span><$reveal/>");
	test("//\n\n<$text text='A'/>\n\n//", "//\n\n<$text text=A/>\n\n");
});

it('handles carriage returns', function() {
	test("//\r\n\r\n<$text text='A'/>\r\n\r\n//", "//\n\n<$text text=A/>\n\n");
});

it('whitespace trim', function() {
	test(t+"//\n\n<$text text='A'/>\n\n//\n\nContent",
	     "//<$text text=A/>//\n\nContent");
	test("\\define M(x)\n"+t+"//\n\n$x$\n\n//\n\\end\n<<M  '<$reveal/>'>>",
	     "\\define M(x)\n"+t+"//\n\n$x$\n\n//\n\\end\n<<M '<$reveal/>'>>");
	test("\\define M(x)\n"+t+"//\n\nx\n\n//\n\\end\n<<M  '<$reveal/>'>>",
	     "\\define M(x)//x\n<<M '<$reveal/>'>>");
});

it('can handle missing close', function() {
	test("Content\n\n//<$text text='Italics'/>", "Content\n\n//<$text text=Italics/>");
});

});});
