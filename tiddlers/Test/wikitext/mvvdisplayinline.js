/*\
title: Test/wikitext/mvvdisplayinline.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with the multi-value variables parser rule.

\*/

describe('wikitext uglifier', function() {

// We only run these tests if we're working with a TW version that has these
($tw.utils.test.mvvPresent()? describe: xdescribe)('mvvdisplayinline', function() {

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

it('empty placeholders do not muck with variables', function() {
	const execute = "\n<$let X={{{A B}}}>\n\n<<M>>";
	// Trimming placeholders with filtered transcludes is dangerous,
	// Same with mvv, but all we need to retain is one space
	test('\\define M(x)(($x$  ))'+execute, '\\define M(x)(($x$ ))'+execute);
	test('\\define M(x)(($x$  ||))'+execute, '\\define M(x)(($x$ ||))'+execute);
	test('\\define M(x)((  $x$))'+execute, '\\define M(x)(($x$ ))'+execute);
	test('\\define M(x)(($x$))'+execute, '\\define M(x)(($x$))'+execute);
});

it('empty placeholders do not muck with filters', function() {
	// Trimming placeholders with filtered transcludes is dangerous,
	// Same with mvv, but all we need to retain is one space
	test('\\define M(x)((($x$   )))\n<<M>>', '\\define M(x)((($x$ )))\n<<M>>');
	test('\\define M(x)((($x$  ||)))\n<<M>>',
	     '\\define M(x)((($x$ ||)))\n<<M>>');
	test('\\define M(x)(((  $x$)))\n<<M>>', '\\define M(x)((($x$ )))\n<<M>>');
	test('\\define M(x)((($x$)))\n<<M>>', '\\define M(x)((($x$)))\n<<M>>');
});

it('presence of placeholder context does not muff filter trimming', function() {
	test('\\define M(x)((( $x$  B )))\n<<M>>',
	     '\\define M(x)((($x$ B)))\n<<M>>');
});

});});
