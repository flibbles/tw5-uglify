/*\
title: Test/wikitext.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier.

\*/

describe('wikitext uglifier', function() {

const wikitextType = "text/vnd.tiddlywiki";

function testOnlyIf(condition) {
	return condition? it : xit;
};

function uglify(text) {
	return $tw.wiki.getUglifier(wikitextType).uglify(text, 'test', {wiki: $tw.wiki});
};

function test(text, expected) {
	var out = uglify(text);
	if (expected) {
		expect(out).toBe(expected);
	}
	var options = {variables: {currentTiddler: 'test'}};
	var prettyHtml = $tw.wiki.renderText("text/html", wikitextType, text, options);
	var uglyHtml = $tw.wiki.renderText("text/html", wikitextType, out, options);
	expect(uglyHtml).toBe(prettyHtml);

	return uglyHtml === prettyHtml;
};

it('purges carriage returns when it can', function() {
	test('A\r\nB', 'A\nB');
	test('A\r\n\r\nB', 'A\n\nB');
});

it('handles widgets', function() {
	// Attributes
	// Whitespace in element
	const dump = "<<dumpvariables>>";
	test('Z<$vars  a="X"  >'+dump, "Z<$vars a=X>"+dump);
	test('Z<$vars\n\ta  =  "X"\n>'+dump, "Z<$vars a=X>"+dump);
	test("<$vars  a='X'  >\n\n"+dump, "<$vars a=X>\n\n"+dump);
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
	test('<$text text="$$"/>', '<$text text=$$/>'); // zero placeholders test
	// Empty attributes
	test('<$text text=""/>', '<$text text=""/>');
	test('B\'s<$text text=""/>', "B's<$text text=''/>");
	// Indirect attributes
	test('<$text text={{tiddler}} />', '<$text text={{tiddler}}/>');
	test('<$text text={{tid!!field}} />', '<$text text={{tid!!field}}/>');
	test('<$text text={{tid  !!title}} />', '<$text text={{tid  !!title}}/>');
	test('<$text text=<<m>> />', '<$text text=<<m>>/>');
	// Macro attributes
	const m = "\\define m(val t f)Output:$val$,$t$,$f$\n";
	test('<$vars a={{tiddler}} />', '<$vars a={{tiddler}}/>');
	test(m+'<$text text=<<m   >> />', m+'<$text text=<<m>>/>');
	test(m+'<$text text=<<m val:t >> />', m+'<$text text=<<m val:t>>/>');
	// Filter attributes
	test("<$text text={{{ butts }}}  />", "<$text text={{{butts}}}/>");

	// Attributes without values
	test("<$text text />", "<$text text/>");
	test("<$text text = 'true' />", "<$text text/>");

	// Content
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

	//br
	test("top<br>bottom", "top<br>bottom");
	test("top<br/>bottom", "top<br>bottom");
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
	// mismatch
	test("<div><span>Content</div>", "<div><span>Content</div>");
	// self closing elements don't have trash, and need to keep trailing \n
	test("<$reveal/>", "<$reveal/>");
	test("<$reveal/>\n", "<$reveal/>\n");
	test("<$reveal/>\n\n", "<$reveal/>\n");
	// TODO: This could trip that trailing </div> because the inner $reveal
	// must be inline anyway. This isn't that special use case.
	test("<div><$reveal/>\n</div>", "<div><$reveal/>\n</div>");
	test("<div>\n\n<$reveal/>\n</div>", "<div>\n\n<$reveal/>\n</div>");
	// many trailing newline characters
	test("B\n\n<$reveal/>\n\n\n\nAfter", "B\n\n<$reveal/>\n\n\n\nAfter");
	test("B\n\n\n<$vars  a='X'  />\n\n\nA", "B\n\n\n<$vars a=X/>\n\n\nA");
});

it('html and its inconsistent block rules', function() {
	test("<div>\n\n<$reveal/></div>", "<div>\n\n<$reveal/>");
	test("<div>\n\n<$reveal/>\n</div>", "<div>\n\n<$reveal/>\n</div>");
	test("<div>\n\n<$reveal/>\n</div>\n", "<div>\n\n<$reveal/>\n</div>");
	test("<div>\n\n<$reveal/>\n\n</div>", "<div>\n\n<$reveal/>\n");
	test("<div>\n\n<$reveal></$reveal>\n</div>", "<div>\n\n<$reveal></$reveal>\n");
	test("<div>\n\n<$reveal>\n\n</$reveal>\n</div>", "<div>\n\n<$reveal>\n\n");
	test("<div>\n\n<$reveal>\n\nC\n\n</$reveal>\n</div>", "<div>\n\n<$reveal>\n\nC");
	test("<div>\n\n<$reveal>\n\nC\n</$reveal>\n</div>", "<div>\n\n<$reveal>\n\nC\n");
	test("<div>\n\n<$reveal>\n\n<$reveal/>\n\n</$reveal>\n</div>", "<div>\n\n<$reveal>\n\n<$reveal/>\n");
	cmp("<div>\n\n<div>\n\n<$reveal/>\n</div>\n</div>", "<div>\n\n<div>\n\n<$reveal/>\n</div>");
	test("<div>\n\n<span>\n\n<$reveal/></span>\n</div>", "<div>\n\n<span>\n\n<$reveal/>");

	// widgets and comments
	test("<$reveal/>\n<!--comment-->", "<$reveal/>\n<!---->");
	test("\\whitespace trim\n<$reveal/>\n<!--comment-->", "<$reveal/>");
});

testOnlyIf(!$tw.wiki.renderText(null, null, "<$let/>"))('handles html attribute ordering', function() {
	test("<$let\n2=cat\n1=dog>In</$let>", "<$let 2=cat 1=dog>In");
});

it('handles macrocall', function() {
	const m = "\\define m(val t f)Output:$val$,$t$,$f$\n";
	test(m+"<<m    >>", m+"<<m>>");
	test(m+"B<<m>>A", m+"B<<m>>A");
	test(m+"B\n\n<<m>>\n\nA", m+"B\n\n<<m>>\n\nA");
	test(m+"<<m>>\nA", m+"<<m>>\nA");

	// Params
	test(m+"<<m  dfd  as  >>", m+"<<m dfd as>>");
	test(m+"<<m\nparam\nstuff>>", m+"<<m param stuff>>");
	test(m+"<<m  val  :   dad  >>", m+"<<m val:dad>>");
	test(m+"<<m  dad\n\tval:sis\n\tbro >>", m+"<<m dad val:sis bro>>");
	// params quotation
	test(m+"<<m \"cat\">>", m+"<<m cat>>");
	test(m+"<<m \"$$\">>", m+"<<m $$>>"); // zero placeholders test
	test(m+"<<m \"bad>char\">>", m+"<<m \"bad>char\">>");
	test(m+"B's<<m \"bad'char\">>", m+"B's<<m \"bad'char\">>");
	test(m+"<<m \"cat dog\">>", m+"<<m \"cat dog\">>");
	test(m+"B's<<m \"cat dog\">>", m+"B's<<m 'cat dog'>>");
	test(m+'<<m """bad"char""">>', m+'<<m """bad"char""">>');
	test(m+"<<m 'bad\"char'>>", m+"<<m 'bad\"char'>>");
	// param brackets
	test(m+"[[link]]<<m \"cat dog\">>", m+"[[link]]<<m [[cat dog]]>>");
	test(m+"[[link]]<<m \"bra ]ket\">>", m+"[[link]]<<m \"bra ]ket\">>");
	test(m+"[[link]]<<m \"bra [ket\">>", m+"[[link]]<<m [[bra [ket]]>>");
	test(m+'[[l]]<<m "bra ]]ket" "a b">>', m+'[[l]]<<m "bra ]]ket" [[a b]]>>');
	// Empty params
	test(m+'<<m val:"">>', m+'<<m val:"">>');
	test(m+"<<m val:''>>", m+"<<m val:''>>");
	test(m+"<<m val:[[]]>>", m+'<<m val:[[]]>>');
});

it('handles macrodef', function() {
	// empty: We keep empties, because they may be deliberately blanking a var
	test("\\define m()\n\nContent", "\\define m()\nContent");
	test("\\define m()    \nContent", "\\define m()\nContent");
	// odd
	test("\\define m() bad\n\\end\n\nStuff", "\\define m()bad\n\\end\n\nStuff");
	// parameters
	test("\\define m(A) $A$\n<<m value>>", "\\define m(A)$A$\n<<m value>>");
	test("\\define m(A, B) $A$$B$\n<<m v c>>", "\\define m(A B)$A$$B$\n<<m v c>>");
	test("\\define m(A:  'love') $A$\n<<m>>", "\\define m(A:love)$A$\n<<m>>");
	test("\\define m(A:'a<>b') $A$\n<<m>>", "\\define m(A:a<>b)$A$\n<<m>>");
	test("\\define m(A:'a<>b') $A$\n<<m>>", "\\define m(A:a<>b)$A$\n<<m>>");
	test("\\define m(A:\"l h\") $A$\n<<m>>", "\\define m(A:\"l h\")$A$\n<<m>>");
	test("\\define m(A:\"l h\") $A$\n<<m>>'", "\\define m(A:'l h')$A$\n<<m>>'");
	test("\\define m(A:\"l h\") $A$\n<<m>>[[l]]", "\\define m(A:[[l h]])$A$\n<<m>>[[l]]");
	test("\\define m(A:\"l [h\") $A$\n<<m>>[[l]]", "\\define m(A:[[l [h]])$A$\n<<m>>[[l]]");
	test("\\define m(A:\"l ]h\") $A$\n<<m>>[[l]]", "\\define m(A:\"l ]h\")$A$\n<<m>>[[l]]");
	test("\\define m(A:\"l[[h]]\") $A$\n<<m>>[[l]]", "\\define m(A:l[[h]])$A$\n<<m>>[[l]]");
	// parameters with empty defaults
	test('\\define m(A:"", B) <<dumpvariables>>\n<<m>>', '\\define m(A B)<<dumpvariables>>\n<<m>>');
	test('\\define m(A:"") <$list filter="[[__A__]is[variable]]" emptyMessage="undefined">defined</$list>\n<<m>>', '\\define m(A)<$list filter=[[__A__]is[variable]] emptyMessage=undefined>defined\n<<m>>');
	// parameters without quotes bleeding into next param
	test("\\define m(A:'love', B)$A$-$B$\n<<m B:Y>>", "\\define m(A:love B)$A$-$B$\n<<m B:Y>>");
	test("\\define m(A:'hi by', B)$A$-$B$\n<<m B:Y>>", "\\define m(A:'hi by'B)$A$-$B$\n<<m B:Y>>");
	test("\\define m(A:\"hi by\", B)$A$-$B$\n<<m B:Y>>[[l]]", "\\define m(A:[[hi by]]B)$A$-$B$\n<<m B:Y>>[[l]]");
	test("\\define m(A:\"[[hi\", B)$A$-$B$\n<<m B:Y>>[[l]]", "\\define m(A:[[hi B)$A$-$B$\n<<m B:Y>>[[l]]");
	test("\\define m(A:\"[hi]]\", B)$A$-$B$\n<<m B:Y>>[[l]]", "\\define m(A:[hi]] B)$A$-$B$\n<<m B:Y>>[[l]]");
	// collapsing to single line 
	test("\\define m()   text\n<<m>>", "\\define m()text\n<<m>>");
	test("\\define m()\ntext\n\\end\n<<m>>", "\\define m()text\n<<m>>");
	test("\\define m()\n1\n2\n\\end\n<<m>>", "\\define m()\n1\n2\n\\end\n<<m>>");
	test("\\define m()\n<$text\n\ttext=love />\n\\end\n<<m>>", "\\define m()<$text text=love/>\n<<m>>");
	// collapsing to single line when whitespace abound
	test("\\define m()\n text\n\\end\n<$edit-text placeholder=<<m>> />", "\\define m()\n text\n\\end\n<$edit-text placeholder=<<m>>/>");
	test("\\define m()\n\ttext\n\\end\n<$edit-text placeholder=<<m>> />", "\\define m()\n\ttext\n\\end\n<$edit-text placeholder=<<m>>/>");
	test("\\define m()\ntext   \n\\end\n<$edit-text placeholder=<<m>> />", "\\define m()text   \n<$edit-text placeholder=<<m>>/>");
	test("\\define m()\ntext\t\n\\end\n<$edit-text placeholder=<<m>> />", "\\define m()text\t\n<$edit-text placeholder=<<m>>/>");
	// surrounding whitespace 
	test("\\define A() x\n\\define B() y\n<<A>><<B>>", "\\define A()x\n\\define B()y\n<<A>><<B>>");
	/*
	test("\\define A() x\n\n\n\\define B() y\n<<A>><<B>>", "\\define A()x\n\\define B()y\n<<A>><<B>>");
	test("\\define A() x\n\\define B() y\n\n\n<<A>><<B>>", "\\define A()x\n\\define B()y\n<<A>><<B>>");
	*/
	// macros have their own quoting context
	test('\\define B(v)$v$\n\\define A() <<B "a b">>\n<<A>>[[l]]\'', '\\define B(v)$v$\n\\define A()<<B "a b">>\n<<A>>[[l]]\'');
	test('\\define B(v)$v$\n\\define A() <<B "a b">>\'\n<<A>>', "\\define B(v)$v$\n\\define A()<<B 'a b'>>'\n<<A>>");
	test('\\define B(v)$v$\n\\define A() <<B "a b">>[[l]]\n<<A>>', "\\define B(v)$v$\n\\define A()<<B [[a b]]>>[[l]]\n<<A>>");
});

it('handles macrodef with quoted local substitutions', function() {
	// html
	test('\\define A(a,b) <$text text="""$a$"""/> <$text text="love"/>\n<<A [[a"b"c]]>>',
		'\\define A(a b)<$text text="""$a$"""/> <$text text=love/>\n<<A [[a"b"c]]>>');
	test('\\define A(a,b) <$text   text  =  """$a$"""/> <$text text="love"/>\n<<A [[a"b"c]]>>',
		'\\define A(a b)<$text text="""$a$"""/> <$text text=love/>\n<<A [[a"b"c]]>>');
	test('\\define A(a,b) <$text text="$a$"/> <$text text="love"/>\n<<A [[a\'b\'c]]>>',
		'\\define A(a b)<$text text="$a$"/> <$text text=love/>\n<<A [[a\'b\'c]]>>');
	test('\\define A(a,b) <$text text=\'$a$\'/> <$text text="love"/>\n<<A [[a "b"c]]>>',
		'\\define A(a b)<$text text=\'$a$\'/> <$text text=love/>\n<<A \'a "b"c\'>>');
	// macrocalls
	test('\\define B(c)$c$\n\\define A(a,b) <<B """b$a$""">>\n<$text text="love"/>\n<<A [[a"b"c]]>>',
		'\\define B(c)$c$\n\\define A(a b)<<B """b$a$""">>\n<$text text=love/>\n<<A [[a"b"c]]>>');
	test('\\define B(c)$c$\n\\define A(a,b) <<B  c  : """b$a$""">>\n<$text text="love"/>\n<<A [[a"b"c]]>>',
		'\\define B(c)$c$\n\\define A(a b)<<B c:"""b$a$""">>\n<$text text=love/>\n<<A [[a"b"c]]>>');
	test('\\define B(c)$c$\n\\define A(a,b) <<B "b$a$">>\n<$text text="love"/>\n<<A [[a\'b\'c]]>>',
		'\\define B(c)$c$\n\\define A(a b)<<B "b$a$">>\n<$text text=love/>\n<<A [[a\'b\'c]]>>');
	test('\\define B(c)$c$\n\\define A(a,b) <<B [[b$a$]]>>\n<$text text="love"/>\n<<A "a\'b\'c">>',
		'\\define B(c)$c$\n\\define A(a b)<<B [[b$a$]]>>\n<$text text=love/>\n<<A [[a\'b\'c]]>>');
	// macrodef default parameters
	test('\\define A(p)\n\\define I(x: """z$p$""", y: """yv""")$x$ $y$\n<<I>>\n\\end\n<<A [[a"b"c]]>>',
		'\\define A(p)\n\\define I(x:"""z$p$"""y:yv)$x$ $y$\n<<I>>\n\\end\n<<A [[a"b"c]]>>');
	test('\\define A(p)\n\\define I(x: "z$p$", y: "yv")$x$ $y$\n<<I>>\n\\end\n<<A [[a \'b\'c]]>>',
		'\\define A(p)\n\\define I(x:"z$p$"y:yv)$x$ $y$\n<<I>>\n\\end\n<<A [[a \'b\'c]]>>');
	test('\\define A(p)\n\\define I(x: \'z$p$\', y: \'yv\')$x$ $y$\n<<I>>\n\\end\n<<A [[a "b"c]]>>',
		'\\define A(p)\n\\define I(x:\'z$p$\'y:yv)$x$ $y$\n<<I>>\n\\end\n<<A \'a "b"c\'>>');
	test('\\define A(p)\n\\define I(x: [[z$p$]], y: \'yv\')$x$ $y$\n<<I>>\n\\end\n<<A [[a "b"c]]>>',
		'\\define A(p)\n\\define I(x:[[z$p$]]y:yv)$x$ $y$\n<<I>>\n\\end\n<<A \'a "b"c\'>>');
	// nested placeholders
	test('\\define A(p)\n\\define G(x) $x$-<$text text="""$p$"""/>-<$text text="""$magic$"""/>\n<<G dog>>\n\\end\n<<A [[cat "mongoose" bat]]>>',
		'\\define A(p)\n\\define G(x)$x$-<$text text="""$p$"""/>-<$text text=$magic$/>\n<<G dog>>\n\\end\n<<A [[cat "mongoose" bat]]>>');
});

it('handles macrodef with quoted global substitutions', function() {
	test('\\define A() <$text text="""$(cat)$"""/> <$text text="""cat"""/>\n\\define cat() qu "ote\n<<A>>',
		'\\define A()<$text text="""$(cat)$"""/> <$text text=cat/>\n\\define cat()qu "ote\n<<A>>');
	test('\\define A() <$text text="""$(\'( @)$"""/> <$text text="""cat"""/>\n<$set name="""\'( @""" value=\'set "quote\'><<A>></$set>',
		'\\define A()<$text text="""$(\'( @)$"""/> <$text text=cat/>\n<$set name="\'( @" value=\'set "quote\'><<A>>');
});

it('handles whitespace trimming', function() {
	test("\\whitespace trim\n\n\n''Content''\n\n\n", "\n\n''Content''");
	test("\\whitespace trim\n<div>\n\t''Text''\n</div>", "<div>''Text''");
	test("\\whitespace trim\n<div>\n\nText\n</div>", "<div>\n\nText");
	// placeholders in text cannot be trusted
	test("\\define m(v)\n\\whitespace trim\n<div>\n\t<span>$v$</span>\n</div>\n\\end\n<<m [[''fancy'' content]]>>",
		"\\define m(v)\n\\whitespace trim\n<div><span>$v$\n\\end\n<<m [[''fancy'' content]]>>");
	test("\\define m(v)\n\\whitespace trim\n<div>\n\n\t<span>\n\n$v$\n</span></div>\n\\end\n<<m [[* ''fancy'' content]]>>",
		"\\define m(v)\n\\whitespace trim\n<div>\n\n<span>\n\n$v$\n\n\\end\n<<m [[* ''fancy'' content]]>>");
	// multiple whitespace pragma
	test("\\whitespace trim\n\\whitespace notrim\n<div>\n\tText\n</div>", "<div>\n\tText\n");
	test("\\whitespace notrim\n\\whitespace trim\n<div>\n\tText\n</div>", "<div>Text");
});

it('test wikirule works', function() {
	// testing the testing framework here, but if this secretely didn't
	// work then the whitespace tests wouldn't be ensuring anything.
	function test(input, expected) {
		var options = {variables: {currentTiddler: 'test'}};
		var output = $tw.wiki.renderText("text/html", wikitextType, input, options);
		expect(output).toBe(expected);
	};
	// block
	test("?test?cl?\n\n\n\tcontent\n\n?test?", '<p class="cl">content</p>');
	test("?test?cl?\n<span>\n\tcontent\n</span>\n?test?", '<p class="cl"><span>\n\tcontent\n</span>\n</p>');
	test("?test?cl?\n<div>\n\n\tcontent\n</div>\n?test?", '<div class="cl"><p>content\n</p></div>');
	test("?test?cl?\n<div>\n\n\tcontent\n\n</div>\n?test?", '<div class="cl"><p>content</p></div>');
	// inline
	test("F?test?cl?content?test?", '<p>F<span class="cl">content</span></p>');
	test("?test?cl?<div>\n\n\tcontent\n\n</div>\n?test?", '<p><span class="cl"><div><p>content</p></div>\n</span></p>');
	test("F?test?cl?\n\n\n\tcontent\n\n?test?", '<p>F<span class="cl">\n\n\n\tcontent\n\n</span></p>');
});

it('whitespace in unknown wikitext', function() {
	test("\\whitespace trim\n?test?stuff?\n<div>\n\tContent\n</div>\n?test?",
		"\\whitespace trim\n?test?stuff?\n<div>\n\tContent\n</div>\n?test?");
	// Unknowns within unknowns can cause safety mode to turn off prematurely
	test("\\whitespace trim\n?test?stuff?\n<div>?test?inner?Content?test?</div>\n<div>\n\tLater\n</div>\n?test?",
		"\\whitespace trim\n?test?stuff?\n<div>?test?inner?Content?test?</div>\n<div>\n\tLater\n</div>\n?test?");
});

it('handles inline comments', function() {
	test("First <!--comment-->\nText", "First \nText");
	test("\\whitespace trim\nFirst <!--comment-->\nText", "FirstText");
	test("<div>\n\tText\n\t<!--Comment-->\n</div>", "<div>\n\tText\n\t\n");
	test("\\whitespace trim\n<div>\n\tText\n\t<!--C-->\n</div>", "<div>Text");
	// Inline comments at start or end of blocks can always go
	test("Text\n<!--Comment-->\n\nSecond", "Text\n<!---->\n\nSecond");
	test("\\whitespace trim\nText\n<!--Comment-->\n\nSecond", "Text\n\nSecond");
	test("Text\n<!--Comment--> \n\nSecond", "Text\n \n\nSecond");
	test("\\whitespace trim\nText\n<!--stuff--> \n\nSecond", "Text\n\nSecond");
	test("Text\n <!--Comment-->\n\nSecond", "Text\n \n\nSecond");
	test("\\whitespace trim\nText\n <!--stuff-->\n\nSecond", "Text\n\nSecond");
	// Removing a comment might splice a block into two
	test("<div>\n\nFirst\n<!--Comment-->\nSecond\n</div>",
		"<div>\n\nFirst\n<!---->\nSecond\n");
	test("\\whitespace trim\n<div>\n\nFirst\n<!--Comment-->\nSecond\n</div>",
		"<div>\n\nFirstSecond");
	test("<div>\n<!--Comment-->\nText\n</div>", "<div>\n<!---->\nText\n");
	test("\\whitespace trim\n<div>\n<!--Comment-->\nText\n</div>", "<div>Text");
	test("First\n<!--1--> \nText", "First\n \nText");
	test("\\whitespace trim\nFirst\n<!--1--> \nText", "FirstText");
	test("First\n <!--1-->\nText", "First\n \nText");
	test("\\whitespace trim\nFirst\n <!--1-->\nText", "FirstText");
	// Pesky carriage-returns
	test("<div>\r\n<!--comment-->\r\nText\r\n</div>", "<div>\n<!---->\nText\n");
	test("\\whitespace trim\r\n<div>\r\n<!--comment-->\r\nText\r\n</div>", "<div>Text");
	test("A\r\n<!--comment-->\r\nB", "A\n<!---->\nB");
	// Sequential comments can goof pruning
	test("<div>\n\nFirst\n<!--1--><!--2-->\nSecond\n</div>",
		"<div>\n\nFirst\n<!---->\nSecond\n");
	test("<div>\n\nFirst\n<!--1--><!--2--><!--3-->\nSecond\n</div>",
		"<div>\n\nFirst\n<!---->\nSecond\n");
	test("<div>\n\nFirst\n<!--1--><!--2--> <!--3-->\nSecond\n</div>",
		"<div>\n\nFirst\n \nSecond\n");
	// Lines of comments can't prune very well without whitespace trimming
	test("First\n<!--1-->\n<!--2-->\nText", "First\n<!---->\n<!---->\nText");
	test("\\whitespace trim\nFirst\n<!--1-->\n<!--2-->\nText", "FirstText");
});

it('handles inline comments', function() {
	test("<div>\n\n<!--Comment-->\nText\n</div>", "<div>\n\nText\n");
	test("\\whitespace trim\n<div>\n\n<!--C-->\nText\n</div>", "<div>\n\nText");
	test("<div>\n\n<!--Comment-->Text\n</div>", "<div>\n\nText\n");
	test("\\whitespace trim\n<div>\n\n<!--C-->Text\n</div>", "<div>\n\nText");
	test("A\n\n<!--Comment-->\n\nB", "A\n\nB");
	test("A\n\n<!--Comment-->\n\n\n\nB", "A\n\nB");
	test("A\n\n<!--Comment--><!--Comment-->\n\nB", "A\n\nB");
	test("A\n\n<!--Comment-->\n<!--Comment-->\n\nB", "A\n\nB");
	test("A\n\n<!--Comment-->\n\n<!--Comment-->\n\nB", "A\n\nB");
	// whitespace that's not linefeeds
	test("A\n\n<!--Comment--> \n\nB", "A\n\n \n\nB");
	test("\\whitespace trim\nA\n\n<!--Comment--> \n\nB", "A\n\n \n\nB");
	// Pesky carriage-returns
	test("A\r\n\r\n<!--Comment-->\r\n\r\nB", "A\n\nB");
	// pragma comments
	test("<!--Comment-->\n\n\\define m() M\n<<m>>", "\\define m()M\n<<m>>");
	test("<!--Comment-->\r\n\\define m() M\r\n<<m>>", "\\define m()M\n<<m>>");
});

/*
it('does an identity transform right now', function() {
	var tested = 0;
	function report(text) {
		console.log("FAILED");
		console.log("INPUT");
		console.log(text);
		console.log("OUTPUT");
		console.log(uglify(text));
	};

	const targets = $tw.wiki.allShadowTitles();
	//const targets = ["$:/core/ui/TiddlerInfo/List"];
	$tw.utils.each(targets, function(title) {
		var tiddler = $tw.wiki.getTiddler(title);
		var type = tiddler.fields.type;
		if (!type || type === wikitextType) {
			var text = tiddler.fields.text;
			if (text) {
				tested++;
				try {
					if (test(text)) {
						return true;
					}
				} catch (err) {
					console.warn("ERROR ON:", title);
					report(text);
					throw err;
				}
				report(text);
				return false;
			}
		}
	});
	console.log("Tested " + tested + " tiddlers");
});
*/

});
