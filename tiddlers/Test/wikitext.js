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
