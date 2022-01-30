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
const cmp = $tw.utils.test.wikitext.cmp;
const ifLetIt = $tw.utils.test.wikitext.ifLetIt;
// Note that this does not print the value of "m", since that's the macro
// name I use in tests, and it should change.
const dump = "<$text text={{{[variables[]join[,]] =[variables[]!match[m]getvariable[]join[,]]+[join[;]]}}}/>";
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
	test('<$set  name="" value=v>'+dump, '<$set name=""value=v>'+dump);
	test('<$set  name="f/s" value=v>'+dump, '<$set name="f/s"value=v>'+dump);
	test('<$set  name="s p" value=v>'+dump, '<$set name="s p"value=v>'+dump);
	test('<$set  name="g>t" value=v>'+dump, '<$set name="g>t"value=v>'+dump);
	test('<$set  name="e=q" value=v>'+dump, '<$set name="e=q"value=v>'+dump);
	test("<$set  name='q\"t' value=v>"+dump, "<$set name='q\"t'value=v>"+dump);
	test('<$set  name="a\'p" value=v>'+dump, '<$set name="a\'p"value=v>'+dump);
	// legal
	test('<$set  name="\\()$@:#!" value=v>'+dump, vars+' \\()$@:#!=v>'+dump);
});

it('goes to $vars if $let is not available', function() {
	spyOn(parseUtils, "letAvailable").and.returnValue(false);
	test('<$set name=n value=v>'+dump, '<$vars n=v>'+dump);
});

//////// Test the simple filter $set, which can't be converted

it('filter attr gets trimmed up', function() {
	test('<$set name=n filter="A [[B C]] +[addsuffix[s]]">'+dump,
	     '<$set filter="A[[B C]]+[addsuffix[s]]"name=n>'+dump);
	// If that macrocall is enterpreted as a string,
	// it would get wrongfully altered.
	test('\\define M(a b)$a$-$b$-C\n<$set name=n filter=<<M "x y" [[z]]>>>'+dump,
	     '\\define M(a b)$a$-$b$-C\n<$set filter=<<M "x y" [[z]]>>name=n>'+dump);
	// If this were treated as a filter, A and B would smush together.
	test('<$set name=n filter={{A  B!!title}}>'+dump,
	     '<$set filter={{A  B!!title}}name=n>'+dump);
});

//////// Test of emptyValue and value used with filter

it('emptyValue & value to $let', function() {
	// String values
	test('<$set name=v filter="A B" value=yes emptyValue=no>'+dump,
	     vars+' v={{{A B +[then[yes]else[no]]}}}>'+dump);
	test('<$set name=v filter="A -A" value=yes emptyValue=no>'+dump,
	     vars+' v={{{A -A +[then[yes]else[no]]}}}>'+dump);
	// The filter string is allowed to have brackets
	test('<$set name=v filter="[tag[A]]" value=yes emptyValue=no>'+dump,
	     vars+' v={{{[tag[A]] +[then[yes]else[no]]}}}>'+dump);
	// If we don't have a "value", we can't do anything. Value is needed
	// or else we can't set the variable correctly if emptyValue isn't used.
	test('<$set name=v filter="A [[B C]]"  emptyValue=no>'+dump,
	     '<$set name=v filter="A [[B C]]"emptyValue=no>'+dump);
	test('<$set name=v filter="A -A"  emptyValue=no>'+dump,
	     '<$set name=v filter="A -A"emptyValue=no>'+dump);
});

it('emptyValue & value with macrocalls', function() {
	// Only the filter argument can be a macro parameter
	test('\\define m(x) A -$x$\n<$set name=v filter=<<m B>> value=yes emptyValue=no>'+dump,
	     '\\define m(x)A -$x$\n<$let v={{{[subfilter<m B>] +[then[yes]else[no]]}}}>'+dump);
	test('\\define m(x) A -$x$\n<$set name=v filter=<<m A>> value=yes emptyValue=no>'+dump,
	     '\\define m(x)A -$x$\n<$let v={{{[subfilter<m A>] +[then[yes]else[no]]}}}>'+dump);
	// No other arguments benefit if they are macros
	test('\\define m(b)test $b$\n<$set name=v filter="A -A" value=yes emptyValue=<<m  no>>>'+dump,
	     '\\define m(b)test $b$\n<$set name=v filter="A -A"emptyValue=<<m no>>value=yes>'+dump);
	// even when the macro is not defined, it should still convert
	test('<$set name=v filter="A -A" value=yes emptyValue=<<m  no>>>'+dump,
	     '<$set name=v filter="A -A"emptyValue=<<m no>>value=yes>'+dump);
	// This does not get converted because "value" macro values can have
	// slightly different behavior than as a combined :and filter.
	test('\\define m(b)test $b$\n<$set name=v filter="A B" value=<<m  yes>> emptyValue=no>'+dump,
	     '\\define m(b)test $b$\n<$set name=v filter="A B"value=<<m yes>>emptyValue=no>'+dump);
	// This test confirms why. The macro is undefined.
	test('<$set name=v filter="A B" value=<<m  yes>> emptyValue=no>'+dump,
	     '<$set name=v filter="A B"value=<<m yes>>emptyValue=no>'+dump);
});

it('emptyValue & value with indirect', function() {
	const wiki = new $tw.Wiki();
	wiki.addTiddler({title: 'test', X: 'yes', N: 'no', filtY: 'A -B', filtN: 'A -A'});
	test('<$set name=v filter={{!!filtY}} value=yes emptyValue=no>'+dump,
	     '<$set name=v filter={{!!filtY}}value=yes emptyValue=no>'+dump, {wiki: wiki});
	test('<$set name=v filter="A B" value={{!!Y}} emptyValue={{!!N}}>'+dump,
	     vars+' v={{{A B +[then{!!Y}else{!!N}]}}}>'+dump, {wiki: wiki});
	test('<$set name=v filter="A -A" value={{!!Y}} emptyValue={{!!N}}>'+dump,
	     vars+' v={{{A -A +[then{!!Y}else{!!N}]}}}>'+dump, {wiki: wiki});
	// missing tiddler
	test('<$set name=v filter={{M!!filtY}} value=yes emptyValue=no>'+dump,
	     '<$set name=v filter={{M!!filtY}}value=yes emptyValue=no>'+dump, {wiki: wiki});
	test('<$set name=v filter="A B" value={{M!!Y}} emptyValue={{M!!N}}>'+dump,
	     vars+' v={{{A B +[then{M!!Y}else{M!!N}]}}}>'+dump, {wiki: wiki});
	test('<$set name=v filter="A -A" value={{M!!Y}} emptyValue={{M!!N}}>'+dump,
	     vars+' v={{{A -A +[then{M!!Y}else{M!!N}]}}}>'+dump, {wiki: wiki});
	// missing field
	test('<$set name=v filter={{!!filtZ}} value=yes emptyValue=no>'+dump,
	     '<$set name=v filter={{!!filtZ}}value=yes emptyValue=no>'+dump, {wiki: wiki});
	test('<$set name=v filter="A B" value={{!!Z}} emptyValue={{!!W}}>'+dump,
	     vars+' v={{{A B +[then{!!Z}else{!!W}]}}}>'+dump, {wiki: wiki});
	test('<$set name=v filter="A -A" value={{!!Z}} emptyValue={{!!W}}>'+dump,
	     vars+' v={{{A -A +[then{!!Z}else{!!W}]}}}>'+dump, {wiki: wiki});
});

it('emptyValue & value with filtered attributes', function() {
	// Or rather how we DON'T support filtered attributes.
	// There's nothing we can do with them.
	test('<$set name=v filter={{{ A B }}} value=yes emptyValue=no>'+dump,
	     '<$set name=v filter={{{A B}}}value=yes emptyValue=no>'+dump);
	test('<$set name=v filter="A B" value={{{ yes }}} emptyValue=no>'+dump,
	     '<$set name=v filter="A B"value={{{yes}}}emptyValue=no>'+dump);
	test('<$set name=v filter="A B" value=yes emptyValue={{{ no }}}>'+dump,
	     '<$set name=v filter="A B"emptyValue={{{no}}}value=yes>'+dump);
});

it('emptyValue & value and quotation in macro arguments ', function() {
	// Ordinarily, the macrocall stringifier would prefer
	// to use [[brackets]] rather than "quotes", but that
	// can't be done for macros inside filters.
	test('\\define m(b)test $b$\n<$set name=v filter="A B" value=yes emptyValue=<<m "n o">>>'+dump,
	     '\\define m(b)test $b$\n<$set name=v filter="A B"emptyValue=<<m [[n o]]>>value=yes>'+dump);
	// This seems very dangerous, but it's fine.
	test('\\define m(b)test $b$\n<$set name=v filter="A B" value=yes emptyValue=<<m "n]]o">>>'+dump,
	     '\\define m(b)test $b$\n<$set name=v filter="A B"emptyValue=<<m n]]o>>value=yes>'+dump);
	test('<$set name=v filter="A -A" value=yes emptyValue={{n]o}}>'+dump,
	     vars+' v={{{A -A +[then[yes]else{n]o}]}}}>'+dump);
	// The macro attribute gets parsed differently. Not allowed, even in quotes
	test('\\define m(b)test $b$\n<$set name=v filter="A B" value=yes emptyValue=<<m  "n>o">>>'+dump,
	     '\\define m(b)test $b$\n<$set name=v filter="A B"emptyValue=<<m [[n>o]]>>value=yes>'+dump);
});

it('emptyValue & value with bad values', function() {
	test('<$set name=v filter="A -A" value=yes emptyValue="n}}}o">'+dump,
	     '<$set name=v filter="A -A"value=yes emptyValue=n}}}o>'+dump);
	test('<$set name=v filter="A -A" value=yes emptyValue="n]o">'+dump,
	     '<$set name=v filter="A -A"value=yes emptyValue=n]o>'+dump);
	// Macros, they only work on the filter attribute
	test('<$set name=v filter=<<m t}}}s>> value=yes emptyValue=no>'+dump,
	     '<$set name=v filter=<<m t}}}s>>value=yes emptyValue=no>'+dump);
	test('<$set name=v filter=<<m "te>st">> value=yes emptyValue=no>'+dump,
	     '<$set name=v filter=<<m [[te>st]]>>value=yes emptyValue=no>'+dump);
	// Indirect
	//		This is actually legal. I wouldn't have thought so.
	test('<$set name=v filter="A -A" value=yes emptyValue={{n}o}}>'+dump,
	     vars+' v={{{A -A +[then[yes]else[{{n}o}}]]}}}>'+dump);
	// make sure "value" is tested too, but we'll do most of our testing
	// on "emptyValue".
	test('<$set name=v filter="A B" value="y}}}es" emptyValue=no>'+dump,
	     '<$set name=v filter="A B"value=y}}}es emptyValue=no>'+dump);
});

it('emptyValue & value with placeholders', function() {
	// If there are any placeholders, the whole thing is too dangerous to
	// touch
	test('\\define M(x)<$set name=v filter="$x$"value=yes emptyValue=no>'+dump+'\n<<M A}}}B>>',
	     '\\define M(x)<$set name=v filter="$x$"value=yes emptyValue=no>'+dump+'\n<<M A}}}B>>');
	test('\\define M(x)<$set name=v filter="A B"value="$x$"emptyValue=no>'+dump+'\n<<M y}}}es>>',
	     '\\define M(x)<$set name=v filter="A B"value="$x$"emptyValue=no>'+dump+'\n<<M y}}}es>>');
	test('\\define M(x)<$set name=v filter="A -A"emptyValue="$x$"value=yes>'+dump+'\n<<M n}}}o>>',
	     '\\define M(x)<$set name=v filter="A -A"emptyValue="$x$"value=yes>'+dump+'\n<<M n}}}o>>');
});

});});});
