/*\
title: Test/wikitext/transclude.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with inline and block filteredtranscludes.

\*/

describe('wikitext uglifier', function() {
describe('filteredtransclude', function() {

const test = $tw.utils.test.wikitext.test;
const cmp = $tw.utils.test.wikitext.cmp;
const t = "\\whitespace trim\n";

it('trims inside for what little it can', function() {
	const wiki = new $tw.Wiki();
	wiki.addTiddler({
		title: "tid",
		field: "<$reveal/>\n\nfield",
		text: "<$reveal/>\n\ntext"});
	wiki.addTiddler({
		title: "test",
		field: "<$reveal/>\n\ntestField",
		text: "<$reveal/>\n\ntext"});
	wiki.addTiddler({
		title: "temp",
		text: "--<$transclude/>--"});
	test('{{ tid!!field}}', '{{tid!!field}}', {wiki: wiki});
	test('{{ tid !!field}}', '{{tid !!field}}', {wiki: wiki});
	test('{{tid!! field }}', '{{tid!! field}}', {wiki: wiki});
	test('{{tid!!field }}', '{{tid!!field}}', {wiki: wiki});
	test('{{ !!field }}', '{{!!field}}', {wiki: wiki});
	// template
	test('{{ tid || temp }}', '{{tid||temp}}', {wiki: wiki});
	test('{{ tid!!field || temp }}', '{{tid!!field||temp}}', {wiki: wiki});
});

it('block and inline', function() {
	const wiki = new $tw.Wiki();
	wiki.addTiddler({title: "tid", text: "<$reveal/>\n"});
	test(  '{{tid}}', '{{tid}}', {wiki: wiki});
	test(  '{{tid}}\n', '{{tid}}', {wiki: wiki});
	test(  '{{tid}}\r\n', '{{tid}}', {wiki: wiki});
	test(t+'{{tid}}\r\n', '{{tid}}', {wiki: wiki});
	test(  '{{tid}}\n\n', '{{tid}}', {wiki: wiki});
	test(t+'{{tid}}\n\n', '{{tid}}', {wiki: wiki});
	test(  '{{tid}}\r\n\r\n', '{{tid}}', {wiki: wiki});
	test(t+'{{tid}}\r\n\r\n', '{{tid}}', {wiki: wiki});
	test(  '{{tid}}X', '{{tid}}X', {wiki: wiki});
	test(  '{{tid}}\nX', '{{tid}}\nX', {wiki: wiki});
	test(  '{{tid}}\n\nX', '{{tid}}\nX', {wiki: wiki});
	test(  '{{tid}}\r\nX', '{{tid}}\nX', {wiki: wiki});
	test(  'X\n{{tid}}\n', 'X\n{{tid}}\n', {wiki: wiki});
	test(t+'X\n{{tid}}\n', 'X{{tid}}', {wiki: wiki});
	test(  'X\n\n{{tid}}\n\n', 'X\n\n{{tid}}', {wiki: wiki});
	test(  'X\n\n{{tid}}\n\nX', 'X\n\n{{tid}}\nX', {wiki: wiki});
	test(  'X\n\n{{tid}}\n  \tX', 'X\n\n{{tid}}\nX', {wiki: wiki});
});

it('trims tail', function() {
	const wiki = new $tw.Wiki();
	wiki.addTiddler({title: "tid", text: "<$reveal/>\n"}, {wiki: wiki});
	test(  '<div>{{tid}}\n</div>', '<div>{{tid}}\n', {wiki: wiki});
	test(t+'<div>{{tid}}\n</div>', '<div>{{tid}}', {wiki: wiki});
	test(  '<div>\n\n{{tid}}\n</div>', '<div>\n\n{{tid}}', {wiki: wiki});
	test(t+'<div>\n\n{{tid}}\n</div>', '<div>\n\n{{tid}}', {wiki: wiki});
	test(  '<div>\n\n{{tid}}\n\n</div>\n', '<div>\n\n{{tid}}', {wiki: wiki});
});

});});
