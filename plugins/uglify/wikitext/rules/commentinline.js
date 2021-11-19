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
	var pos = this.parser.pos;
	if (this.parser.cannotEndYet) {
		if (pos >= this.parser.sourceLength
		|| (utils.newlineAt(source, pos) && pos+1 >= this.parser.sourceLength)) {
			// We're at the end, so we need to put in a dummy comment.
			return '<!---->';
		} else {
			// Stuff comes after. That stuff will be responsible
			// for making sure the text doesn't end now.
			this.cannotBeAtEnd = true;
		}
	}
	if ((startsLine || this.cannotBeAtEnd)
	&& utils.newlineAt(source, pos) // Newline after comment
	&& !this.parser.configTrimWhiteSpace) {
		// We can't remove this comment without risking
		// splicing or creating blocks, or goofing up parsing
		// of the previous element
		return '<!---->';
	}
	// We return nothing, because we don't want comments around
	return '';
};
