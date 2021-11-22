/*\

Uglify rule for <!-- inline comments -->.

\*/

var utils = require("../utils.js");

exports.name = "commentinline";

exports.uglify = function() {
	var startsLine = this.parser.source[this.parser.pos-1] === "\n";
	do {
	// We loop this to slurp up all sequential comment blocks
		this.parse();
	} while (this.findNextMatch(this.parser.pos) == this.parser.pos);
	var node = {text: '<!---->', junk: true};
	if (!startsLine
	|| !utils.newlineAt(this.parser.source, this.parser.pos)
	|| this.parser.configTrimWhiteSpace) {
		node.drop = true;
	}
	return [node];
};
