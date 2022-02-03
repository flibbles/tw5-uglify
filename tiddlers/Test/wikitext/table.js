/*\
title: Test/wikitext/table.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with code blocks.

\*/

describe('wikitext uglifier', function() {
describe('table', function() {

const test = $tw.utils.test.wikitext.test;
const cmp = $tw.utils.test.wikitext.cmp;
const t = "\\whitespace trim\n";

it('spacing of cells', function() {
	test("| A1 | B1 |\n|A2 | B2|\n| A3|B3 |\n|A4|B4|\n| A5| B5|\n|A6 |B6 |\n",
	     "| A1 | B1 |\n|A2 | B2|\n| A3|B3 |\n|A4|B4|\n| A5| B5|\n|A6 |B6 |");
	test("|^top left |^ top center |^ top right|\n|middle left | middle center | middle right|\n|,bottom left |, bottom center |, bottom right|",
	     "|^top left |^ top center |^ top right|\n|middle left | middle center | middle right|\n|,bottom left |, bottom center |, bottom right|");

});

it('cell merging', function() {
	test("|Cell1 |Cell2 |Cell3 |Cell4 |\n|Cell5 |Cell6 |Cell7 |<|\n|Cell5 |~|Cell7 |Cell8 |\n|>|Cell9 |Cell10 |Cell11 |",
	     "|Cell1 |Cell2 |Cell3 |Cell4 |\n|Cell5 |Cell6 |Cell7 |<|\n|Cell5 |~|Cell7 |Cell8 |\n|Cell9 |<|Cell10 |Cell11 |");
	test("|1|2|3|\n|>|4|<|", "|1|2|3|\n|4|<|<|");
	test("|1|2|3|4|\n|5|<|<|6|", "|1|2|3|4|\n|5|<|<|6|");
	test("|1|2|3|4|\n|>|>|5|6|", "|1|2|3|4|\n|5|<|<|6|");
	test("|1|2|3|4|\n|5|~|6|7|\n|8|9|~|10|",
	     "|1|2|3|4|\n|5|~|6|7|\n|8|9|~|10|");
	// consecutive merges
	test("|1|2|3|4|\n|5|~|6|7|\n|8|9|10|11|\n|12|~|13|14|",
	     "|1|2|3|4|\n|5|~|6|7|\n|8|9|10|11|\n|12|~|13|14|");
	// Long merge
	test("|1|2|3|4|\n|5|~|6|7|\n|8|~|9|10|\n|11|12|13|14|",
	     "|1|2|3|4|\n|5|~|6|7|\n|8|~|9|10|\n|11|12|13|14|");
	// Merge down after merge right
	test("|1|<|2|3|\n|4|5|~|6|",
	     "|1|<|2|3|\n|4|5|~|6|");
	// Broken merges
	/*
	test("|1|2|>|\n|3|4|5|",
	     "|1|2|>|\n|3|4|5|");
	*/
});

it('newlines after table', function() {
	test("| A1 | <$text text='B1'/> |\n| A2 | B2 |",
	     "| A1 | <$text text=B1/> |\n| A2 | B2 |");
	test("| A1 | <$text text='B1'/> |\n| A2 | B2 |\n",
	     "| A1 | <$text text=B1/> |\n| A2 | B2 |");
	test("| A1 | <$text text='B1'/> |\r\n| A2 | B2 |\r\n",
	     "| A1 | <$text text=B1/> |\n| A2 | B2 |");
	test("| A1 | <$text text='B1'/> |\n| A2 | B2 |\nContent",
	     "| A1 | <$text text=B1/> |\n| A2 | B2 |\nContent");
	test("| A1 | <$text text='B1'/> |\n| A2 | B2 |\n\nContent",
	     "| A1 | <$text text=B1/> |\n| A2 | B2 |\nContent");
	test("| A1 | <$text text='B1'/> |\r\n| A2 | B2 |\r\n\r\nContent",
	     "| A1 | <$text text=B1/> |\n| A2 | B2 |\nContent");
});

});});
