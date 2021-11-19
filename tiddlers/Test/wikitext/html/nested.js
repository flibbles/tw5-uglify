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

it('works', function() {
	test('<$list filter="" emptyMessage="""<$text text="Empty"/>"""/>',
		'<$list filter="" emptyMessage="<$text text=Empty/>"/>');
	test('<$range actionsStop="""<$text text="Empty"/>"""/>',
		'<$range actionsStop="<$text text=Empty/>"/>');
});

it('maintains its own quotation context', function() {
	// The apostrophe in the main text shouldn't let the
	// nested wikitext think it's okay to use an apostrophe.
	test("<$list filter='' emptyMessage='<$text  text=\"with space\"/>'/>",
		"<$list filter='' emptyMessage='<$text text=\"with space\"/>'/>");
});

it('handles placeholders', function() {
	test('\\define m(f)<$list filter="" emptyMessage="""<$text  text=\'$f$\'/>"""/>\n<<m \'qu"ot\'>>',
		'\\define m(f)<$list filter=\'\' emptyMessage="""<$text text=\'$f$\'/>"""/>\n<<m \'qu"ot\'>>');
});

});});});
