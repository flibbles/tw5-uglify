/*\

Uglify rule for \whitespace trim.

\*/

exports.name = "commentinline";

exports.uglify = function(text) {
	var source = this.parser.source,
		startsLine = source[this.parser.pos-1] === "\n";
		blankBefore = startsLine && source[this.parser.pos-2] === "\n";
	do {
	// We loop this to slurp up all sequential comment blocks
		this.parse();
	} while (this.findNextMatch(this.parser.pos) == this.parser.pos);
	var endsLine = source[this.parser.pos] === "\n";
	if (startsLine
	&& endsLine
	&& !blankBefore
	&& !this.parser.configTrimWhiteSpace) {
		// We can't remove this comment without risking
		// splicing or creating blocks
		return '<!---->';
	}
	// We return nothing, because we don't want comments around
	return '';
};
