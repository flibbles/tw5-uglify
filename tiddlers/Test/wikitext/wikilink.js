/*\
title: Test/wikitext/wikilink.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with wikilinks

\*/

describe('wikitext uglifier', function() {
describe('wikilinks', function() {

const t = "\\whitespace trim\n";
const test = $tw.utils.test.wikitext.test;

it('handles preceding whitespace', function() {
	test(  "code MyLink", "code MyLink");
	test(t+"code   MyLink", "code[[MyLink]]");
	test(t+"?test?t? C ?test?code   MyLink", t+"?test?t? C ?test?code MyLink");
});

it('handles trailing whitespace', function() {
	test(  "MyLink code", "MyLink code");
	test(t+"MyLink code", "[[MyLink]]code");
	test(  "MyLink\ncode", "MyLink\ncode");
	test(t+"MyLink\ncode", "[[MyLink]]code");
	test(t+"MyLink a?test?t? C ?test?",t+"MyLink a?test?t? C ?test?");
	test(t+"MyLink   a?test?t? C ?test?",t+"MyLink a?test?t? C ?test?");
	test(t+"MyLink\na?test?t? C ?test?",t+"MyLink a?test?t? C ?test?");
});

it('handles nonwikilinks too', function() {
	test(  "~MyLink code", "~MyLink code");
	test(t+"~MyLink code", t+"~MyLink code");
	test(t+"~MyLink $:/core", "~MyLink$:/core");
	test(t+"//~MyLink // text", "//~MyLink//text");
});

it('barely handles wikilinks adjacent to each other', function() {
	// This isn't correct. We don't need to introduce that second space,
	// but we do because having the two wikilinks be aware of each other not
	// to both add a space is a huge hassle that I'm not going to deal with
	// since this case is never going to come up.
	test(t+"~MyLink OtherLink", t+"~MyLink  OtherLink");
});

it('handles changed unWikilink', function() {
	var old = $tw.config.textPrimitives.unWikiLink;
	$tw.config.textPrimitives.unWikiLink = '@';
	try {
		test(t+"@MyLink code", t+"@MyLink code");
		test(t+"~MyLink code", "~[[MyLink]]code");
	} finally {
		$tw.config.textPrimitives.unWikiLink = old;
	}
});

it('does not reduce to ordinary link for blocks', function() {
	test(t+"MyLink\n\ncode", "MyLink\n\ncode");
	test(t+"<div>\nMyLink\n\ncode", "<div>[[MyLink]]code");
	test(t+"<div>\n<div>\n\nMyLink\n\ncode", "<div><div>\n\nMyLink\n\ncode");
});

it('standalone', function() {
	//test(  "MyLink", "MyLink");
	test(t+"MyLink", "MyLink");
	test(  "MyLink\n", "MyLink\n");
	test(t+"MyLink\n", "MyLink");
});

// The most common case of syslinks is actually a tiddlers holding filters.
// We need to make sure we don't goof those up.
it('filter operator', function() {
	test(  "[prefix[MyLink]]", "[prefix[MyLink]]");
	test(t+"[prefix[MyLink]]", "[prefix[MyLink]]");
	test(  "[prefix[MyLink  ]]", "[prefix[MyLink  ]]");
	test(t+"[prefix[MyLink  ]]", "[prefix[MyLink]]");
});

it('disabled prettylinks', function() {
	test(t+"\\rules except prettylink\nMyLink code",
	     t+"\\rules except prettylink\nMyLink code");
	test(t+"\\rules except prettylink\nMyLink    code",
	     t+"\\rules except prettylink\nMyLink code");
});

});});
