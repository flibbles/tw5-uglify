/*\
title: Test/wikitext/fnprocdef.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with function pragma.

\*/

describe('wikitext uglifier', function() {
describe('fnprocdef', function() {

const test = $tw.utils.test.wikitext.test;

it('empty', function() {
	test("\\function m()\n\nContent", "\\function m()\nContent");
	test("\\define m()    \nContent", "\\define m()\nContent");
});

it('odd', function() {
	test("\\function m() bad\n\\end\n\nStuff", "\\function m()bad\n\\end\n\nStuff");
});

it('string parameters', function() {
	test("\\function m(A) [<A>]\n<<m value>>", "\\function m(A)[<A>]\n<<m value>>");
	test("\\function m(A, B) [<A>addsuffix<B>]\n<<m v c>>", "\\function m(A B)[<A>addsuffix<B>]\n<<m v c>>");
	test("\\function m(A:  'love') [<A>]\n<<m>>", "\\function m(A:love)[<A>]\n<<m>>");
	test("\\function m(A:'a<>b') [<A>]\n<<m>>", "\\function m(A:'a<>b')[<A>]\n<<m>>");
	test("\\function m(A:'a<>b') [<A>]\n<<m>>", "\\function m(A:'a<>b')[<A>]\n<<m>>");
	test("\\function m(A:\"l h\") [<A>]\n<<m>>", "\\function m(A:\"l h\")[<A>]\n<<m>>");
	test("\\function m(A:\"l h\") [<A>]\n<<m>>'", "\\function m(A:'l h')[<A>]\n<<m>>'");
	test("\\function m(A:\"l h\") [<A>]\n<<m>>[[l]]", "\\function m(A:\"l h\")[<A>]\n<<m>>[[l]]");
	test("\\function m(A:\"l [h\") [<A>]\n<<m>>[[l]]", "\\function m(A:\"l [h\")[<A>]\n<<m>>[[l]]");
	test("\\function m(A:\"l ]h\") [<A>]\n<<m>>[[l]]", "\\function m(A:\"l ]h\")[<A>]\n<<m>>[[l]]");
	test("\\function m(A:\"l[[h]]\") [<A>]\n<<m>>[[l]]", "\\function m(A:l[[h]])[<A>]\n<<m>>[[l]]");
});

it('function optimizes filters', function() {
	test("\\function m(A)\n[<A>]\ndogs\n+[join[]]\n\\end\n<<m cats>>",
	     "\\function m(A)[<A>]dogs +[join[]]\n<<m cats>>");
	test("\\function m(A)  [<A>]  dogs  +[join[]]\n<<m cats>>",
	     "\\function m(A)[<A>]dogs +[join[]]\n<<m cats>>");
});

it('procedure optimizes wikitext content', function() {
	test("\\procedure m(A)\n<$text\n\ttext=<<A>> />\n\\end\n<<m cats>>",
	     "\\procedure m(A)<$text text=<<A>>/>\n<<m cats>>");
	test("\\procedure m(A)  <$text  text=<<A>> />\n<<m cats>>",
	     "\\procedure m(A)<$text text=<<A>>/>\n<<m cats>>");
});

it('widgets optimize wikitext content', function() {
	test("\\widget $w.m(A)\n<$text\ntext=<<A>> /> <$slot $name='ts-raw'/>\n\\end\n<$w.m A=cats />",
	     "\\widget $w.m(A)<$text text=<<A>>/> <$slot $name=ts-raw/>\n<$w.m A=cats/>");
});

it('handles named \\end syntax', function() {
	test('\\procedure outer(B)\n\\procedure inner(A)\n<$reveal>\n\n<<A>></$reveal>\n\\end   inner\n<<B>> <<inner cats>>\n\\end\n<<outer Content>>',
	     '\\procedure outer(B)\n\\procedure inner(A)\n<$reveal>\n\n<<A>></$reveal>\n\\end inner\n<<B>> <<inner cats>>\n\\end\n<<outer Content>>');
});

it('newlines before \\end', function() {
	test('\\procedure F(A)\n<$reveal>\n\n<<A>></$reveal>\n\n\\end\n<<F Content>>',
	     '\\procedure F(A)\n<$reveal>\n\n<<A>></$reveal>\n\\end\n<<F Content>>');
});

});});
