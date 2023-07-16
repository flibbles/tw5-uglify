/*\
title: Test/wikitext/parameters.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with parameter pragma

\*/

describe('wikitext uglifier', function() {
$tw.utils.test.wikitext.ifAtLeastVersion("5.3.0").
describe('parameter', function() {

const test = $tw.utils.test.wikitext.test;

it('trims lines around import pragma', function() {
	test('\\parameters (A)\n\\import X\n\\define B() B',
	     '\\parameters(A)\n\\import X\n\\define B()B');
	test('\\parameters (A:cat)\n\n\\import X\n\n\\define B() B\n\n<<A>>',
	     '\\parameters(A:cat)\n\\import X\n\\define B()B\n<<A>>');
});

it('trims carriage returns', function() {
	test('\\parameters (A:cat)\r\n\r\n<<A>>',
	     '\\parameters(A:cat)\n<<A>>');
});

});});
