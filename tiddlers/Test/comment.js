/*\
title: Test/comments.js
type: application/javascript
tags: $:/tags/test-spec

Tests the comments javascript compressor.
\*/

var js = require("$:/plugins/flibbles/uglify/javascript/comments");

function test(input, expected) {
	var output = js.compress({title: 'test.js', text: input});
	expect(output).toBe(expected);
};

describe('javascript comments', function() {

it('simple block comments', function() {
	test("A /* Comment */ B", "A  B");
	test("/* Comment */ C", " C");
	test("A /* Comment */", "A ");
	test("/* Comment */", "");
	test("A /* Comment *//* other comment */ D", "A  D");
	test("A /* Comment */D/* other comment */ F", "A D F");
	test("A /* Comment */* E */", "A * E */");
	test("A /*/ Comment */ F", "A  F");
	test("A /* Comment /*/ G", "A  G");
	test("A /**/ H */", "A  H */");
	test("I /", "I /");
});

it('simple line comments', function() {
	test("A// comment\nB", "A\nB");
	test("B// comment", "B");
	test("C// comment\n/* next comment*/ C", "C\n C");
	test("D// comment\n// other comment\nD", "D\n\nD");
	//test("C   // stuff\nD", "C\nD");
});

it('double quotes', function() {
	test('A "and" A', 'A "and" A');
	test('A "/*and*/" B', 'A "/*and*/" B');
	test('A "/*" */ C', 'A "/*" */ C');
	test('A " \\" // " C', 'A " \\" // " C');
	test('A " \\\n // " D', 'A " \\\n // " D');
	test('A " \\\\" E//" cut', 'A " \\\\" E');
});

it('single quotes', function() {
	test("A 'and' A", "A 'and' A");
	test("A '/*and*/' B", "A '/*and*/' B");
	test("A '/*' */ C", "A '/*' */ C");
	test("A ' \\' // ' C", "A ' \\' // ' C");
	test("A ' \\\n // ' D", "A ' \\\n // ' D");
	test("A ' \\\\' E//' cut", "A ' \\\\' E");
});

});
