/*\
title: Test/filters.js
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

it('can uglify text/x-tiddler-filter', function() {
	const uglify = $tw.utils.test.wikitext.uglify;
	const type = "text/x-tiddler-filter";
	var text = uglify('"B 1" [enlist[A B C]]\n+[prefix[B]]', type);
	expect(text).toBe('[[B 1]][enlist[A B C]]+[prefix[B]]');
	// If given a broken filter, it will throw.
	expect(() => uglify("[all[", type)).toThrow();
});

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

it('<currentTiddler> becomes {!!title}', function() {
	test('A testing +[prefix<currentTiddler>]', 'A testing +[prefix{!!title}]');
	test('[<currentTiddler>addsuffix[XX]]', '[{!!title}addsuffix[XX]]');
	test('[[cats]search-replace[a],<currentTiddler>]',
	     '[[cats]search-replace[a],{!!title}]');
	// Non-standard currentTiddler
	test('A testing +[prefix<currentTiddler  >]', 'A testing +[prefix{!!title}]');
	test('A testing +[prefix< currentTiddler>]', 'A testing +[prefix<>]');
	test('A testing +[prefix<currentTiddler  a>]',
	     'A testing +[prefix<currentTiddler a>]',
	     {prefix: '\\define currentTiddler(x)--$x$--\n'});
	// Only macros
	test('A testing  +[addprefix[currentTiddler]]',
	     'A testing +[addprefix[currentTiddler]]');
	const wiki = new $tw.Wiki();
	wiki.addTiddler({title: 'currentTiddler', text: 'currentText'});
	test('A testing  +[addprefix{currentTiddler}]',
	     'A testing +[addprefix{currentTiddler}]',
	     {wiki: wiki});
});

it('all[current] becomes {!!title}', function() {
	test('[all[current]addprefix[test]]', '[{!!title}addprefix[test]]');
	test('[!all[current]addprefix[test]]', '[!all[current]addprefix[test]]');
	test('[all[ current]addprefix[test]]', '[all[ current]addprefix[test]]');
	test('[all[current ]addprefix[test]]', '[all[current ]addprefix[test]]');
	test('[all[current],[other]addprefix[test]]',
	     '[all[current],[other]addprefix[test]]');
	test('[all:suffix[current]addprefix[test]]',
	     '[all:suffix[current]addprefix[test]]');
	const wiki = new $tw.Wiki();
	wiki.addTiddler({title: 'current', text: 'tiddlers'});
	test('[all{current}addprefix[test]]',
	     '[all{current}addprefix[test]]', {wiki: wiki});
	test('[all<current>addprefix[test]]', '[all<current>addprefix[test]]');
	spyOn(console, "log");
	try {
		test('[all/current/addprefix[test]]', '[all/current/addprefix[test]]');
	} catch(e) {
		// Do nothing. Earlier versions of TiddlyWiki
		// would throw if all//] was ever run as a filter.
	}
});

it('has[draft.of] becomes is[draft]', function() {
	const wiki = new $tw.Wiki();
	const s = "[all[]]F +";
	wiki.addTiddlers([
		{title: "A"}, {title:"Draft of 'A'", 'draft.of':"A", 'draft.title':"A"},
		{title: "B"}, {title:"Draft of 'B'", 'draft.of':"B"},
		{title: "C"}, {title:"Draft of 'C'", 'draft.of':"C"},
		{title: "D"}, {title:"Draft of 'D'", 'draft.of':"", 'draft.title':""},
		{title: "E"}]);
	test(s+'[has[draft.of]]', s+'[is[draft]]', {wiki: wiki});
	test(s+'[has{draft.of}]', s+'[has{draft.of}]', {wiki: wiki});
	test(s+'[has<draft.of>]', s+'[has<draft.of>]', {wiki: wiki});
	test(s+'[has:field[draft.of]]', s+'[has:field[draft.of]]', {wiki: wiki});
	test(s+'[has:index[draft.of]]', s+'[has:index[draft.of]]', {wiki: wiki});
	test(s+'[has[draft.of],[other]]', s+'[has[draft.of],[other]]',{wiki: wiki});

	// draft.title mst be ignored. It is not a proper field to check for draft.
	test('[has[draft.title]]', '[has[draft.title]]', {wiki: wiki});
	// Because of an inconsistency with earlier versions of TiddlyWiki,
	// We can't run this test with Draft of 'D'.
	const sButNoD = "[all[]]F -[[Draft of 'D']]+";
	test(sButNoD+'[!has[draft.of]]', sButNoD+'[!is[draft]]', {wiki: wiki});
});

});});
