/*\
title: Test/wikitext/syslink.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with syslinks

\*/

describe('wikitext uglifier', function() {
describe('syslink', function() {

const test = $tw.utils.test.wikitext.test;
const t = "\\whitespace trim\n";

it('handles preceding whitespace', function() {
	test(  "code $:/core", "code $:/core");
	// No special handling has to occur
	test(t+"code $:/core", "code$:/core");
});

it('handles trailing whitespace', function() {
	test(  "$:/core code", "$:/core code");
	test(t+"$:/core code", "[[$:/core]]code");
	test(  "$:/core\ncode", "$:/core\ncode");
	test(t+"$:/core\ncode", "[[$:/core]]code");
	test(t+"$:/core a?test?t? C ?test?",t+"$:/core a?test?t? C ?test?");
	test(t+"$:/core   a?test?t? C ?test?",t+"$:/core a?test?t? C ?test?");
	test(t+"$:/core\na?test?t? C ?test?",t+"$:/core a?test?t? C ?test?");
});

it('handles nonsyslinks too', function() {
	test(  "~$:/core code", "~$:/core code");
	test(t+"~$:/core code", t+"~$:/core code");
	test(t+"~$:/core $:/link", "~$:/core$:/link");
	test(t+"//~$:/core // text", t+"//~$:/core //text");
});

it('does not reduce to ordinary link for blocks', function() {
	test(t+"$:/core\n\ncode", "$:/core\n\ncode");
	test(t+"<div>\n$:/core\n\ncode", "<div>[[$:/core]]code");
	test(t+"<div>\n<div>\n\n$:/core\n\ncode", "<div><div>\n\n$:/core\n\ncode");
});

it('standalone', function() {
	test(  "$:/core", "$:/core");
	test(t+"$:/core", "$:/core");
	test(  "$:/core\n", "$:/core\n");
	test(t+"$:/core\n", "$:/core");
});

// The most common case of syslinks is actually a tiddlers holding filters.
// We need to make sure we don't goof those up.
it('filter operator', function() {
	test(  "[prefix[$:/core]]", "[prefix[$:/core]]");
	test(t+"[prefix[$:/core]]", "[prefix[$:/core]]");
	test(  "[prefix[$:/core  ]]", "[prefix[$:/core  ]]");
	test(t+"[prefix[$:/core  ]]", "[prefix[$:/core]]");
});

it('disabled prettylinks', function() {
	test(t+"\\rules except prettylink\n$:/core code",
	     t+"\\rules except prettylink\n$:/core code");
	test(t+"\\rules except prettylink\n$:/core    code",
	     t+"\\rules except prettylink\n$:/core code");
});

});});
