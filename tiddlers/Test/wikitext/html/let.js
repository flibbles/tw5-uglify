/*\
title: Test/wikitext/html/let.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier's ability to fold $let widgets together

\*/

describe('wikitext uglifier', function() {
describe('html', function() {
describe('$let', function() {

const parseUtils = require("$:/plugins/flibbles/uglify/wikitext/utils.js");
const test = $tw.utils.test.wikitext.test;
const cmp = $tw.utils.test.wikitext.cmp;
const ifLetIt = $tw.utils.test.wikitext.ifLetIt;
const t = "\\whitespace trim\n";
const d = "<$text text={{{[variables[]join[,]]}}}/>"; //d for dump

ifLetIt('does not reorder its attributes', function() {
	test('<$let x=blah  y=<<x>>>'+d, '<$let x=blah y=<<x>>>'+d);
});

ifLetIt('can fold converted let together', function() {
	test('<$set name=x value=X><$let y=Y>'+d+'</$let></$set>',
	     '<$let x=X y=Y>'+d);
	test('<$let x=X><$set name=y value=Y>'+d+'</$set></$let>',
	     '<$let x=X y=Y>'+d);
	test('<$set name=x value=X><$set name=y value=Y>'+d+'</$set></$set>',
	     '<$let x=X y=Y>'+d);
});

it('is not thrown by self-contained let', function() {
	// TODO: Make $let eliminate itself if it's self-closing
	test('<$let x=X><$let y=Y/></$let>', '<$let x=X><$let y=Y/>');
});

ifLetIt('folds simple inline together', function() {
	test('<$let x=X><$let y=Y z="Z">'+d+'</$let></$let>X',
	     '<$let x=X y=Y z=Z>'+d+'</$let>X');
	test('<$let x=X><$let y=Y z=Z>'+d+'</$let></$let>',
	     '<$let x=X y=Y z=Z>'+d);
	test('<$let x=X><$let y=Y><$let z=Z>'+d+'</$let></$let></$let>X',
	     '<$let x=X y=Y z=Z>'+d+'</$let>X');
});

ifLetIt('folds blocks together', function() {
	test(  '<$let x=X>\n\n<$let y=Y>\n\n'+d+'\n</$let></$let>X',
	       '<$let x=X y=Y>\n\n'+d+'\n</$let>X');
	test(t+'<$let x=X>\n\n<$let y=Y>\n\n'+d+'\n</$let></$let>X',
	       '<$let x=X y=Y>\n\n'+d+'</$let>X');
	test(  '<$let x=X>\n\n<$let y=Y>\n\n'+d+'\n</$let></$let>',
	       '<$let x=X y=Y>\n\n'+d+'\n</$let>');
	test(t+'<$let x=X>\n\n<$let y=Y>\n\n'+d+'\n</$let></$let>',
	       '<$let x=X y=Y>\n\n'+d);

	test(  '<$let x=X>\n\n<$let y=Y>\n\n'+d+'</$let></$let>',
	       '<$let x=X y=Y>\n\n'+d);
});

ifLetIt("folds inline together", function() {
	test(  '<$let x=X>\n<$let y=Y>\n'+d+'\n</$let></$let>',
	       '<$let x=X y=Y>\n<!---->\n'+d+'\n');
	test(t+'<$let x=X>\n<$let y=Y>\n'+d+'\n</$let></$let>',
	       '<$let x=X y=Y>'+d);
	test(  '<$let x=X>\n\t<$let y=Y>\n\t\t'+d+'\n</$let></$let>',
	       '<$let x=X y=Y>\n\t<!---->\n\t\t'+d+'\n');
	test(t+'<$let x=X>\n\t<$let y=Y>\n\t\t'+d+'\n</$let></$let>',
	       '<$let x=X y=Y>'+d);
	test(  '<$let x=X>\n\t<$let y=Y>\n\t\t'+d+'\n</$let></$let>\n\nX',
	       '<$let x=X y=Y>\n\t<!---->\n\t\t'+d+'\n</$let>\n\nX');
	test(t+'<$let x=X>\n\t<$let y=Y>\n\t\t'+d+'\n</$let></$let>\n\nX',
	       '<$let x=X y=Y>'+d+'</$let>\n\nX');
	test(  '<$let x=X><$let y=Y>\n\t'+d+'\n</$let></$let>\n\nX',
	       '<$let x=X y=Y>\n\t'+d+'\n</$let>\n\nX');
	test(t+'<$let x=X><$let y=Y>\n\t'+d+'\n</$let></$let>\n\nX',
	       '<$let x=X y=Y>'+d+'</$let>\n\nX');
});

ifLetIt("does not fold if comments not allowed", function() {
	const lets = '\n<$let x=X>\n<$let y=Y>\n'+d+'\n';
	test('\\rules except commentinline'+lets,
	     '\\rules except commentinline'+lets);
	test('\\rules only html'+lets,
	     '\\rules only html'+lets);
	test('\\rules except prettylink\n\\rules only html'+lets,
	     '\\rules except prettylink\n\\rules only html'+lets);
	test('\\rules except commentinline\n\\rules only html commentinline'+lets,
	     '\\rules except commentinline\n\\rules only html commentinline'+lets);
	// We can still fold with comments disabled if we're trimming whitespace
	test(t+'\\rules except commentinline'+lets,
	       '\\rules except commentinline\n<$let x=X y=Y>'+d);
	// Rules disabling uses their own context
	test('\\rules except commentinline\n\\define M()\n'+lets+'\\end'+lets+"\n<<M>>",
	     '\\rules except commentinline\n\\define M()\n<$let x=X y=Y>\n<!---->\n'+d+'\n\\end'+lets+"\n<<M>></$let>");
	test('\\define M()\n\\rules except commentinline'+lets+'\\end'+lets+"\n<<M>>",
	     '\\define M()\n\\rules except commentinline'+lets+'\\end\n<$let x=X y=Y>\n<!---->\n'+d+"\n\n<<M>></$let>");
});

ifLetIt("inline string inside other widgets", function() {
	test(  '<div>\n<$let x=X>\n<$let y=Y>\n'+d+'\n</$let></$let></div>',
	       '<div>\n<$let x=X y=Y>\n<!---->\n'+d+'\n');
	test(t+'<div>\n<$let x=X>\n<$let y=Y>\n'+d+'\n</$let></$let></div>',
	       '<div><$let x=X y=Y>'+d);
	// Closing tags on individual lines
	test(  '<div>\n<$let x=X>\n<$let y=Y>\n<$reveal/>\n</$let>\n</$let>\n</div>',
	       '<div>\n<$let x=X y=Y>\n<!---->\n<$reveal/>\n\n</$let>\n');
	test(t+'<div>\n<$let x=X>\n<$let y=Y>\n'+d+'\n</$let>\n</$let>\n</div>',
	       '<div><$let x=X y=Y>'+d);
	// Double outside <div>
	test(  '<div>\n<div>\n<$let x=X>\n<$let y=Y>\n<$reveal/>\n</$let>\n</$let>\n</div>\n</div>',
	       '<div>\n<div>\n<$let x=X y=Y>\n<!---->\n<$reveal/>\n\n</$let>\n</div>\n');
	test(t+'<div>\n<div>\n<$let x=X>\n<$let y=Y>\n'+d+'\n</$let>\n</$let>\n</div>\n</div>',
	       '<div><div><$let x=X y=Y>'+d);
	// Trailing text prevents tail cutting
	test(  '<div>\n<$let x=X>\n<$let y=Y>\n<$reveal/>\n</$let>\n</$let>\n</div>X',
	       '<div>\n<$let x=X y=Y>\n<!---->\n<$reveal/>\n\n</$let>\n</div>X');
	test(t+'<div>\n<$let x=X>\n<$let y=Y>\n<$reveal/>\n</$let>\n</$let>\n</div>X',
	       '<div><$let x=X y=Y><$reveal/></$let></div>X');
});

ifLetIt("folds inline inside block", function() {
	test(  '<$let x=X>\n\n<$let y=Y>\n<$reveal/>\n\n'+d+'\n</$let></$let>',
	       '<$let x=X y=Y>\n<$reveal/>\n\n'+d+'\n</$let>');
	// I think the one above doesn't need that closing tag
	test(t+'<$let x=X>\n\n<$let y=Y>\n<$reveal/>\n\n'+d+'\n</$let></$let>',
	       '<$let x=X y=Y><$reveal/>'+d);

	test(  '<$let x=X>\n\n<$let y=Y>\n<$reveal/>\n</$let></$let>',
	       '<$let x=X y=Y>\n<$reveal/>\n');
	test(t+'<$let x=X>\n\n<$let y=Y>\n<$reveal/>\n</$let></$let>',
	       '<$let x=X y=Y><$reveal/>');

	test(  '<$let x=X>\n\n<$let y=Y>\n<$reveal/>'+d+'</$let></$let>',
	       '<$let x=X y=Y>\n<$reveal/>'+d);
	test(t+'<$let x=X>\n\n<$let y=Y>\n<$reveal/>'+d+'</$let></$let>',
	       '<$let x=X y=Y><$reveal/>'+d);
});

ifLetIt("folds block inside inline, or tries its best", function() {
	test(  '<$let x=X>\n<$let y=Y>\n\n<$reveal/>\n\n</$let></$let>',
	       '<$let x=X>\n<$let y=Y>\n\n<$reveal/>\n');
	test(t+'<$let x=X>\n<$let y=Y>\n\n<$reveal/>\n\n</$let></$let>',
	       '<$let x=X><$let y=Y>\n\n<$reveal/>\n');

	test(  'X\n<$let x=X>\n<$let y=Y>\n\n<$reveal/>\n\n</$let></$let>',
	       'X\n<$let x=X>\n<$let y=Y>\n\n<$reveal/>\n');
	test(t+'X\n<$let x=X>\n<$let y=Y>\n\n<$reveal/>\n\n</$let></$let>',
	       'X<$let x=X><$let y=Y>\n\n<$reveal/>\n');

	test(  'X\n<$let x=X>\n\n<$let y=Y>\n\n<$reveal/>\n\n</$let></$let>',
	       'X\n<$let x=X y=Y>\n\n<$reveal/>\n');
	test(t+'X\n<$let x=X>\n\n<$let y=Y>\n\n<$reveal/>\n\n</$let></$let>',
	       'X<$let x=X y=Y>\n\n<$reveal/>\n');
});

ifLetIt('folds blocks together, and trims trailing newlines', function() {
	test(  '<$let x=X>\n\n<$let y=Y>\n\n'+d+'\n\n</$let>\n\n</$let>\n\nX',
	       '<$let x=X y=Y>\n\n'+d+'\n\n</$let>X');
	test(t+'<$let x=X>\n\n<$let y=Y>\n\n'+d+'\n\n</$let>\n\n</$let>\n\nX',
	       '<$let x=X y=Y>\n\n'+d+'\n\n</$let>X');
});

ifLetIt('matches inner closing tag up with proper $let', function() {
	test('<$let x=X><$let y=Y1>'+d+'</$let><$let y=Y2>'+d+'</$let></$let>X',
	     '<$let x=X><$let y=Y1>'+d+'</$let><$let y=Y2>'+d+'</$let></$let>X');
});

ifLetIt('does not care if closing tags are missing', function() {
	test('<$let x=X><$let y=Y z="Z">'+d,
	     '<$let x=X y=Y z=Z>'+d);
	test('<$let x=X><$let y=Y><$let z=Z>'+d+'</$let>',
	     '<$let x=X y=Y z=Z>'+d);
});

ifLetIt('no fold if text between opening tags', function() {
	test(  '<$let x=X>\n\nT\n\n<$let y=Y>\n\n<$reveal/>\n\n</$let>\n\n</$let>',
	       '<$let x=X y=Y>\n\nT\n\n<$reveal/>\n');
	test(t+'<$let x=X>\n\nT\n\n<$let y=Y>\n\n<$reveal/>\n\n</$let>\n\n</$let>',
	       '<$let x=X y=Y>\n\nT\n\n<$reveal/>\n');
	// inline inside block. Can't handle this when other blocks are there
	test(  '<$let x=X>\n\nT\n\n<$let y=Y>\n<$reveal/>\n</$let>\n\n</$let>',
	       '<$let x=X>\n\nT\n\n<$let y=Y>\n<$reveal/>\n');
	test(t+'<$let x=X>\n\nT\n\n<$let y=Y>\n<$reveal/>\n</$let>\n\n</$let>',
	       '<$let x=X>\n\nT\n\n<$let y=Y><$reveal/>');
});

ifLetIt('no fold if text between closing tags', function() {
	test(  '<$let x=X>\n\n<$let y=Y>\n\n<$reveal/>\n\n</$let>\n\nText</$let>',
	       '<$let x=X y=Y>\n\n<$reveal/>\n\nText');
	test(t+'<$let x=X>\n\n<$let y=Y>\n\n<$reveal/>\n\n</$let>\n\nText</$let>',
	       '<$let x=X y=Y>\n\n<$reveal/>\n\nText');
	// inline inside block
	test(  '<$let x=X>\n\n<$let y=Y>\n<$reveal/>\n</$let>\n\nText</$let>',
	       '<$let x=X>\n\n<$let y=Y>\n<$reveal/>\n</$let>\n\nText');
	test(t+'<$let x=X>\n\n<$let y=Y>\n<$reveal/>\n</$let>\n\nText</$let>',
	       '<$let x=X>\n\n<$let y=Y><$reveal/></$let>\n\nText');
});

ifLetIt('does not fold if placeholders are present', function() {
	test('\\define M(a)<$let x=X>$a$<$let y=Y><$reveal/></$let></$let>\n<<M "'+d+'">>',
	     '\\define M(a)<$let x=X>$a$<$let y=Y><$reveal/>\n<<M "'+d+'">>');
	test('\\define M(a)\n<$let x=X>\n\n$a$\n\n<$let y=Y>\n\n<$reveal/>\n\n</$let></$let>\n\\end\n<<M "'+d+'">>',
	     '\\define M(a)\n<$let x=X>\n\n$a$\n\n<$let y=Y>\n\n<$reveal/>\n\n\\end\n<<M "'+d+'">>');
	// placeholder between end tags
	test('\\define M(a) <$let x=X><$let y=Y><$reveal/></$let>$a$</$let>\n<<M "'+d+'">>',
	     '\\define M(a)<$let x=X><$let y=Y><$reveal/></$let>$a$</$let>\n<<M "'+d+'">>');
	test('\\define M(a)\n<$let x=X>\n\n<$let y=Y>\n\n<$reveal/>\n\n</$let>\n\n$a$\n\n</$let>\n\\end\n<<M "'+d+'">>',
	     '\\define M(a)\n<$let x=X>\n\n<$let y=Y>\n\n<$reveal/>\n\n</$let>$a$\n\n\n\\end\n<<M "'+d+'">>');
	test('\\define M(a)\n'+t+'<$let x=X>\n\n<$let y=Y>\n\n<$reveal/>\n\n</$let>\n\n$a$\n\n</$let>\n\\end\n<<M "'+d+'">>',
	     '\\define M(a)\n'+t+'<$let x=X>\n\n<$let y=Y>\n\n<$reveal/>\n\n</$let>$a$\n\n\n\\end\n<<M "'+d+'">>');
});

ifLetIt('manages placeholders inside inner let', function() {
	// Simple test
	test('\\define M(a)<$let x=X><$let y=Y>$a$</$let></$let>\n<<M "<$reveal/>">>',
	     '\\define M(a)<$let x=X><$let y=Y>$a$</$let>\n<<M "<$reveal/>">>');
	// Inline inside inline with newlines between
	test('\\define M(a)\n<$let x=X>\n<$let y=Y>$a$</$let>\n</$let>\n\\end\n<<M "<$reveal/>">>',
	     '\\define M(a)\n<$let x=X>\n<$let y=Y>$a$</$let>\n\n\\end\n<<M "<$reveal/>">>');
	test('\\define M(a)\n<$let x=X>\n<$let y=Y>$a$</$let>\n</$let>\n\\end\n<<M "\n\n<$reveal/>\n\n">>',
	     '\\define M(a)\n<$let x=X>\n<$let y=Y>$a$</$let>\n\n\\end\n<<M "\n\n<$reveal/>\n\n">>');
	test('\\define M(a)\n'+t+'<$let x=X>\n<$let y=Y>$a$</$let>\n</$let>\n\\end\n<<M "\n\n<$reveal/>\n\n">>',
	     '\\define M(a)\n'+t+'<$let x=X><$let y=Y>$a$</$let>\n\\end\n<<M "\n\n<$reveal/>\n\n">>');
	// Inline inside block (but placeholder can make it block inside block)
	test('\\define M(a)\n<$let x=X>\n\n<$let y=Y>$a$</$let></$let>\n\\end\n<<M "<$reveal/>">>',
	     '\\define M(a)<$let x=X y=Y>$a$</$let>\n<<M "<$reveal/>">>');
	test('\\define M(a)\n<$let x=X>\n\n<$let y=Y>$a$</$let></$let>\n\\end\n<<M "\n\n<$reveal/>\n\n">>',
	     '\\define M(a)<$let x=X y=Y>$a$</$let>\n<<M "\n\n<$reveal/>\n\n">>');
	//Inline inside inline but at the end of inner text
	test('\\define M(a)\n<$let x=X>\n<$let y=Y><$text text=d/>\n\n$a$</$let>\n</$let>\n\\end\n<<M "<$reveal/>">>',
	     '\\define M(a)\n<$let x=X y=Y>\n<$text text=d/>\n\n$a$\n\n\\end\n<<M "<$reveal/>">>');
});

});});});
