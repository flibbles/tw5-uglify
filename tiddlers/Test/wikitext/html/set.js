/*\
title: Test/wikitext/html/set.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with html and widgets.

\*/

describe('wikitext uglifier', function() {
describe('html', function() {
describe('$set', function() {

const parseUtils = require("$:/plugins/flibbles/uglify/wikitext/utils.js");
const test = $tw.utils.test.wikitext.test;
const ifLetIt = $tw.utils.test.wikitext.ifLetIt;
const dump = "<$text text={{{[variables[]join[,]]}}}/>";
const vars = parseUtils.letAvailable() ? "<$let" : "<$vars";
const close = parseUtils.letAvailable() ? "</$let>" : "</$vars>";

it('value types', function() {
	test('<$set name="v" value="var">'+dump, vars+' v=var>'+dump);
	test('<$set name="v" value={{!!title}}>'+dump, vars+' v={{!!title}}>'+dump);
	test('<$set name="v" value={{{ [[title]] }}}>'+dump,
		vars+' v={{{[[title]]}}}>'+dump);
	test('\\define mac()stuff\n<$set name="v" value=<<mac>>>'+dump,
		'\\define mac()stuff\n'+vars+' v=<<mac>>>'+dump);
	test('<$set name="v" value=<<currentTiddler>>>'+dump,
		vars+' v=<<currentTiddler>>>'+dump);
	// arguments can be switched around
	test('<$set value="var" name="v">'+dump, vars+' v=var>'+dump);
	// Make sure the closing tag is different too.
	test('<$set name="v" value="va">'+dump+'</$set>X',
		vars+' v=va>'+dump+close+'X');
});

it('other attributes prevent', function() {
	// Technically, we could actually do something with this, but
	// it's too complicated for me to bother with right now.
	// and with too little returns.
	test('<$set name="v" value="var" emptyValue="empty">'+dump,
		'<$set name=v value=var emptyValue=empty>'+dump);
});

it('placeholders in value', function() {
	test('\\define m(a)<$set name="v" value="""$a$""">'+dump+'\n<<m B>>',
		'\\define m(a)'+vars+' v="""$a$""">'+dump+'\n<<m B>>');
	test('\\define m(a)<$set name="v" value="$a$">'+dump+'\n<<m B>>',
		'\\define m(a)'+vars+' v="$a$">'+dump+'\n<<m B>>');
});

it('legal names', function() {
	// illegal
	test('<$set  name="" value=v>'+dump, '<$set name="" value=v>'+dump);
	test('<$set  name="f/s" value=v>'+dump, '<$set name="f/s" value=v>'+dump);
	test('<$set  name="s p" value=v>'+dump, '<$set name="s p" value=v>'+dump);
	test('<$set  name="g>t" value=v>'+dump, '<$set name="g>t" value=v>'+dump);
	test('<$set  name="e=q" value=v>'+dump, '<$set name="e=q" value=v>'+dump);
	test("<$set  name='q\"t' value=v>"+dump, "<$set name='q\"t' value=v>"+dump);
	test('<$set  name="a\'p" value=v>'+dump, '<$set name="a\'p" value=v>'+dump);
	// legal
	test('<$set  name="\\()$@:#!" value=v>'+dump, vars+' \\()$@:#!=v>'+dump);
});

it('goes to $vars if $let is not available', function() {
	spyOn(parseUtils, "letAvailable").and.returnValue(false);
	test('<$set name=n value=v>'+dump, '<$vars n=v>'+dump);
});

});});});
