/*\
title: Test/wikitext/macrocall.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with macrocalls.

\*/

describe('wikitext uglifier', function() {
describe('macrocall', function() {

const test = $tw.utils.test.wikitext.test;
const m = "\\define m(val t f)Output:$val$,$t$,$f$\n";

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
});

it('parameters values', function() {
	// params quotation
	test(m+"<<m \"cat\">>", m+"<<m cat>>");
	test(m+"<<m \"$$\">>", m+"<<m $$>>"); // zero placeholders test
	test(m+"<<m \"bad>char\">>", m+"<<m \"bad>char\">>");
	test(m+"B's<<m \"bad'char\">>", m+"B's<<m \"bad'char\">>");
	test(m+"<<m \"cat dog\">>", m+"<<m \"cat dog\">>");
	test(m+"B's<<m \"cat dog\">>", m+"B's<<m 'cat dog'>>");
	test(m+'<<m """bad"char""">>', m+'<<m """bad"char""">>');
	test(m+"<<m 'bad\"char'>>", m+"<<m 'bad\"char'>>");
	// param brackets
	test(m+"[[link]]<<m \"cat dog\">>", m+"[[link]]<<m [[cat dog]]>>");
	test(m+"[[link]]<<m \"bra ]ket\">>", m+"[[link]]<<m \"bra ]ket\">>");
	test(m+"[[link]]<<m \"bra [ket\">>", m+"[[link]]<<m [[bra [ket]]>>");
	test(m+'[[l]]<<m "bra ]]ket" "a b">>', m+'[[l]]<<m "bra ]]ket" [[a b]]>>');
});

it('empty parameters', function() {
	test(m+'<<m val:"">>', m+'<<m val:"">>');
	test(m+"<<m val:''>>", m+"<<m val:''>>");
	test(m+"<<m val:[[]]>>", m+'<<m val:[[]]>>');
});

});});
