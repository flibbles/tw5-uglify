/*\
title: Test/wikitext/import.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with whitespace and whitespace trimming.

\*/

describe('wikitext uglifier', function() {
describe('import', function() {

const test = $tw.utils.test.wikitext.test;

it('trims lines around import pragma', function() {
	test('\\define A() A\n\\import X\n\\define B() B',
	     '\\define A()A\n\\import X\n\\define B()B');
	test('\\define A() A\n\n\\import X\n\n\\define B() B',
	     '\\define A()A\n\\import X\n\\define B()B');
	// carriage returns
	test('\\define A() A\r\n\\import X\r\n\\define B() B',
	     '\\define A()A\n\\import X\n\\define B()B');
	test('\\define A() A\r\n\r\n\\import X\r\n\r\n\\define B() B',
	     '\\define A()A\n\\import X\n\\define B()B');
	test('\\whitespace trim\n\\import X\nText',
	     '\\import X\nText');
	test('\\whitespace trim\n\n\\import X\n\nText',
	     '\\import X\nText');
	test('\\import X\n\\whitespace trim\nText',
	     '\\import X\nText');
	test('\\import X\n\n\\whitespace trim\n\nText',
	     '\\import X\nText');
});

it('with nothing following', function() {
	test('\\import X', '\\import X');
	test('\\import X\n', '\\import X');
	test('\\import X\r\n', '\\import X');
	test('\\import X\n\n', '\\import X');
	test('\\import X\r\n\r\n', '\\import X');
});

it('with blocks following', function() {
	test('\\import X\n<$reveal />\n', '\\import X\n<$reveal/>\n');
	test('\\import X\n\n<$reveal />\n', '\\import X\n<$reveal/>\n');
	test('\\import X\r\n<$reveal />\r\n', '\\import X\n<$reveal/>\n');
	test('\\import X\r\n\r\n<$reveal />\r\n', '\\import X\n<$reveal/>\n');
});

it('empty', function() {
	// This one still shows up.
	test('\\define A() A\n\\import\n\\define B() B',
	     '\\define A()A\n\\import\n\\define B() B');
	test('\\define A() A\n\\import \n\\define B() B',
	     '\\define A()A\n\\define B()B');
	test('\\define A() A\n\\import    \n\\define B() B',
	     '\\define A()A\n\\define B()B');
	test('\\import \nText', 'Text');
	test('\\import ', '');
	test('\\import \n', '');
	test('\\import \n\n\n', '');
	test('\\import   ', '');
	test('\\import', '\\import');
});

it('trims its filter', function() {
	test('\\import A  B\nText', '\\import A B\nText');
});

});});
