/*\
title: Test/wikitext/mvvdisplayinline.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with the multi-value variables parser rule.

\*/

const mmvPresent = $tw.wiki.renderText(null, null, "(((yes)))") === "yes";

describe('wikitext uglifier', function() {

// We only run these tests if we're working with a TW version that has these
(mmvPresent? describe: xdescribe)('mvvdisplayinline', function() {

const test = $tw.utils.test.wikitext.test;

it('tightens up simple variable', function() {
	const prefix = "<$let X={{{A B}}}>";
	test(prefix+'((X ))', prefix+'((X))');
	test(prefix+'((X\n\t ))', prefix+'((X))');
	test(prefix+'\n\n((X ))', prefix+'\n\n((X))');
	test(prefix+'\n\n((X ))\n', prefix+'\n\n((X))\n');
	test('\\whitespace trim\n'+prefix+'\n\n((X ))\n', prefix+'\n\n((X))');
});

it('tightens up custom separator variable', function() {
	const prefix = "<$let X={{{A B}}}>";
	test(prefix+'((X ||))', prefix+'((X||))');
	test(prefix+'((X ||  c  ))', prefix+'((X||  c  ))');
	test(prefix+'((X\n\t ||c))', prefix+'((X||c))');
});

it('tightens up simple filter', function() {
	const prefix = "<$button>";
	test(prefix+'((( A B )))', prefix+'(((A B)))');
	test(prefix+'((( A B\n\t  )))', prefix+'(((A B)))');
	test(prefix+'\n\n((( A B )))', prefix+'\n\n(((A B)))');
	test(prefix+'\n\n((( A B )))\n', prefix+'\n\n(((A B)))\n');
	test('\\whitespace trim\n'+prefix+'\n\n((( A B )))\n',
	     prefix+'\n\n(((A B)))');
});

it('tightens up simple filter', function() {
	test('((( A B ||)))', '(((A B||)))');
	test('((( A B ||  c  )))', '(((A B||  c  )))');
	test('((( A B\n\t  ||c)))', '(((A B||c)))');
});

});});
