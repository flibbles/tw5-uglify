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
	test("|1|2|3|\n|4|5|~|",
	     "|1|2|3|\n|4|5|~|");
});

it('broken cell merging', function() {
	test("|1|2|>|\n|3|4|5|", "|1|2|>|\n|3|4|5|");
	test("|1|2|3|\n|<|4|5|", "|1|2|3|\n|<|4|5|");
	test("|1|~|2|\n|3|4|5|", "|1|2|\n|3|4|5|");
	test("|~|~|~|\n|3|4|5|", "|>|\n|3|4|5|");
	test("|1|2|3|\n|<|<|<|", "|1|2|3|\n|<|<|<|");
	test("|1|2|3|\n|>|>|>|", "|1|2|3|\n|>|");
	test("|1|2|3|\n|4|~|<|\n|5|6|7|", "|1|2|3|\n|4|~|<|\n|5|6|7|");
	test("|1|2|3|\n|>|~|4|\n|5|6|7|8|", "|1|2|<|3|\n|4|~|\n|5|6|7|8|");
});

it('header cells', function() {
	test("|!1|!2|!3|\n|4|5|6|", "|!1|!2|!3|\n|4|5|6|");
	// spacing
	test("|! 1| !2| ! 3|!4 |\n|5|6|7|8|", "|! 1| !2| ! 3|!4 |\n|5|6|7|8|");
	test("|! 1| !2| ! 3|!4 |\n|5|6|7|8|", "|! 1| !2| ! 3|!4 |\n|5|6|7|8|");
	test("|^! 1|^ !2| ^ ! 3| ^!4 |^!5|", "|^! 1|^ !2| ^ ! 3| ^!4 |^!5|");
	test("|!^ 1|! ^2| ! ^ 3| !^4 |!^5|", "|!^ 1|! ^2| ! ^ 3| !^4 |!^5|");
	test("|,! 1|, !2| , ! 3| ,!4 |,!5|", "|,! 1|, !2| , ! 3| ,!4 |,!5|");
	test("|!, 1|! ,2| ! , 3| !,4 |!,5|", "|!, 1|! ,2| ! , 3| !,4 |!,5|");
});

it('header rows', function() {
	test("|1|2|3|h\n|4|5|6|", "|1|2|3|h\n|4|5|6|");
	test("|1|2|3|h\n|4|5|6|h", "|1|2|3|h\n|4|5|6|h");
	test("|1|2|3|\n|4|5|6|h", "|1|2|3|\n|4|5|6|h");
	test("|1|2|3|h\n|4|5|6|h\n|7|8|9|", "|1|2|3|h\n|4|5|6|h\n|7|8|9|");
	test("|1|2|3|h\n|4|5|6|\n|7|8|9|h", "|1|2|3|h\n|4|5|6|\n|7|8|9|h");
});

it('footer rows', function() {
	test("|1|2|3|f\n|4|5|6|", "|1|2|3|f\n|4|5|6|");
	test("|1|2|3|f\n|4|5|6|f", "|1|2|3|f\n|4|5|6|f");
	test("|1|2|3|\n|4|5|6|f", "|1|2|3|\n|4|5|6|f");
	test("|1|2|3|f\n|4|5|6|f\n|7|8|9|", "|1|2|3|f\n|4|5|6|f\n|7|8|9|");
	test("|1|2|3|f\n|4|5|6|\n|7|8|9|f", "|1|2|3|f\n|4|5|6|\n|7|8|9|f");
});

it('caption', function() {
	test("|1|2|3|\n| <$text text='Caption' /> |c",
	     "| <$text text=Caption/> |c\n|1|2|3|");
	test("|1|2|3|\n| cap | tion |c",
	     "| cap | tion |c\n|1|2|3|");
	test(t+"| 1 |  2|3  |\n| <$text text='Caption' /> |c",
	     "|<$text text=Caption/>|c\n| 1 | 2|3 |");
	test("| A |c\n| B |c\n|1|2|<$text text='3'/>|",
	     "| B |c\n|1|2|<$text text=3/>|");
	test("Cats\n\n|1|2|3|\n| A |c\n| B |c\n|4|5|6|\nLove",
	     "Cats\n\n|1|2|3|\n| A |c\n| B |c\n|4|5|6|\nLove");
	// This souldn't be changed because it has wonky captions.
	// If captions in TW are ever fixed to handle mutliple captions,
	// we can come back and change this test.
	test("X\n\n| A |c\n|1|2|<$text text='3'/>|\n| B |c",
	     "X\n\n| A |c\n|1|2|<$text text='3'/>|\n| B |c");
	// Only captions
	test("| <$text text='Caption' /> |c",
	     "| <$text text=Caption/> |c");
	test("| <$text text='Caption' /> |c\n\nContent",
	     "| <$text text=Caption/> |c\nContent");
});

it('classes', function() {
	test("| myclass |k\n|1|2|3|", "|1|2|3|\n| myclass |k");
	test("|1|2|3|\n| myclass |k", "|1|2|3|\n| myclass |k");
	test("|1|2|3|\n| myclass |k\n| second |k", "|1|2|3|\n|myclass  second |k");
	test("| myclass |k", "| myclass |k");
	test("| myclass |k\n", "| myclass |k");
	test("| myclass |k\nContent", "| myclass |k\nContent");
});

it('placeholders', function() {
	// Honestly, I'm so sure this will be broken, but I can't think of a
	// test where placeholders break tables.
	test("\\define X()X|Y\n\\define M()\nBefore\n\n|A|B|C|D|\n|>|$(X)$|F|\nAfter\n\\end\n<<M>>",
	     "\\define X()X|Y\n\\define M()\nBefore\n\n|A|B|C|D|\n|>|$(X)$|F|\nAfter\n\\end\n<<M>>");
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
	test("| A1 | <$text text='B1'/> |\n| A2 | B2 |\n   Content",
	     "| A1 | <$text text=B1/> |\n| A2 | B2 |\nContent");
	test("<div>\n\n| A1 | <$text text='B1'/> |\n| A2 | B2 |\n</div>",
	     "<div>\n\n| A1 | <$text text=B1/> |\n| A2 | B2 |");
});

});});
