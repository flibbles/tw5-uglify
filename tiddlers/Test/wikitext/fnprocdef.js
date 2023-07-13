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
});

});});
