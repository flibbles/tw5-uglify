/*\
title: Test/wikitext/dash.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with --- em and en dash

\*/

describe('wikitext uglifier', function() {

describe('dash', function() {

const test = $tw.utils.test.wikitext.test;
const t = "\\whitespace trim\n";

it('handles', function() {
	test("x--", "x--");
	test("x---", "x---");
	test("x----", "x----");
	test("x------", "x------");
});

it('surrounding spaces', function() {
	test("--- x", "--- x");
});

it('EOF', function() {
	test(  "-- ", "-- ");
	test(t+"-- ", "--");
	test(  "--- ", "--- ");
	test(t+"--- ", "---<!---->");
	test(  "---- ", "---- ");
	test(t+"---- ", "----<!---->");
});

it('Junk like comments', function() {
	test(  "---<!---->", "---<!---->");
	test(  "<!---->---", "\n---");
});

it('Inside element', function() {
	test("<div>---</div>", "<div>---");
	test("<div>\n---</div>", "<div>\n---");
	test("<div>\n\n---</div>", "<div>\n\n---</div>");
	test("<div>\n\n<span/>\n\n---</div>", "<div>\n\n<span/>\n\n---</div>");
	// no tails
	test("<div>---</div>x", "<div>---</div>x");
	test("<div>\n---</div>x", "<div>\n---</div>x");
	test("<div>\n\n---</div>", "<div>\n\n---</div>");
	test("<div>\n\n---</div>x", "<div>\n\n---</div>x");
	test("<div>\n\n<span/>\n\n---</div>x", "<div>\n\n<span/>\n\n---</div>x");
});

it('Two dashes', function() {
	test(  "<div>--</div>", "<div>--");
	test(  "<div>\n--</div>", "<div>\n--");
	test(  "<div>\n--\n</div>", "<div>\n--\n");
	test(t+"<div>\n--\n</div>", "<div>--");
	test(  "<div>\n\n--</div>", "<div>\n\n--");
	test(  "--<!---->", "--");
});

it('Four or more dashes', function() {
	// Four dashes are tricky. We can't be sure they're safe to trim around
	// Because it's impossible to know if they're actually at the start of
	// a block or not. So we must always treat them as volatile.
	test(  "<div>----</div>", "<div>----</div>");
	test(  "<div>----</div>x", "<div>----</div>x");
	test(  "<div>\n----</div>", "<div>\n----</div>");
	test(  "<div>\n----</div>x", "<div>\n----</div>x");
	test(  "<div>\n----\n</div>", "<div>\n----\n");
	test(  "<div>\n----\n</div>x", "<div>\n----\n</div>x");
	test(t+"<div>\n----\n</div>", "<div>----</div>");
	test(t+"<div>\n----\n</div>x", "<div>----</div>x");
	test(  "<div>\n\n----</div>", "<div>\n\n----</div>");
	test(  "<div>\n\n----</div>x", "<div>\n\n----</div>x");
});

});});
