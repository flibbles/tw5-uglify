/*\

Tests the wikitext uglifier with parameter pragma

\*/

$tw.utils.test.wikitext.ifAtLeastVersion("5.3.0").
describe('parameter', function() {

const test = $tw.utils.test.wikitext.test;

it('trims lines around import pragma', function() {
	test('\\parameters (A)\n\\import X\n\\define B() B',
	     '\\parameters(A)\n\\import X\n\\define B()B');
	test('\\parameters (A:cat)\n\n\\import X\n\n\\define B() B\n\n<<A>>',
	     '\\parameters(A:cat)\n\\import X\n\\define B()B\n<<A>>');
});

it('trims carriage returns', function() {
	test('\\parameters (A:cat)\r\n\r\n<<A>>',
	     '\\parameters(A:cat)\n<<A>>');
});

});
