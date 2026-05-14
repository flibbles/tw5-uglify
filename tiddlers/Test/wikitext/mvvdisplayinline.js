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

it('tightens up mvv diplays', function() {
	const prefix = "<$let X={{{A B}}}>\n\n";
	test(prefix+'((( X )))', prefix+'(((X)))');
});

});});
