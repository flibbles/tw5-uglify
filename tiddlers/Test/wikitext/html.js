/*\
title: Test/wikitext/html.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with html and widgets.

\*/

describe('wikitext uglifier', function() {
describe('html', function() {

const test = $tw.utils.test.wikitext.test;
const cmp = $tw.utils.test.wikitext.cmp;
const ifLetIt = $tw.utils.test.wikitext.ifLetIt;
const t = "\\whitespace trim\n";

it('whitespace among attributes', function() {
	const dump = "<$text text={{{[variables[]join[,]]}}}/>";
	test('Z<$vars  a="X"  >'+dump, "Z<$vars a=X>"+dump);
	test('Z<$vars\n\ta  =  "X"\n>'+dump, "Z<$vars a=X>"+dump);
	test("<$vars  a='X'  >\n\n"+dump, "<$vars a=X>\n\n"+dump);
});

it('string attributes', function() {
	const dump = "<<dumpvariables>>";
	test('<$vars a="""X""">'+dump, "<$vars a=X>"+dump);
	test('<$vars a="""file/path""">'+dump, '<$vars a="file/path">'+dump);
	test('<$vars a="""bad>char""">'+dump, '<$vars a="bad>char">'+dump);
	test('<$vars a="""bad=char""">'+dump, '<$vars a="bad=char">'+dump);
	test('<$vars a="""attr space""">'+dump, '<$vars a="attr space">'+dump);
	test('Bob\'s<$vars a="""f/p""">'+dump, "Bob's<$vars a='f/p'>"+dump);
	test('<$vars a="""$love#@<()\\""">'+dump, "<$vars a=$love#@<()\\>"+dump);
	// Prefers single quotes to double brackets
	test('[[Bob\'s]]<$vars a="""f/p""">'+dump, "[[Bob's]]<$vars a='f/p'>"+dump);
	// Quotes in attribute
	test('<$text text="""f\"p"""/>', '<$text text="""f\"p"""/>');
	test('Bob\'s<$text text="""f\"p"""/>', "Bob's<$text text='f\"p'/>");
	test('<$text text="""Nick\'s"""/>', '<$text text="Nick\'s"/>');
	test('<$text text="Nick\'s"/>', '<$text text="Nick\'s"/>');
	test('<$text text="$$"/>', '<$text text=$$/>'); // null placeholder test
	// Brackets aren't treated as quotes
	test("<$text text=[[content]] />", "<$text text=[[content]]/>");
	test("<$text text=[[con tent]] />'", "<$text text=[[con tent]]/>'");
});


it('empty attributes', function() {
	test('<$text text=""/>', '<$text text=""/>');
	test('B\'s<$text text=""/>', "B's<$text text=''/>");
});

it('indirect attributes', function() {
	test('<$text text={{tiddler}} />', '<$text text={{tiddler}}/>');
	test('<$text text={{tid!!field}} />', '<$text text={{tid!!field}}/>');
	test('<$text text={{tid  !!title}} />', '<$text text={{tid  !!title}}/>');
});

it('macro attributes', function() {
	const m = "\\define m(val t f)Output:$val$,$t$,$f$\n";
	test('<$text text=<<m>> />', '<$text text=<<m>>/>');
	test('<$vars a={{tiddler}} />', '<$vars a={{tiddler}}/>');
	test(m+'<$text text=<<m   >> />', m+'<$text text=<<m>>/>');
	test(m+'<$text text=<<m val:t >> />', m+'<$text text=<<m val:t>>/>');
});

it('filter attributes', function() {
	test("<$text text={{{ butts }}}  />", "<$text text={{{butts}}}/>");
});

it('valueless attributes', function() {
	test("<$text text />", "<$text text/>");
	test("<$text text = 'true' />", "<$text text/>");
});

it('contents', function() {
	test("B<$vars  a='X'  >In</$vars>A", "B<$vars a=X>In</$vars>A");
	test("<$vars  a='X'  >\n\nIn</$vars>", "<$vars a=X>\n\nIn");
	test("<$vars  a='X'  >\n\nIn</$vars>\n", "<$vars a=X>\n\nIn");
	test("<div>\n\n!aardvark\n\n</div>", "<div>\n\n!aardvark");
	test("<$vars>\n\n\nIn</$vars>\n", "<$vars>\n\nIn");
	test("<$vars>\n\nIn</$vars>\n\n", "<$vars>\n\nIn");
	test("<$vars>\n\nIn</$vars>\nA", "<$vars>\n\nIn</$vars>\nA");
	test("B<$vars  a='X'  />After", "B<$vars a=X/>After");
	test("B\n\n<$vars  a='X'  />\n\nAfter", "B\n\n<$vars a=X/>\n\nAfter");
	test("B\n\n\n<$vars  a='X'  />\n\n\nA", "B\n\n\n<$vars a=X/>\n\n\nA");
});

it('void elements', function() {
	test("top<br>bottom", "top<br>bottom");
	test("top<br/>bottom", "top<br>bottom");
});

ifLetIt('handles html attribute ordering', function() {
	test("<$let\n2=cat\n1=dog>In</$let>", "<$let 2=cat 1=dog>In");
});

it('purges unnecessary closing tags', function() {
	test("<div><span>Content</span></div>", "<div><span>Content");
	test("<div><span>Content</span></div>\n", "<div><span>Content</span></div>\n");
	test("\\whitespace trim\n<div><span>Content</span></div>\n", "<div><span>Content");
	test("<div><span>text</span></div> ", "<div><span>text</span></div> ");
	test("<div>\nContent\n\n</div>", "<div>\nContent\n\n");
	test("<div>\nContent\n\n</div>\n", "<div>\nContent\n\n</div>\n");
	test("\\whitespace trim\n<div>\nContent\n\n</div>\n", "<div>Content");
	test("<div>\n\nContent\n\n</div>\n", "<div>\n\nContent");
	test("<div>\n\n<div>\n\nContent</div></div>\n", "<div>\n\n<div>\n\nContent");
	test("<div>\n\n<div>\n\nContent\n\n</div>\n\n</div>\n\n", "<div>\n\n<div>\n\nContent");
	// self closing elements don't have trash, and need to keep trailing \n
	test("<$reveal/>", "<$reveal/>");
	test("<$reveal/>\n", "<$reveal/>\n");
	test("<$reveal/>\n\n", "<$reveal/>\n");
	// mismatch
	test("<div><span>Content</div>", "<div><span>Content</div>");
	// many trailing newline characters
	test("B\n\n<$reveal/>\n\n\n\nAfter", "B\n\n<$reveal/>\n\n\n\nAfter");
	test("B\n\n\n<$vars  a='X'  />\n\n\nA", "B\n\n\n<$vars a=X/>\n\n\nA");
});

it('inline widgets with a newline after them', function() {
	// This is a special case. widgets are considered blocks only if
	// they have two newlines after them, or one newline and the EOF
	// This means widgets with one newline followed by anything else
	// are inline, but if they're suddenly at the EOF , they're block
	// The only way to prevent this is not to let them go to EOF.
	test("<div>\n\n<$reveal/></div>", "<div>\n\n<$reveal/>");
	test("<div>\n\n<$reveal/>\n</div>", "<div>\n\n<$reveal/>\n</div>");
	test("<div>\n\n<$reveal/>\n</div>\n", "<div>\n\n<$reveal/>\n</div>");
	test("<div>\n\n<$reveal/>\n\n</div>", "<div>\n\n<$reveal/>\n");
	test("<div>\n\n<$reveal></$reveal>\n</div>", "<div>\n\n<$reveal></$reveal>\n");
	test("<div>\n\n<$reveal>\n\n</$reveal>\n</div>", "<div>\n\n<$reveal>\n\n");
	test("<div>\n\n<$reveal>\n\nC\n\n</$reveal>\n</div>", "<div>\n\n<$reveal>\n\nC");
	test("<div>\n\n<$reveal>\n\nC\n</$reveal>\n</div>", "<div>\n\n<$reveal>\n\nC\n");
	test("<div>\n\n<$reveal>\n\n<$reveal/>\n\n</$reveal>\n</div>", "<div>\n\n<$reveal>\n\n<$reveal/>\n");
	test("<div>\n\n<span>\n\n<$reveal/>\n</span>\n</div>", "<div>\n\n<span>\n\n<$reveal/>\n</span>");
	test("<div>\n\n<span>\n\n<$reveal/></span>\n</div>", "<div>\n\n<span>\n\n<$reveal/>");
	// whitespace trimming removes the need for this special handling
	test(t+"<div>\n\n<$reveal/>\n</div>", "<div>\n\n<$reveal/>");
	test(t+"<div>\n\n<span>\n\n<$reveal/>\n</span>\n</div>",
		"<div>\n\n<span>\n\n<$reveal/>");
	// If it couldn't have been a block to begin with,
	// then no special handling
	test("<div><$reveal/>\n</div>", "<div><$reveal/>\n");
	test("<div>\n<$reveal/>\n</div>", "<div>\n<$reveal/>\n");
	test("<div>\r\n<$reveal/>\r\n</div>", "<div>\n<$reveal/>\n");
	// One case we get wrong. The reveal isn't in a block, so it can't be
	// a block itself, but this is hard to tell, so we preserve
	// trailing closing tags to be safe.
	// ...but whitespace trimming makes it better
	test(  "<div><span/>\n\n<$reveal />\n</div>",
	       "<div><span/>\n\n<$reveal/>\n</div>");
	test(t+"<div><span/>\n\n<$reveal />\n</div>",
	       "<div><span/><$reveal/>");
	test(  "<div><span/>\r\n\r\n<$reveal />\r\n</div>",
	       "<div><span/>\n\n<$reveal/>\n</div>");
	test(t+"<div><span/>\r\n\r\n<$reveal />\r\n</div>",
	       "<div><span/><$reveal/>");
});

it('inline widgets at the start of the body', function() {
	test(  "<$reveal/>\n<!--C-->", "<$reveal/>\n<!---->");
	test(t+"<$reveal/>\n<!--C-->", "<$reveal/>");
	test(  "\\define d()d\n<$reveal/>\n<!--C-->",
	       "\\define d()d\n<$reveal/>\n<!---->");
	test(t+"\\define d()d\n<$reveal/>\n<!--C-->",
	       "\\define d()d\n<$reveal/>");
	test(  "\\define d()d\n\n<$reveal/>\n<!--C-->",
	       "\\define d()d\n<$reveal/>\n<!---->");
	test(t+"\\define d()d\n\n<$reveal/>\n<!--C-->",
	       "\\define d()d\n<$reveal/>");
});

it('block widgets with a newline after them', function() {
	// This is like the tests above, only much more rare. It involves
	// the user making weird widgets, but we'll handle it.
	test("<$reveal >\n</$reveal>", "<$reveal>\n</$reveal>");
	test("<$reveal >\n<!-- Comment --></$reveal>", "<$reveal>\n</$reveal>");
	test("<div><$reveal >\n</$reveal>", "<div><$reveal>\n</$reveal>");
	test("<div>\n\n<$reveal >\n</$reveal>", "<div>\n\n<$reveal>\n</$reveal>");
	// but whitespace trimming removes this need again
	test("\\whitespace trim\n<$reveal >\n</$reveal>", "<$reveal>");
	test("\\whitespace trim\n<div>\n\n<$reveal >\n</$reveal>", "<div>\n\n<$reveal>");
});

});});
