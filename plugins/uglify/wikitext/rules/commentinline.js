/*\

Uglify rule for <!-- inline comments -->.

\*/

var utils = require("../utils.js");

exports.name = "commentinline";

exports.uglify = function() {
	var start = this.parser.pos;
	do {
	// We loop this to slurp up all sequential comment blocks
		this.parse();
	} while (this.findNextMatch(this.parser.pos) == this.parser.pos);
	var node = {text: '<!---->', tail: true};
	if (!(startsLine(this.parser.source, start) || inlinesBlock(this.parser.source, start))
	|| !utils.newlineAt(this.parser.source, this.parser.pos)
	|| this.parser.configTrimWhiteSpace) {
		node.junk = true;
	}
	return [node];
};

function startsLine(source, pos) {
	return source[pos-1] === '\n';
};

// Checks to see if this comes directly after a widget start in such a way
// that it's forcing that widget to be inline.
function inlinesBlock(source, pos) {
	pos--;
	var newlineCount = 0;
	while (pos >= 0 && utils.whiteSpaceAt(source, pos)) {
		newlineCount += source[pos] === '\n';
		pos--;
	}
	return newlineCount == 1 && source[pos] === '>';
};
