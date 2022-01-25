/*\
title: Test/wikitext/html/vars.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier's ability to convert $vars to $let

\*/

describe('wikitext uglifier', function() {
describe('html', function() {
describe('$vars', function() {

const parseUtils = require("$:/plugins/flibbles/uglify/wikitext/utils.js");
const test = $tw.utils.test.wikitext.test;
const ifLetIt = $tw.utils.test.wikitext.ifLetIt;
const t = "\\whitespace trim\n";
const d = "<$text text={{{[variables[]join[,]] =[variables[]!match[M]getvariable[]join[,]]+[join[;]]}}}/>";

ifLetIt('handles different surrounding cases', function() {
	// No closing tag
	test('<$vars x="A_B">'+d, '<$let x=A_B>'+d);
	// Closing tag
	test('<$vars x="A_B">'+d+'</$vars>X', '<$let x=A_B>'+d+'</$let>X');
	// Block
	test('<$vars x="A">\n\n'+d+'\n\n</$vars>', '<$let x=A>\n\n'+d+'\n');
	// No vars for some reason
	test('<$vars>'+d, '<$let>'+d);
	// Only one dependent var
	const m = "\\define m()--$(x)$--$(y)$--$(z)$--\n";
	test(m+'<$vars x=<<m>>>'+d, m+'<$let x=<<m>>>'+d);
});

ifLetIt('indirect with specified tiddler', function() {
	const wiki = new $tw.Wiki();
	const m = "\\define m()--$(x)$--$(y)$--$(z)$--\n";
	wiki.addTiddler({title: "A", text: "index: index_v", field: "field_v", type:'application/x-tiddler-dictionary'});
	test('<$vars x={{A!!field}} y=<<m>> z={{A##index}}>'+d,
	     '<$let y=<<m>>x={{A!!field}}z={{A##index}}>'+d,
	     {wiki: wiki});
	// Now while messing with currentTiddler
	test('<$vars x={{A!!field}} currentTiddler="m h" y=<<m>> z={{A##index}}>'+d,
	     '<$let y=<<m>>x={{A!!field}}currentTiddler="m h"z={{A##index}}>'+d,
	     {wiki: wiki});
});

ifLetIt('indirect with current tiddler', function() {
	const wiki = new $tw.Wiki();
	const m = "\\define m()--$(x)$--$(y)$--$(z)$--\n";
	wiki.addTiddler({title: "test", field: "field_value"});
	test('<$vars x={{!!field}} y=<<m>>>'+d,
	     '<$let y=<<m>>x={{!!field}}>'+d, {wiki: wiki});
	// Now while messing with currentTiddler
	test('<$vars currentTiddler="n o" x=<<m>> y={{!!field}}>'+d,
	     '<$vars currentTiddler="n o"x=<<m>>y={{!!field}}>'+d, {wiki: wiki});
	// But we can have one currentTiddler-dependent indirect
	test('<$vars currentTiddler="n o" y={{!!field}}>'+d,
	     '<$let y={{!!field}}currentTiddler="n o">'+d, {wiki: wiki});
});

ifLetIt('placeholders in string attributes', function() {
	test('\\define y()first\n\\define M(x)<$vars __x__=A y=second z="$x$--$(y)$">'+d+'\n<<M value>>',
	     '\\define y()first\n\\define M(x)<$let __x__=A z="$x$--$(y)$"y=second>'+d+'\n<<M value>>');
	// Now a version where __x__ and y don't bump to the end.
	test('\\define y()first\n\\define M(x)<$vars __x__="A B" y="sec ond" z="$x$--$(y)$">'+d+'\n<<M value>>',
	     '\\define y()first\n\\define M(x)<$let __x__="A B"y="sec ond"z="$x$--$(y)$">'+d+'\n<<M value>>');
});

ifLetIt('placeholders in indirect attribute', function() {
	const wiki = new $tw.Wiki();
	const m = "\\define Z()--$(x)$--$(y)$--$(z)$--\n";
	wiki.addTiddlers([
		{title: "test", field: "field_value"},
		{title: "T", field: "test_field_value"}]);
	// currentTiddler is sneakily used
	test(m+'\\define M(x)<$vars currentTiddler="n o" x=<<Z>> y={{$x$!!field}}>'+d+'\n<<M>>',
	     m+'\\define M(x)<$vars currentTiddler="n o"x=<<Z>>y={{$x$!!field}}>'+d+'\n<<M>>',
	     {wiki: wiki});
	// It's okay if placeholders are in the second half of indirects
	test(m+'\\define M(x)<$vars currentTiddler="n o" x=<<Z>> y={{T!!$x$}}>'+d+'\n<<M field>>',
	     m+'\\define M(x)<$let x=<<Z>>currentTiddler="n o"y={{T!!$x$}}>'+d+'\n<<M field>>',
	     {wiki: wiki});
});

ifLetIt('reorders possibly dependent variables appropriately', function() {
	const m = "\\define m()--$(x)$--$(y)$--$(z)$--\n";
	test(m+'<$vars x=<<m>> y=A z=B>'+d, m+'<$let x=<<m>>y=A z=B>'+d);
	test(m+'<$vars x=A y=<<m>> z=B>'+d, m+'<$let y=<<m>>x=A z=B>'+d);
	test(m+'<$vars x=A y=B z=<<m>>>'+d, m+'<$let z=<<m>>x=A y=B>'+d);
});

ifLetIt('skips if more than one dependent variable', function() {
	const m = "\\define m(W)--$(x)$--$(y)$--$(z)$--$W$--\n";
	test(m+'<$vars x=<<m 1>> y=<<m 2>> z=A>'+d, m+'<$vars x=<<m 1>>y=<<m 2>>z=A>'+d);
	test(m+'<$vars z=A x=<<m 1>> y=<<m 2>>>'+d, m+'<$vars z=A x=<<m 1>>y=<<m 2>>>'+d);
});

ifLetIt('optimizes by moving non-quote strings to end', function() {
	const m = "\\define m(W)--$(x)$--$(y)$--$(z)$--$W$--\n";
	test("<$vars x='A B' y=C z='D E'>"+d, "<$let x='A B'z='D E'y=C>"+d);
	test("<$vars x=A y='B C' z=<<m G>>>"+d, "<$let z=<<m G>>y='B C'x=A>"+d);
});

});});});
