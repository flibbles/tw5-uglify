/*\
title: Test/wikitext/filters.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with entities.

\*/

describe('wikitext uglifier', function() {
describe('filters', function() {

const test = function(input, expected, options) {
	options = options || {};
	options.wiki = options.wiki || new $tw.Wiki();
	options.wiki.addTiddlers([
		{title: 'A', text: "Content of A"},
		{title: 'B', text: "Text of B"},
		{title: 'C'}])
	var prefix = options.prefix || '';
	$tw.utils.test.wikitext.test(prefix+'{{{'+input+'}}}', prefix+'{{{'+expected+'}}}', options);
};

it('processes filter operations', function() {
	// manages all
	test('[all[]]\n[prefix[B]]', '[all[]][prefix[B]]');
	test('[all[]] +[prefix[B]]', '[all[]]+[prefix[B]]');
	test('[all[]] :or[prefix[B]]', '[all[]]:or[prefix[B]]');
	test('[all[]] :or:arg[prefix[B]]', '[all[]]:or:arg[prefix[B]]');

	// manages all operators
	test('[all[]addsuffix[B]]', '[all[]addsuffix[B]]');
	test('[all[]!tag[B]]', '[all[]!tag[B]]');
	test('[all[]addsuffix{B!!text}]', '[all[]addsuffix{B!!text}]');
	test('[search-replace[B],[Z]]', '[search-replace[B],[Z]]');
	test('[all[]pad:suffix[5],[-]]', '[all[]pad:suffix[5],[-]]');
	test('[search:text:regexp[of \\w]]', '[search:text:regexp[of \\w]]');
});

it('processes deprecated filter regexp operands', function() {
	// Warnings will come up that we don't care about.
	spyOn(console, "log");
	test('Z [all[]addsuffix/regexp/]', 'Z[all[]addsuffix/regexp/]');
	test('Z [all[]addsuffix/regexp/(g)]', 'Z[all[]addsuffix/regexp/(g)]');
});

it('processes macro operands', function() {
	const prefix =  "\\define M(a b)--$a$---$b$\n";
	test('[all[]addsuffix<M arg1  arg2>]',
	     '[all[]addsuffix<M arg1 arg2>]',
	     {prefix: prefix});
});

it('titles and the spaces between them', function() {
	test('[[B C]]', '[[B C]]');
	test('[[A]]', 'A');
	// Test that spacing after titles is correct
	test('[[A]] [[B C]]', 'A[[B C]]');
	test('A =[[B C]]', 'A =[[B C]]');
	test('[[A]] [[B]] [[C]]', 'A B C');
	test('[[A B]] [[C]]', '[[A B]]C');
	// quotes
	test('"A B" C "D E" "F G" H I', '"A B"C "D E""F G"H I');
	test("'A B' C 'D E' 'F G' H I", "'A B'C 'D E''F G'H I");
	test("[[A B]] C [[D E]] [[F G]] H I", "[[A B]]C[[D E]][[F G]]H I");
	// mixed quotes against each other
	test("[[a 'b]] 'c d' [[e 'f]]", "[[a 'b]]'c d'[[e 'f]]");
});

it('titles with weird and dangerous titles', function() {
	test('"[[open]] and close"', '"[[open]] and close"');
	test('"brac[ets" "brac]ets"', '"brac[ets""brac]ets"');
	test('"brac[ets" "brac]ets" [[A]]', '[[brac[ets]]"brac]ets"A');
	test('"[item"', '"[item"');
	test('"cats \'dogs" \'A\'', '"cats \'dogs"A');
	test("'cats \"dogs' \"A\"", "'cats \"dogs'A");
	test('"+value"', '"+value"');
	test('"-value"', '"-value"');
	test('"~value"', '"~value"');
	test('"=value"', '"=value"');
	test('":value"', '":value"');
	test('"\'A\'B"', '"\'A\'B"');
	test("'\"A\"B'", "'\"A\"B'");
});

it('titles will not use quotation that was not already there', function() {
	test('"A B"', '"A B"');
	test('"A B" [[C]]', '[[A B]]C');
	test("[[A B]]", "[[A B]]");
	test("[[A B]] 'C'", "'A B'C");
});

it('titles that are not standalone', function() {
	const prefix =  "\\define A()cat fancy\n";
	test('[title[A]]', 'A');
	// title doesn't take a suffix, but if one is there,
	// it must be for a reason
	test('[title:suffix[A]]', '[title:suffix[A]]');
	test('[<A>]', '[<A>]', {prefix: prefix});
	test('[title<A>]', '[<A>]', {prefix: prefix});
	test('[{A}]', '[{A}]');
	test('[title{A}]', '[{A}]');
	test('[title[A]addsuffix[-suf]]', '[[A]addsuffix[-suf]]');
	test('[title[A],[stuff]]', '[[A],[stuff]]');
	test('[![A]]', '[![A]]');
	test('[!title[A]]', '[![A]]');
	test('[!title:suffix[A]]', '[!title:suffix[A]]');
});

it('titles unquoted with prefixes', function() {
	test('A ="A"', 'A =A');
	test('[[A B]] ="A"', '[[A B]]=A');
});

it('titles that are empty', function() {
	// Brackets like this make the empty string
	test('A [[]] B', 'A[[]]B');
	test('A [![]] B', 'A[![]]B');
	// Apparently empty quotes just don't process
	test('A "" B', 'A B');
	test("A '' B", "A B");
});

// TODO: /Regexp/ operands
});});
