/*\
title: Test/wikitext/entity.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with entities.

\*/

describe('wikitext uglifier', function() {
describe('entity', function() {

const test = $tw.utils.test.wikitext.test;
const cmp = $tw.utils.test.wikitext.cmp;
const t = "\\whitespace trim\n";

it('supports any entity', function() {
	test("Charles&amp;sons", "Charles&amp;sons");
	test("Charles &amp; sons", "Charles &amp; sons");
});

it('compresses spaces', function() {
	test(  "I&#32;//love//&#32;bbq", "I //love// bbq");
	test(t+"I&#32;//love//&#32;bbq", "I //love// bbq");
});

it('prevents decoding when whitespace pragma must remain', function() {
	test(  "I&#32;//love//&#32;bbq?test?t?a //b// c?test?",
	       "I //love// bbq?test?t?a //b// c?test?");
	test(t+"I&#32;//love//&#32; bbq?test?t?a //b// c?test?",
	     t+"I&#32;//love//&#32;bbq?test?t?a //b// c?test?");
	test(  "<div>I&#32;//love//&#32; bbq</div>\n?test?t?a //b// c?test?",
	       "<div>I //love//  bbq</div>\n?test?t?a //b// c?test?");
	test(t+"<div>I&#32;//love//&#32; bbq</div>\n?test?t?a //b// c?test?",
	     t+"<div>I&#32;//love//&#32;bbq</div>?test?t?a //b// c?test?");
});

it('prevents decoding around macro placeholders', function() {
	// Placeholders too
	test("\\define M(m)\nI&#32;//love//&#32; bbq $m$\n\\end\n<<M  'a b'>>",
	     "\\define M(m)I //love//  bbq $m$\n<<M'a b'>>");
	test("\\define M(m)\n"+t+"I&#32;//love//&#32; bbq $m$\n\\end\n<<M  'a b'>>",
	     "\\define M(m)\n"+t+"I&#32;//love//&#32; bbq $m$\n\\end\n<<M'a b'>>");
});

it('entity at start of block', function() {
	test(  "&#32;<$reveal />", "&#32;<$reveal/>");
	test(t+"&#32;<$reveal />", "&#32;<$reveal/>");
	test(  "C\n\n&#32;<$reveal />", "C\n\n&#32;<$reveal/>");
	test(t+"C\n\n&#32;<$reveal />", "C\n\n&#32;<$reveal/>");
});

});});
