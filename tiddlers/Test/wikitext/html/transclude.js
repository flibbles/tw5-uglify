/*\
title: Test/wikitext/html/transclude.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with html and widgets.

\*/

describe('wikitext uglifier', function() {
describe('html', function() {
describe('$transclude', function() {

const test = $tw.utils.test.wikitext.test;
const cmp = $tw.utils.test.wikitext.cmp;
const t = "\\whitespace trim\n";
const nocomment = "\\rules except commentinline\n";
const noblock = "\\rules except transcludeblock\n";
const noinline = "\\rules except transcludeinline\n";

it('works with simple cases', function() {
	const wiki = new $tw.Wiki();
	wiki.addTiddler({title: 'test', text: "<$reveal/>\n\n{{!!title}}"});
	test("<$transclude field='text'/>\n", "<$transclude field=text/>\n", {wiki: wiki});
	test("<$transclude index='index'/>\n", "<$transclude index=index/>\n", {wiki: wiki});
	test("<$transclude mode='inline'/>\n", "<$transclude mode=inline/>\n", {wiki: wiki});
	test("<$transclude>Else</$transclude>", "<$transclude>Else", {wiki: wiki});
});

it('works with tiddler attribute', function() {
	const wiki = new $tw.Wiki();
	wiki.addTiddler({title: 'test', text: "<$reveal/>\n\n{{!!title}}"});
	test("<$transclude tiddler='test'/>\n", "{{||test}}", {wiki: wiki});
	test("<div><$transclude tiddler='test'/></div>", "<div>{{||test}}", {wiki: wiki});
	// only string attrs work
	test("<$transclude  tiddler={{test!!title}}/>\n", "<$transclude tiddler={{test!!title}}/>\n", {wiki: wiki});
	test("\\define M()test\n<$transclude  tiddler=<<M>>/>\n",
	     "\\define M()test\n<$transclude tiddler=<<M>>/>\n", {wiki: wiki});
	test("<$transclude  tiddler={{{[[test]]}}}/>\n", "<$transclude tiddler={{{test}}}/>\n", {wiki: wiki});
	// Must be legal template value
	test("<$transclude tiddler='ba|r'/>\n", "<$transclude tiddler=ba|r/>\n", {wiki: wiki});
	test("<$transclude tiddler='c{r'/>\n", "<$transclude tiddler=c{r/>\n", {wiki: wiki});
	test("<$transclude tiddler='c}r'/>\n", "<$transclude tiddler=c}r/>\n", {wiki: wiki});
});

it('ignores tiddler attributes with placeholders', function() {
	test('\\define M(x)<$transclude  tiddler="""$x$"""/>\n<<M>>',
	     '\\define M(x)<$transclude tiddler="""$x$"""/>\n<<M>>');
});

it('maintains proper block or inline status', function() {
	const wiki = new $tw.Wiki();
	wiki.addTiddler({title: 'test', text: "<$reveal/>\n\n{{!!title}}"});
	test(  "<$transclude/>\n", "{{}}", {wiki: wiki});
	test(  "<div><$transclude/></div>", "<div>{{}}", {wiki: wiki});
	test(  "<div><$transclude/></div>X", "<div>{{}}</div>X", {wiki: wiki});
	test(  "<div>\n<$transclude/>\n</div>", "<div>\n{{}}\n", {wiki: wiki});
	test(t+"<div>\n<$transclude/>\n</div>", "<div>{{}}", {wiki: wiki});
	test(  "<div>\n<$transclude/>\n</div>X", "<div>\n{{}}\n</div>X", {wiki: wiki});
	test(  "<div>\n\n<$transclude/>\n\n</div>", "<div>\n\n{{}}", {wiki: wiki});
	test(  "<div>\n\n<$transclude/>\n\n</div>X", "<div>\n\n{{}}\n</div>X", {wiki: wiki});
	// {{}} alone would be a block
	test(  "<$transclude/>", "{{}}<!---->", {wiki: wiki});
	test(nocomment+"<$transclude/>", nocomment+"<$transclude/>", {wiki: wiki});
	test(  "<div>\n\n<$transclude/></div>", "<div>\n\n{{}}</div>", {wiki: wiki});
	test(  "<div>\n\n<$transclude/></div>", "<div>\n\n{{}}</div>", {wiki: wiki});
	test(  "<div>\n\n<$transclude/>\n</div>", "<div>\n\n{{}}<!---->\n", {wiki: wiki});
	test(nocomment+"<div>\n\n<$transclude/>\n</div>",
	     nocomment+"<div>\n\n<$transclude/>\n</div>", {wiki: wiki});
	test(t+"<div>\n\n<$transclude/>\n</div>", "<div>\n\n{{}}</div>", {wiki: wiki});
	test(t+nocomment+"<div>\n\n<$transclude/>\n</div>", nocomment+"<div>\n\n{{}}</div>", {wiki: wiki});
});

it('respects disabled transclude rules', function() {
	const wiki = new $tw.Wiki();
	wiki.addTiddler({title: 'test', text: "<$reveal/>\n\n{{!!title}}"});
	test(noblock+"<$transclude/>\n", noblock+"<$transclude/>\n");
	test(noinline+"<$transclude/>\n", noinline+"{{}}");
	test(noblock+"<div><$transclude/></div>", noblock+"<div>{{}}");
	test(noinline+"<div><$transclude/></div>", noinline+"<div><$transclude/>");
	test(noblock+"<$transclude/>", noblock+"{{}}<!---->");
	test(noinline+"<$transclude/>", noinline+"<$transclude/>");
});

});});});
