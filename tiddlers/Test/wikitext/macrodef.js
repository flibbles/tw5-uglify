/*\
title: Test/wikitext/macrodef.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with macrodefs.

\*/

describe('wikitext uglifier', function() {
describe('macrodef', function() {

var test = $tw.utils.test.wikitext.test;

it('empty', function() {
	// We keep empties, because they may be deliberately blanking a var
	test("\\define m()\n\nContent", "\\define m()\nContent");
	test("\\define m()    \nContent", "\\define m()\nContent");
});

it('odd', function() {
	test("\\define m() bad\n\\end\n\nStuff", "\\define m()bad\n\\end\n\nStuff");
});

it('string parameters', function() {
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
});

it('empty default parameters', function() {
	test('\\define m(A:"", B) <<dumpvariables>>\n<<m>>', '\\define m(A B)<<dumpvariables>>\n<<m>>');
	test('\\define m(A:"") <$list filter="[[__A__]is[variable]]" emptyMessage="undefined">defined</$list>\n<<m>>', '\\define m(A)<$list filter=[[__A__]is[variable]] emptyMessage=undefined>defined\n<<m>>');
});

it('parameters do not bleed into next when without quotes', function() {
	test("\\define m(A:'love', B)$A$-$B$\n<<m B:Y>>", "\\define m(A:love B)$A$-$B$\n<<m B:Y>>");
	test("\\define m(A:'hi by', B)$A$-$B$\n<<m B:Y>>", "\\define m(A:'hi by'B)$A$-$B$\n<<m B:Y>>");
	test("\\define m(A:\"hi by\", B)$A$-$B$\n<<m B:Y>>[[l]]", "\\define m(A:[[hi by]]B)$A$-$B$\n<<m B:Y>>[[l]]");
	test("\\define m(A:\"[[hi\", B)$A$-$B$\n<<m B:Y>>[[l]]", "\\define m(A:[[hi B)$A$-$B$\n<<m B:Y>>[[l]]");
	test("\\define m(A:\"[hi]]\", B)$A$-$B$\n<<m B:Y>>[[l]]", "\\define m(A:[hi]] B)$A$-$B$\n<<m B:Y>>[[l]]");
});

it('can collapse into single lines', function() {
	test("\\define m()   text\n<<m>>", "\\define m()text\n<<m>>");
	test("\\define m()\ntext\n\\end\n<<m>>", "\\define m()text\n<<m>>");
	test("\\define m()\n1\n2\n\\end\n<<m>>", "\\define m()\n1\n2\n\\end\n<<m>>");
	test("\\define m()\n<$text\n\ttext=love />\n\\end\n<<m>>",
		"\\define m()<$text text=love/>\n<<m>>");
	// when whitespace is abound
	test("\\define m()\n text\n\\end\n<$edit-text placeholder=<<m>> />",
		"\\define m()\n text\n\\end\n<$edit-text placeholder=<<m>>/>");
	test("\\define m()\n\ttext\n\\end\n<$edit-text placeholder=<<m>> />",
		"\\define m()\n\ttext\n\\end\n<$edit-text placeholder=<<m>>/>");
	test("\\define m()\ntext   \n\\end\n<$edit-text placeholder=<<m>> />",
		"\\define m()text   \n<$edit-text placeholder=<<m>>/>");
	test("\\define m()\ntext\t\n\\end\n<$edit-text placeholder=<<m>> />",
		"\\define m()text\t\n<$edit-text placeholder=<<m>>/>");
});

it('whitespace between definitions', function() {
	test("\\define A() x\n\\define B() y\n<<A>><<B>>",
		"\\define A()x\n\\define B()y\n<<A>><<B>>");
	test("\\define A() x\n\n\n\\define B() y\n<<A>><<B>>",
		"\\define A()x\n\\define B()y\n<<A>><<B>>");
	test("\\define A() x\n\\define B() y\n\n\n<<A>><<B>>",
		"\\define A()x\n\\define B()y\n<<A>><<B>>");
	// Test with other pragma
	test("\\define A() x\n\\whitespace trim\n\n\\define B() y\n\n\n<<A>><<B>>",
		"\\define A()x\n\\define B()y\n<<A>><<B>>");
	test("\\define A() x\n\n\\rules except wikilink\n\n\\define B() y\n\n\n<<A>><<B>>",
		"\\define A()x\n\\rules except wikilink\n\\define B()y\n<<A>><<B>>");
	test("\\define A() x\n\n\\import stuff\n\n\\define B() y\n\n\n<<A>><<B>>",
		"\\define A()x\n\\import stuff\n\\define B()y\n<<A>><<B>>");
	// \r\n
});

it('have their own quoting context inside other macrodefs', function() {
	// that B macrocall can't go to brackets because there are no
	// brackets inside its context with it.
	test('\\define B(v)$v$\n\\define A() <<B "a b">>\n<<A>>[[l]]\'',
		'\\define B(v)$v$\n\\define A()<<B "a b">>\n<<A>>[[l]]\'');
	// bracket is in same context. Can use.
	test('\\define B(v)$v$\n\\define A() <<B "a b">>[[l]]\n<<A>>',
		"\\define B(v)$v$\n\\define A()<<B [[a b]]>>[[l]]\n<<A>>");
	// single quotes is in same context. Can use.
	test('\\define B(v)$v$\n\\define A() <<B "a b">>\'\n<<A>>',
		"\\define B(v)$v$\n\\define A()<<B 'a b'>>'\n<<A>>");
});

it('inner html respects quotation of local placeholders', function() {
	test('\\define A(a,b) <$text text="""$a$"""/> <$text text="love"/>\n<<A [[a"b"c]]>>',
		'\\define A(a b)<$text text="""$a$"""/> <$text text=love/>\n<<A [[a"b"c]]>>');
	test('\\define A(a,b) <$text   text  =  """$a$"""/> <$text text="love"/>\n<<A [[a"b"c]]>>',
		'\\define A(a b)<$text text="""$a$"""/> <$text text=love/>\n<<A [[a"b"c]]>>');
	test('\\define A(a,b) <$text text="$a$"/> <$text text="love"/>\n<<A [[a\'b\'c]]>>',
		'\\define A(a b)<$text text="$a$"/> <$text text=love/>\n<<A [[a\'b\'c]]>>');
	test('\\define A(a,b) <$text text=\'$a$\'/> <$text text="love"/>\n<<A [[a "b"c]]>>',
		'\\define A(a b)<$text text=\'$a$\'/> <$text text=love/>\n<<A \'a "b"c\'>>');
});

it('inner macrocall respects quotation of local placeholders', function() {
	test('\\define B(c)$c$\n\\define A(a,b) <<B """b$a$""">>\n<$text text="love"/>\n<<A [[a"b"c]]>>',
		'\\define B(c)$c$\n\\define A(a b)<<B """b$a$""">>\n<$text text=love/>\n<<A [[a"b"c]]>>');
	test('\\define B(c)$c$\n\\define A(a,b) <<B  c  : """b$a$""">>\n<$text text="love"/>\n<<A [[a"b"c]]>>',
		'\\define B(c)$c$\n\\define A(a b)<<B c:"""b$a$""">>\n<$text text=love/>\n<<A [[a"b"c]]>>');
	test('\\define B(c)$c$\n\\define A(a,b) <<B "b$a$">>\n<$text text="love"/>\n<<A [[a\'b\'c]]>>',
		'\\define B(c)$c$\n\\define A(a b)<<B "b$a$">>\n<$text text=love/>\n<<A [[a\'b\'c]]>>');
	test('\\define B(c)$c$\n\\define A(a,b) <<B [[b$a$]]>>\n<$text text="love"/>\n<<A "a\'b\'c">>',
		'\\define B(c)$c$\n\\define A(a b)<<B [[b$a$]]>>\n<$text text=love/>\n<<A [[a\'b\'c]]>>');
});

it('inner macrodef respects quotation of local placeholders', function() {
	test('\\define A(p)\n\\define I(x: """z$p$""", y: """yv""")$x$ $y$\n<<I>>\n\\end\n<<A [[a"b"c]]>>',
		'\\define A(p)\n\\define I(x:"""z$p$"""y:yv)$x$ $y$\n<<I>>\n\\end\n<<A [[a"b"c]]>>');
	test('\\define A(p)\n\\define I(x: "z$p$", y: "yv")$x$ $y$\n<<I>>\n\\end\n<<A [[a \'b\'c]]>>',
		'\\define A(p)\n\\define I(x:"z$p$"y:yv)$x$ $y$\n<<I>>\n\\end\n<<A [[a \'b\'c]]>>');
	test('\\define A(p)\n\\define I(x: \'z$p$\', y: \'yv\')$x$ $y$\n<<I>>\n\\end\n<<A [[a "b"c]]>>',
		'\\define A(p)\n\\define I(x:\'z$p$\'y:yv)$x$ $y$\n<<I>>\n\\end\n<<A \'a "b"c\'>>');
	test('\\define A(p)\n\\define I(x: [[z$p$]], y: \'yv\')$x$ $y$\n<<I>>\n\\end\n<<A [[a "b"c]]>>',
		'\\define A(p)\n\\define I(x:[[z$p$]]y:yv)$x$ $y$\n<<I>>\n\\end\n<<A \'a "b"c\'>>');
});

it('extra nesting still catches outer local placeholders', function() {
	test('\\define A(p)\n\\define G(x) $x$-<$text text="""$p$"""/>-<$text text="""$magic$"""/>\n<<G dog>>\n\\end\n<<A [[cat "mongoose" bat]]>>',
		'\\define A(p)\n\\define G(x)$x$-<$text text="""$p$"""/>-<$text text=$magic$/>\n<<G dog>>\n\\end\n<<A [[cat "mongoose" bat]]>>');
});

it('handles macrodef with quoted global substitutions', function() {
	test('\\define A() <$text text="""$(cat)$"""/> <$text text="""cat"""/>\n\\define cat() qu "ote\n<<A>>',
		'\\define A()<$text text="""$(cat)$"""/> <$text text=cat/>\n\\define cat()qu "ote\n<<A>>');
	test('\\define A() <$text text="""$(\'( @)$"""/> <$text text="""cat"""/>\n<$set name="""\'( @""" value=\'set "quote\'><<A>></$set>',
		'\\define A()<$text text="""$(\'( @)$"""/> <$text text=cat/>\n<$set name="\'( @" value=\'set "quote\'><<A>>');
});

it('placeholders that end up at EOF', function() {
	test('\\define A(m)\n<div>\n\n$m$\n</div>\n\\end\n<<A "<$reveal/>" >>',
		'\\define A(m)\n<div>\n\n$m$\n</div>\n\\end\n<<A "<$reveal/>">>');
	test('\\define A(m)\n\\whitespace trim\n<div>\n\n$m$\n</div>\n\\end\n<<A "<$reveal/>" >>',
		'\\define A(m)\n\\whitespace trim\n<div>\n\n$m$\n</div>\n\\end\n<<A "<$reveal/>">>');
	test('\\define T()\nx\n\ny\n\\end\n\\define A(m)\n<div>\n\n$m$</div>\n\\end\n<<A "<<T>>" >>',
		'\\define T()\nx\n\ny\n\\end\n\\define A(m)\n<div>\n\n$m$</div>\n\\end\n<<A "<<T>>">>');
	test('\\define T()\nx\n\ny\n\\end\n\\define A(m)\n\\whitespace trim\n<div>\n\n$m$</div>\n\\end\n<<A "<<T>>" >>',
		'\\define T()\nx\n\ny\n\\end\n\\define A(m)\n\\whitespace trim\n<div>\n\n$m$</div>\n\\end\n<<A "<<T>>">>');
});

it('placeholders trim surrounding whitespace', function() {
	test('\\define A(m)\nA\n$m$\nB\n\\end\n<<A  "\nX\n">>',
	     '\\define A(m)\nA\n$m$\nB\n\\end\n<<A "\nX\n">>');
	test('\\define A(m)\n\\whitespace trim\nA\n$m$\nB\n\\end\n<<A  "\nX\n">>',
	     '\\define A(m)\n\\whitespace trim\nA\n$m$\nB\n\\end\n<<A "\nX\n">>');
});

});});
