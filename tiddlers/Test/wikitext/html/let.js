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

ifLetIt('can fold converted let together', function() {
	test('<$set name=x value=X><$let y=Y>'+d+'</$let></$set>',
	     '<$let x=X y=Y>'+d);
	test('<$let x=X><$set name=y value=Y>'+d+'</$set></$let>',
	     '<$let x=X y=Y>'+d);
	test('<$set name=x value=X><$set name=y value=Y>'+d+'</$set></$set>',
	     '<$let x=X y=Y>'+d);
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

ifLetIt("inline string inside other widgets", function() {
	test(  '<div>\n<$let x=X>\n<$let y=Y>\n'+d+'\n</$let></$let></div>',
	       '<div>\n<$let x=X y=Y>\n<!---->\n'+d+'\n');
	test(t+'<div>\n<$let x=X>\n<$let y=Y>\n'+d+'\n</$let></$let></div>',
	       '<div><$let x=X y=Y>'+d);
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
	// TODO: We can support these. It just has to do the same thing that the
	//       test above is doing with text between opening tags.
	test(  '<$let x=X>\n\n<$let y=Y>\n\n<$reveal/>\n\n</$let>\n\nText</$let>',
	       '<$let x=X>\n\n<$let y=Y>\n\n<$reveal/>\n\n</$let>Text');
	test(t+'<$let x=X>\n\n<$let y=Y>\n\n<$reveal/>\n\n</$let>\n\nText</$let>',
	       '<$let x=X>\n\n<$let y=Y>\n\n<$reveal/>\n\n</$let>Text');
	// inline inside block
	test(  '<$let x=X>\n\n<$let y=Y>\n<$reveal/>\n</$let>\n\nText</$let>',
	       '<$let x=X>\n\n<$let y=Y>\n<$reveal/>\n</$let>\n\nText');
	test(t+'<$let x=X>\n\n<$let y=Y>\n<$reveal/>\n</$let>\n\nText</$let>',
	       '<$let x=X>\n\n<$let y=Y><$reveal/></$let>\n\nText');
});

});});});
