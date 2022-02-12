/*\
title: Test/wikitext/macrocall.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with macrocalls.

\*/

describe('wikitext uglifier', function() {
describe('macrocall', function() {

const test = $tw.utils.test.wikitext.test;
const cmp = $tw.utils.test.wikitext.cmp;
const m = "\\define m(val t f)\nOutput\n\n$val$,$t$,$f$\n\\end\n";

it('whitespace around invocation', function() {
	test(m+"<<m    >>", m+"<<m>>");
	test(m+"B<<m>>A", m+"B<<m>>A");
	test(m+"B\n\n<<m>>\n\nA", m+"B\n\n<<m>>\n\nA");
	test(m+"<<m>>\nA", m+"<<m>>\nA");
});

it('whitespace among parameters', function() {
	test(m+"<<m  dfd  as  >>", m+"<<m dfd as>>");
	test(m+"<<m\nparam\nstuff>>", m+"<<m param stuff>>");
	test(m+"<<m  val  :   dad  >>", m+"<<m val:dad>>");
	test(m+"<<m  dad\n\tval:sis\n\tbro >>", m+"<<m dad val:sis bro>>");
	// Quotation involved
	test(m+"<<m  'd d'  as  >>", m+"<<m'd d'as>>");
	test(m+'<<m  "d d"  as  >>', m+'<<m"d d"as>>');
	test(m+'<<m  [[d d]]  as  >>', m+'<<m [[d d]]as>>');
	test(m+"<<m  dad  'a s'  >>", m+"<<m dad'a s'>>");
	test(m+"<<m  dad  t:'a s'  >>", m+"<<m dad t:'a s'>>");
	test(m+"<<m  'd d'\n\tval:'s s'\n\tbro >>", m+"<<m'd d'val:'s s'bro>>");
});

it('carrots inside simple value', function() {
	test(m+'<<m "ca>>ots" >>', m+'<<m"ca>>ots">>');
	test(m+'<<m "ca>ots" >>', m+'<<m"ca>ots">>');
});

it('brackets inside simple value', function() {
	test(m+'<<m "[[brackets]]" >>', m+'<<m"[[brackets]]">>');
	test(m+'<<m "[[brac]]kets" >>', m+'<<m"[[brac]]kets">>');
	test(m+'<<m "[brackets]]" >>', m+'<<m [brackets]]>>');
	// The quotes on this one COULD be removed, but it's dangerous...
	test(m+'<<m "[[brackets]" >>', m+'<<m"[[brackets]">>');
	// ... because of cases like this.
	test(m+'<<m "[[brackets" close]]>>', m+'<<m [[[[brackets]]close]]>>');
});

it('parameters values', function() {
	// params quotation
	test(m+"<<m \"cat\">>", m+"<<m cat>>");
	test(m+"<<m \"$$\">>", m+"<<m $$>>"); // zero placeholders test
	test(m+"<<m \"bad>char\">>", m+"<<m\"bad>char\">>");
	test(m+"B's<<m \"bad'char\">>", m+"B's<<m\"bad'char\">>");
	test(m+"<<m \"cat dog\">>", m+"<<m\"cat dog\">>");
	test(m+"B's<<m \"cat dog\">>", m+"B's<<m'cat dog'>>");
	test(m+'<<m """bad"char""">>', m+'<<m"""bad"char""">>');
	test(m+"<<m 'bad\"char'>>", m+"<<m'bad\"char'>>");
	// param brackets
	test(m+"[[link]]<<m \"cat dog\">>", m+"[[link]]<<m [[cat dog]]>>");
	test(m+"[[link]]<<m \"bra ]ket\">>", m+"[[link]]<<m\"bra ]ket\">>");
	test(m+"[[link]]<<m \"bra [ket\">>", m+"[[link]]<<m [[bra [ket]]>>");
	test(m+'[[l]]<<m "bra ]]ket" "a b">>', m+'[[l]]<<m"bra ]]ket"[[a b]]>>');
});

it('empty parameters', function() {
	test(m+'<<m val:"">>', m+'<<m val:"">>');
	test(m+"<<m val:''>>", m+"<<m val:''>>");
	test(m+"<<m val:[[]]>>", m+'<<m val:[[]]>>');
});

it('trailing newline or EOF in widgets', function() {
	// Like with widgets, macrocalls are sensitive to trailing newlines.
	// They are considered blocks if they're followed by \n OR EOF.
	// This means if a macrocall is inline because it's followed by
	// something, that something can't be trimmed.
	const p = "\\define p(v)$v$\n";
	const t = "\\whitespace trim\n";
	test(m+'<div>\n\n<<m "x\n\ny">></div>',m+'<div>\n\n<<m"x\n\ny">></div>');
	test(m+'<div>\n\n<<m "x\n\ny">>\n</div>',m+'<div>\n\n<<m"x\n\ny">>');
	test(m+'<div>\n\n<<m "x\n\ny">></div>\n',m+'<div>\n\n<<m"x\n\ny">></div>');
	test(m+t+'<div>\n\n<<m "x\n\ny">></div>',m+'<div>\n\n<<m"x\n\ny">></div>');
	test(m+t+'<div>\n\n<<m "x\n\ny">>\n</div>',m+'<div>\n\n<<m"x\n\ny">>');
	test(m+t+'<div>\n\n<<m "x\n\ny">></div>\n',m+'<div>\n\n<<m"x\n\ny">></div>');
	test(m+'<div>\n<<m "x\n\ny">></div>',m+'<div>\n<<m"x\n\ny">>');
	test(m+'<div>\n<<m "x\n\ny">>\n</div>',m+'<div>\n<<m"x\n\ny">>\n');
	test(m+'<div>\n<<m "x\n\ny">></div>\n',m+'<div>\n<<m"x\n\ny">></div>\n');
	test(m+t+'<div>\n<<m "x\n\ny">></div>',m+'<div><<m"x\n\ny">>');
	test(m+t+'<div>\n<<m "x\n\ny">>\n</div>',m+'<div><<m"x\n\ny">>');
	test(m+t+'<div>\n<<m "x\n\ny">></div>\n',m+'<div><<m"x\n\ny">>');
});

it('trailing newline or EOF and comments', function() {
	const p = "\\define p(v)$v$\n";
	const t = "\\whitespace trim\n";
	test(  m+'<<m "x\n\ny">><!--C-->', m+'<<m"x\n\ny">><!---->');
	test(  m+'<<m "x\n\ny">><!--C-->X', m+'<<m"x\n\ny">>X');
	test(  m+'<<m "x\n\ny">><!--C-->\n', m+'<<m"x\n\ny">><!---->\n');
	test(t+m+'<<m "x\n\ny">><!--C-->\n', m+'<<m"x\n\ny">><!---->');
	test(  m+'<<m "x\r\n\r\ny">><!--C-->\r\n', m+'<<m"x\r\n\r\ny">><!---->\n');
	test(t+m+'<<m "x\r\n\r\ny">><!--C-->\r\n', m+'<<m"x\r\n\r\ny">><!---->');
	test(  m+'<<m "x\n\ny">><!--C-->\n\n', m+'<<m"x\n\ny">><!---->')
	test(t+m+'<<m "x\n\ny">><!--C-->\n\n', m+'<<m"x\n\ny">><!---->');
	test(  m+'<<m "x\n\ny">><!--C-->\n\nX', m+'<<m"x\n\ny">><!---->\n\nX')
	test(t+m+'<<m "x\n\ny">><!--C-->\n\nX', m+'<<m"x\n\ny">><!---->\n\nX');
	test(  m+'<<m "x\n\ny">>X<!--C-->\n\nX', m+'<<m"x\n\ny">>X\n\nX')
	test(t+m+'<<m "x\n\ny">>X<!--C-->\n\nX', m+'<<m"x\n\ny">>X\n\nX');
	test(  m+'G\n<<m "x\n\ny">><!--C-->', m+'G\n<<m"x\n\ny">>');
	test(  m+'G\n<<m "x\n\ny">><!--C-->X', m+'G\n<<m"x\n\ny">>X');
	test(  m+'G\n<<m "x\n\ny">><!--C-->\n', m+'G\n<<m"x\n\ny">>\n');
});

});});
