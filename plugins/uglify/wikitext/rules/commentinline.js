/*\

Uglify rule for <!-- inline comments -->.

\*/

exports.name = "commentinline";

exports.uglify = function(text) {
	var source = this.parser.source,
		startsLine = source[this.parser.pos-1] === "\n";
	do {
	// We loop this to slurp up all sequential comment blocks
		this.parse();
	} while (this.findNextMatch(this.parser.pos) == this.parser.pos);
	if (startsLine
	&& newlineAt(source, this.parser.pos) // Newline after comment
	&& !this.parser.configTrimWhiteSpace) {
		// We can't remove this comment without risking
		// splicing or creating blocks
		return '<!---->';
	}
	// We return nothing, because we don't want comments around
	return '';
};

function newlineAt(source, pos) {
	return source[pos] === "\n"
		|| (source[pos] === "\r" && source[pos+1] === "\n");
};
