/*\
title: Test/wikitext/filteredtransclude.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with inline and block filteredtranscludes.

\*/

describe('wikitext uglifier', function() {
describe('filteredtransclude', function() {

const test = $tw.utils.test.wikitext.test;

it('tightens up inner filter', function() {
	test('{{{ [filter[]] }}}', '{{{[filter[]]}}}');
	test('{{{ Name }}}', '{{{Name}}}');
	// Even a filter with placeholders gets some tightening
	test('\\define M(x){{{ Abs Bones +[prefix[A]$X$] }}}\n<<M addsuffix[T]>>',
	     '\\define M(x){{{Abs Bones +[prefix[A]$X$]}}}\n<<M addsuffix[T]>>');
});

it('handles extra options', function() {
	const wiki = new $tw.Wiki();
	wiki.addTiddler({title: 'temp', text: '--{{!!title}}--'});
	// We keep the whitespace because it could theoretically pass along
	test('{{{ A B | tooltip }}}', '{{{A B| tooltip }}}', {wiki: wiki});
	// Test templates
	test('{{{ A B || temp }}}', '{{{A B||temp}}}', {wiki: wiki});
	test('{{{ A B | tool || temp }}}', '{{{A B| tool ||temp}}}', {wiki: wiki});
	test('{{{ A B }} width:40; }', '{{{A B}} width:40; }', {wiki: wiki});
	test('{{{ A B }}}.cA.cB', '{{{A B}}}.cA.cB', {wiki: wiki});
});

it('handles block and inline', function() {
	test('Text\n\n{{{ Name }}}', 'Text\n\n{{{Name}}}'); // Ends with EOF
	test('{{{ Name }}}X', '{{{Name}}}X');
	test('{{{ Name }}}\n', '{{{Name}}}\n');
	test('<div>\n\n{{{ Name }}}\n\n</div>', '<div>\n\n{{{Name}}}\n');
	test('\\whitespace trim\n{{{ Name }}}\n\n', '{{{Name}}}\n');
});

it('handles carriage returns', function() {
	test('{{{ Name }}}\r\n', '{{{Name}}}\n');
});

it('handles weird placeholders', function() {
	const wiki = new $tw.Wiki();
	wiki.addTiddler({title: 'temp', text: '--{{!!title}}--'});
	test('\\define M(x){{{ A B $x$ }}}\n<<M C>>',
	     '\\define M(x){{{A B $x$}}}\n<<M C>>', {wiki: wiki});
	test('\\define M(x){{{ A B $x$ }}}\n<<M ||temp>>',
	     '\\define M(x){{{A B $x$}}}\n<<M ||temp>>', {wiki: wiki});
});

});});
