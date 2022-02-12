/*\
title: Test/wikitext/html/nested.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with html attributes
which contain more wikitext.

\*/

describe('wikitext uglifier', function() {
describe('html', function() {
describe('nested', function() {

const test = $tw.utils.test.wikitext.test;

///// Wikitext

it('works', function() {
	test('<$list filter="" emptyMessage="""<$text text="Empty"/>"""/>',
		'<$list filter=""emptyMessage="<$text text=Empty/>"/>');
	test('<$range actionsStop="""<$text text="Empty"/>"""/>',
		'<$range actionsStop="<$text text=Empty/>"/>');
});

it('maintains its own quotation context', function() {
	// The apostrophe in the main text shouldn't let the
	// nested wikitext think it's okay to use an apostrophe.
	test("<$list filter='' emptyMessage='<$text  text=\"with space\"/>'/>",
		"<$list filter=''emptyMessage='<$text text=\"with space\"/>'/>");
});

it('handles placeholders', function() {
	test('\\define m(f)<$list filter="" emptyMessage="""<$text  text=\'$f$\'/>"""/>\n<<m \'qu"ot\'>>',
		'\\define m(f)<$list filter=\'\'emptyMessage="""<$text text=\'$f$\'/>"""/>\n<<m \'qu"ot\'>>');
});

it('handles edge case with ending quotes and whitespace trimming', function() {
	test('<$wikify text=""""L\'X" """ name=val><<val>></$wikify>',
	     '<$wikify text=""""L\'X" """name=val><<val>>');
	test('<$wikify text="""\\whitespace trim\n"L\'X"  """ name=val><<val>></$wikify>',
	     '<$wikify text=""""L\'X&quot;"""name=val><<val>>');
	// Super special case. We can just add a space to the end of the inner
	// wikitext because we know the \\whitespace pragma will remain, so that
	// space will be removed. This is tighter than adding &quot;
	test('\\define A(z)\n<$wikify text="""\\whitespace trim\n $z${{!!title}}"L\'X"  """ name=val><<val>></$wikify>\n\\end\n<<A cat>>',
	     '\\define A(z)\n<$wikify text="""\\whitespace trim\n$z${{!!title}}"L\'X" """name=val><<val>>\n\\end\n<<A cat>>');
});

it('handles edge case with ending quotes on end of block', function() {
	// Those trailing double newlines can't be removed
	test('<$wikify text="""Text\n\n\n"L\'X"\n\n""" name=val><<val>></$wikify>',
	     '<$wikify text="""Text\n\n"L\'X"\n\n"""name=val><<val>>');
	test('<$wikify text="""\\whitespace trim\nText \n\n\n"L\'X"\n\n""" name=val><<val>></$wikify>',
	     '<$wikify text="""Text\n\n"L\'X"\n\n"""name=val><<val>>');
});

it('handles edge case with ending quotes and tail cutting', function() {
	test('<$wikify text="""<span>"L\'X"</span>""" name=val><<val>></$wikify>',
	     '<$wikify text="""<span>"L\'X"</span>"""name=val><<val>>');
	test('<$wikify text="""<span>"L\'X" </span>""" name=val><<val>></$wikify>',
	     '<$wikify text="""<span>"L\'X" """name=val><<val>>');
	test('<$wikify text="""\\whitespace trim\n<span>"L\'X" </span>""" name=val><<val>></$wikify>',
	     '<$wikify text="""<span>"L\'X"</span>"""name=val><<val>>');
});

//// Filters

it('handles filter attributes', function() {
	test('<$count filter="A  B  C"/>', '<$count filter="A B C"/>');
	// indirects shouldn't be touched
	test('<$count filter={{A  B  A!!title}}/>', '<$count filter={{A  B  A!!title}}/>');
	// variable attrs should not be touched
	test('\\define M(a b)$a$-$b$-C\n<$count filter=<<M "x y" [title[z]]>>/>',
	     '\\define M(a b)$a$-$b$-C\n<$count filter=<<M [[x y]][title[z]]>>/>');
});

it('handles broken filters', function() {
	test('<$count filter=[all[ />', '<$count filter=[all[/>');
});

it('handles both filter and wikitext attributes', function() {
	test('<$list filter="A  -A" emptyMessage="<$text  text=nope />"/>',
	     '<$list filter="A -A"emptyMessage="<$text text=nope/>"/>');
	// If one does not compress, does not stop the other attr from doing so
	test('<$list filter="[all[" emptyMessage="<$text  text=nope />"/>',
	     '<$list emptyMessage="<$text text=nope/>"filter=[all[/>');
});

});});});
