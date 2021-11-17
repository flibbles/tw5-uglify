/*\

Uglify rule for <!-- inline comments -->.

\*/

var utils = require("../utils.js");

exports.name = "commentinline";

exports.uglify = function(text) {
	var source = this.parser.source,
		startsLine = source[this.parser.pos-1] === "\n";
	do {
	// We loop this to slurp up all sequential comment blocks
		this.parse();
	} while (this.findNextMatch(this.parser.pos) == this.parser.pos);
	if (this.parser.cannotEndYet
	|| (startsLine
		&& utils.newlineAt(source, this.parser.pos) // Newline after comment
		&& !this.parser.configTrimWhiteSpace)) {
		// We can't remove this comment without risking
		// splicing or creating blocks, or goofing up parsing
		// of the previous element
		return '<!---->';
	}
	// We return nothing, because we don't want comments around
	return '';
};
