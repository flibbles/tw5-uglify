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
	return $tw.wiki.getUglifier(wikitextType).uglify(text, 'test');
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

	var prettyPlain = $tw.wiki.renderText("text/plain", wikitextType, text, options);
	var uglyPlain = $tw.wiki.renderText("text/plain", wikitextType, out, options);
	expect(uglyPlain).toBe(prettyPlain);
	return (uglyHtml === prettyHtml && uglyPlain === prettyPlain);
};

it('handles widgets', function() {
	// Attributes
	// Whitespace in element
	const dump = "<<dumpvariables>></$vars>";
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
	// Quotes in attribute
	test('<$text text="""f\"p"""/>', '<$text text="""f\"p"""/>');
	test('Bob\'s<$text text="""f\"p"""/>', "Bob's<$text text='f\"p'/>");
	test('<$text text="""Nick\'s"""/>', '<$text text="Nick\'s"/>');
	test('<$text text="Nick\'s"/>', '<$text text="Nick\'s"/>');
	// Empty attributes
	test('<$text text=""/>', '<$text text=""/>');
	test('B\'s<$text text=""/>', "B's<$text text=''/>");
	// Indirect attributes
	test('<$text text={{tiddler}} />', '<$text text={{tiddler}}/>');
	test('<$text text={{tid!!field}} />', '<$text text={{tid!!field}}/>');
	test('<$text text={{tid  !!title}} />', '<$text text={{tid  !!title}}/>');
	test('<$text text=<<m>> />', '<$text text=<<m>>/>');
	// Macro attributes
	const m = "\\define m(val,t,f) Output:$val$,$t$,$f$\n";
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
	test("<$vars  a='X'  >\n\nIn</$vars>", "<$vars a=X>\n\nIn</$vars>");
	test("<$vars  a='X'  >\n\nIn</$vars>\n", "<$vars a=X>\n\nIn</$vars>\n");
	test("<div>\n\n!aardvark\n\n</div>", "<div>\n\n!aardvark\n\n</div>");
	test("<$vars>\n\n\nIn</$vars>\n", "<$vars>\n\nIn</$vars>\n");
	test("<$vars>\n\nIn</$vars>\n\n", "<$vars>\n\nIn</$vars>\n\n");
	test("<$vars>\n\nIn</$vars>\nA", "<$vars>\n\nIn</$vars>\nA");
	test("B<$vars  a='X'  />After", "B<$vars a=X/>After");
	test("B\n\n<$vars  a='X'  />\n\nAfter", "B\n\n<$vars a=X/>\n\nAfter");
	test("B\n\n\n<$vars  a='X'  />\n\n\nA", "B\n\n\n<$vars a=X/>\n\n\nA");

	//br
	test("top<br>bottom", "top<br>bottom");
	test("top<br/>bottom", "top<br>bottom");
});

testOnlyIf(!$tw.wiki.renderText(null, null, "<$let/>"))('handles html attribute ordering', function() {
	test("<$let\n2=cat\n1=dog>In</$let>", "<$let 2=cat 1=dog>In</$let>");
});

it('handles macrocall', function() {
	const m = "\\define m(val,t,f) Output:$val$,$t$,$f$\n";
	test("<<m    >>", "<<m>>");
	test("B<<m>>A", "B<<m>>A");
	test("B\n\n<<m>>\n\nA", "B\n\n<<m>>\n\nA");
	test("<<m>>\nA", "<<m>>\nA");

	// Params
	test("<<m  dfd  as  >>", "<<m dfd as>>");
	test("<<m\nparam\nstuff>>", "<<m param stuff>>");
	test("<<m  val  :   dad  >>", "<<m val:dad>>");
	test("<<m  dad\n\tval:sis\n\tbro >>", "<<m dad val:sis bro>>");
	// params quotation
	test("<<m \"cat\">>", "<<m cat>>");
	test("<<m \"bad>char\">>", "<<m \"bad>char\">>");
	test("B's<<m \"bad'char\">>", "B's<<m \"bad'char\">>");
	test("<<m \"cat dog\">>", "<<m \"cat dog\">>");
	test("B's<<m \"cat dog\">>", "B's<<m 'cat dog'>>");
	test('<<m """bad"char""">>', '<<m """bad"char""">>');
	test("<<m 'bad\"char'>>", "<<m 'bad\"char'>>");
	// param brackets
	test("[[link]]<<m \"cat dog\">>", "[[link]]<<m [[cat dog]]>>");
	test("[[link]]<<m \"bra ]ket\">>", "[[link]]<<m [[bra ]ket]]>>");
	test('[[l]]<<m "bra ]]ket" "a b">>', '[[l]]<<m "bra ]]ket" [[a b]]>>');
	// Empty params
	test('<<m val:"">>', '<<m val:"">>');
	test("<<m val:''>>", "<<m val:''>>");
	test("<<m val:[[]]>>", '<<m val:[[]]>>');
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
