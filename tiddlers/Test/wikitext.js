/*\
title: Test/wikitext.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier.

\*/

describe('wikitext uglifier', function() {

const wikitextType = "text/vnd.tiddlywiki";

var test = $tw.utils.test.wikitext.test;

it('purges carriage returns when it can', function() {
	test('A\r\nB', 'A\nB');
	test('A\r\n\r\nB', 'A\n\nB');
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
		console.log(utils.uglify(text));
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
