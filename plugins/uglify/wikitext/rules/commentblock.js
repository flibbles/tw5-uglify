/*\

Uglify rule for

<!--
	block comments
-->

\*/

exports.name = "commentblock";

exports.uglify = function() {
	this.parse();
	while (newlineAt(this.parser.source, this.parser.pos)) {
		this.parser.pos++;
	}
	// If there is trailing whitespace, we can just skip it all.
	// It'll never render.
	this.parser.skipWhitespace();
	// We return nothing, because we don't want comments around
	return '';
};

function newlineAt(source, pos) {
	return source[pos] === "\n"
		|| (source[pos] === "\r" && source[pos+1] === "\n");
};
