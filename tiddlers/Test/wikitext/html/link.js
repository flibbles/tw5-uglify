/*\
title: Test/wikitext/html/link.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with html attributes
which contain more wikitext.

\*/

describe('wikitext uglifier', function() {
describe('html', function() {
describe('nested', function() {

const test = $tw.utils.test.wikitext.test;
const t = "\\whitespace trim\n";

it('removes unnecessary to attributes', function() {
	test('<$link to=<<currentTiddler>>>Link</$link>', '<$link>Link');
	test('<$link to=<<currentTiddler   >>>Link</$link>', '<$link>Link');
	test('<$link to={{!!title}}>Link</$link>', '<$link>Link');
	// These ones should not convert
	test('<$link to=<< currentTiddler>>>Link</$link>', '<$link to << currentTiddler>>>Link');
	test('<$link to=<<currentTiddler val>>>Link</$link>', '<$link to=<<currentTiddler val>>>Link');
	test('<$link to={{!!title }}>Link</$link>', '<$link to={{!!title }}>Link');
	test('<$link to={{ !!title}}>Link</$link>', '<$link to={{ !!title}}>Link');
	test('<$link to={{!! title}}>Link</$link>', '<$link to={{!! title}}>Link');
	test('<$link class=butts to=<<currentTiddler>>>Link</$link>', '<$link class=butts>Link');
});

it('compresses nested tooltip attr', function() {
	test('<$link tooltip="<$text  text=stuff/>">Link',
	     '<$link tooltip="<$text text=stuff/>">Link');
	test('<$link tooltip=<<text  text>>>Link',
	     '<$link tooltip=<<text text>>>Link');
});

it('removes inner content when it could be assumed', function() {
	const tid = "<$tiddler tiddler=[[TestWiki]]>";
	test(tid+"<$link to=<<currentTiddler>>><$view field=title/></$link>X",
	     tid+"<$link/>X");
	test(tid+"<$link to={{!!title}}><$view field=title/></$link>X",
	     tid+"<$link/>X");
	test(tid+"<$link ><$view field=title/></$link>X",
	     tid+"<$link/>X");
	// These can't change because they don't point to currentTiddler
	test(tid+"<$link to='currentTiddler'><$transclude field=title/></$link>X",
	     tid+"<$link to=currentTiddler><$transclude field=title/></$link>X");
	// Different forms of inner content
	test(tid+"<$link><$view field='title' /></$link>X",
	     tid+"<$link/>X");
	test(tid+"<$link><$text text=<<currentTiddler>> /></$link>X",
	     tid+"<$link/>X");
	test(tid+"<$link><$text text={{!!title}}  /></$link>X",
	     tid+"<$link/>X");
	// Whitespace trim
	test(  tid+"<$link>\n<$view field=title/>\n</$link>\nX",
	       tid+"<$link>\n<$view field=title/>\n</$link>\nX");
	test(t+tid+"<$link>\n<$view field=title/>\n</$link>\nX",
	       tid+"<$link/>X");
	// These can't actually change. They're dangerous
	test(tid+"<$link><$transclude  field=title/></$link>X",
	     tid+"<$link><$transclude field=title/></$link>X");
	test(tid+"<$link><$view field='title' />Content</$link>X",
	     tid+"<$link><$view field=title/>Content</$link>X");
	test(tid+"<$link ><<currentTiddler>></$link>X",
	     tid+"<$link><<currentTiddler>></$link>X");
	test(tid+"<$link >{{!!title}}</$link>X",
	     tid+"<$link>{{!!title}}</$link>X");
	test(tid+"<$link></$link>X", tid+"<$link></$link>X");
	test(tid+"<$link />X", tid+"<$link/>X");
});

it('maintains inline or block status', function() {
	test("<$link><$view field=title /></$link>\n\nContent",
	     "<$link></$link>\n\nContent");
	test("\\rules except prettylink\n<$link><$view field=title /></$link>\n\nContent",
	     "\\rules except prettylink\n<$link></$link>\n\nContent");
	test("<$link><$view field=title/></$link>\n",
	     "<$link></$link>\n");
	test("<div>\n<$link><$view field=title /></$link>\n\nContent</div>",
	     "<div>\n<$link/>\n\nContent");
	test("Stuff\n<$link><$view field=title /></$link>\n\nContent",
	     "Stuff\n<$link/>\n\nContent");
	test("Stuff\n\n<$link><$view field=title /></$link>\n\nContent",
	     "Stuff\n\n<$link></$link>\n\nContent");
	test("<$link><$view field=title /></$link>\nContent",
	     "<$link/>\nContent");
	// If link as at the end, then closing tag is omitted
	// This is hard to figure out in all cases, but we can do it in these ones.
	test(t+"<$link><$view field=title /></$link>\n", "<$link>");
	test(t+"<div>\n\n<$link><$view field=title/></$link>\n", "<div>\n\n<$link>");
});

});});});
