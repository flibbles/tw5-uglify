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
	test('[all[]] +[prefix[B]]', '[all[]prefix[B]]');
	test('[all[]] :or[prefix[B]]', '[all[]]:or[prefix[B]]');
	test('[all[]] :or:arg[prefix[B]]', '[all[]]:or:arg[prefix[B]]');
	test('A D +[[A]]', 'A D +A');
	test('ABC DEF +[[ABC]]', 'ABC DEF +ABC');
	test('ABC DEF :and[[ABC]]', 'ABC DEF :and[[ABC]]');

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
	test('"brac[ets" "brackets"', '"brac[ets"brackets');
	test('"brac[ets" "brac]ets"', '[[brac[ets]]"brac]ets"');
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
		{title: "C"}, {title:"Draft of 'C'", 'draft.title':"C"},
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

it(':and filter prefixes on second runs are merged', function() {
	const wiki = new $tw.Wiki();
	wiki.addTiddlers([
		{title: "A", author: "bob"},
		{title: "B", author: "bill"},
		{title: "C", author: "nick"},
		{title: "x]y", text: "x]y content"}]);
	test("[enlist[1 2 3]] +[prefix[2]]",
	     "[enlist[1 2 3]prefix[2]]", {wiki, wiki});
	test("[enlist[1 2 3]] [prefix[A]] +[addsuffix[x]]",
	     "[enlist[1 2 3]][prefix[A]]+[addsuffix[x]]", {wiki: wiki});
	test("[enlist[1 2 3]] +[prefix[A]] +[addsuffix[x]]",
	     "[enlist[1 2 3]prefix[A]addsuffix[x]]", {wiki: wiki});
	test("[enlist[1 2 3]] :and[prefix[2]]",
	     "[enlist[1 2 3]prefix[2]]", {wiki, wiki});
	test("[enlist[1 2 3]] +[prefix[2]]",
	     "[enlist[1 2 3]prefix[2]]", {wiki, wiki});
	// Might change quotes to brackets, but only if brackets allowed
	test("'1 2' +[addprefix[x]]", "[[1 2]addprefix[x]]", {wiki: wiki});
	test("'1 2' +'3 4'", "'1 2'+'3 4'", {wiki: wiki});
	test("[{A}] +[addsuffix{B}]", "[{A}addsuffix{B}]", {wiki: wiki});
	test("[<A]>] +[addprefix[x]]", "[<A]>addprefix[x]]",
	     {wiki: wiki, prefix: "\\define A]()--A--\n"});
	test("[{x]y}] +[addprefix[x]]", "[{x]y}addprefix[x]]", {wiki: wiki});
	// These titles can't be a part of a run. Can only be quoted.
	test("'x]y' +[addsuffix[x]]", "'x]y'+[addsuffix[x]]", {wiki: wiki});
	test("[[1 2]] +'x]y'", "'1 2'+'x]y'", {wiki: wiki});
	// I can't for the life of me figure out a prefix on the first
	// run which breaks it, but I also I can't find one that does
	// anything meaningful, so I might as well disallow it.
	test("-[[B]] +[addprefix[x]]", "-B +[addprefix[x]]", {wiki: wiki});
	test(":filter[[B]] +[addprefix[x]]", ":filter[[B]]+[addprefix[x]]", {wiki: wiki});
	// Let's make sure those deprecated regexp operands are okay
	spyOn(console, "log");
	test("[author/b/] +[author/i/] [[1 2]]",
	     "[author/b/author/i/][[1 2]]", {wiki, wiki});
});

it('reduces first[] nth[1] zth[0] limit[1] to nth[]', function() {
	test("[enlist[A B C D]nth[1]]", "[enlist[A B C D]nth[]]");
	test("[enlist[A B C D]nth[2]]", "[enlist[A B C D]nth[2]]");
	test("[enlist[A B C D]first[]]", "[enlist[A B C D]nth[]]");
	test("[enlist[A B C D]first[1]]", "[enlist[A B C D]nth[]]");
	test("[enlist[A B C D]!first[]]", "[enlist[A B C D]!nth[]]");
	test("[enlist[A B C D]limit[1]]", "[enlist[A B C D]nth[]]");
	test("[enlist[A B C D]!limit[1]]", "[enlist[A B C D]!limit[1]]");
	test("[enlist[A B C D]limit[]]", "[enlist[A B C D]limit[]]");
	test("[enlist[A B C D]zth[0]]", "[enlist[A B C D]nth[]]");
	// Don't change zth arbitrarily
	test("[enlist[A B C D]zth[]]", "[enlist[A B C D]zth[]]");
	test("[enlist[A B C D]zth[1]]", "[enlist[A B C D]zth[1]]");
	// Broken ones
	test("[enlist[A B C D]first[2]]", "[enlist[A B C D]first[2]]");
	test("[enlist[A B C D]first:suf[]]", "[enlist[A B C D]first:suf[]]");
	test("[enlist[A B C D]first[1],[X]]", "[enlist[A B C D]first[1],[X]]");
	test("[enlist[A B C D]first{1}]", "[enlist[A B C D]first{1}]");
	test("[enlist[A B C D]first<1>]", "[enlist[A B C D]first<1>]");
	spyOn(console, "log");
	test("[enlist[A B C D]first/1/]", "[enlist[A B C D]first/1/]");
});

it('turns all[shadows+tiddlers]tag[X] to [X]tagging[]', function() {
	const wiki = new $tw.Wiki();
	const shadowTiddlers = [
		{title: "$:/plugin/X", tags: "tag"},
		{title: "$:/plugin/Y", tags: "tag", "list-before": "$:/plugin/X"},
		{title: "$:/plugin/Z", tags: "tag"}];
	$tw.utils.test.addPlugin(wiki, 'plugin', shadowTiddlers);
	wiki.addTiddlers([
		{title: "tag", list: "noexist"},
		{title: "M", tags: "tag", text: "[[ZZ]] [[noexist]]"},
		{title: "N", tags: "tag", "list-before": "$:/plugin/Z"},
		{title: "O", tags: "tag", "list-after": "$:/plugin/X"},
		{title: "P", tags: "tag", "list-before": "Q"},
		{title: "Q", tags: "tag othertag"}]);
	wiki.addTiddler({title: "ref", text: "tag", field: "tag"});
	// with other operators
	test("[all[shadows+tiddlers]tag[tag]addsuffix[x]]", "[[tag]tagging[]addsuffix[x]]", {wiki: wiki});
	// all operand values
	test("[all[shadows+tiddlers]tag[tag]]", "[[tag]tagging[]]", {wiki: wiki});
	test("[all[ shadows + tiddlers ]tag[tag]]", "[all[ shadows + tiddlers ]tag[tag]]", {wiki: wiki});
	test("[all[tiddlers]tag[tag]]", "[all[tiddlers]tag[tag]]", {wiki: wiki});
	test("[all[shadows]tag[tag]]", "[all[shadows]tag[tag]]", {wiki: wiki});
	test("[all[]tag[tag]]", "[all[]tag[tag]]", {wiki: wiki});
	test("[all[shadows+tiddlers+tiddlers]tag[tag]]", "[all[shadows+tiddlers+tiddlers]tag[tag]]", {wiki: wiki});
	test("[all[shadows+tiddlers+shadows]tag[tag]]", "[all[shadows+tiddlers+shadows]tag[tag]]", {wiki: wiki});
	test("[all[shadows+tiddlers+missing]tag[tag]]", "[all[shadows+tiddlers+missing]tag[tag]]", {wiki: wiki});
	test("[all[shadows+tiddlers+tags]tag[tag]]", "[all[shadows+tiddlers+tags]tag[tag]]", {wiki: wiki});
	// all operand no-gos
	test("[all{shadows+tiddlers}tag[tag]]", "[all{shadows+tiddlers}tag[tag]]", {wiki: wiki});
	test("[all<shadows+tiddlers>tag[tag]]", "[all<shadows+tiddlers>tag[tag]]", {wiki: wiki});
	test("[all[shadows+tiddlers],[2]tag[tag]]", "[all[shadows+tiddlers],[2]tag[tag]]", {wiki: wiki});
	test("[!all[shadows+tiddlers]tag[tag]]", "[!all[shadows+tiddlers]tag[tag]]", {wiki: wiki});
	test("[all:suf[shadows+tiddlers]tag[tag]]", "[all:suf[shadows+tiddlers]tag[tag]]", {wiki: wiki});
	// tag operand
	test("[all[shadows+tiddlers]tag{ref}]", "[{ref}tagging[]]", {wiki: wiki});
	test("[all[shadows+tiddlers]tag{ref!!field}]", "[{ref!!field}tagging[]]", {wiki: wiki});
	test("[all[shadows+tiddlers]tag<T ag>]", "[<T ag>tagging[]]", {wiki: wiki, prefix: "\\define T(x)t$x$\n"});
	//broken
	test("[all[shadows+tiddlers]tag[tag],[2]]", "[all[shadows+tiddlers]tag[tag],[2]]", {wiki: wiki});
	test("[all[shadows+tiddlers]!tag[tag]]", "[all[shadows+tiddlers]!tag[tag]]", {wiki: wiki});
	test("[all[shadows+tiddlers]tag:suf[tag]]", "[all[shadows+tiddlers]tag:suf[tag]]", {wiki: wiki});
	// deprecated regexp tests
	spyOn(console, "log");
	test("[all[shadows+tiddlers]tag/tag/]", "[all[shadows+tiddlers]tag/tag/]", {wiki: wiki});
});

});});
