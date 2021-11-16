/*\

Uglify rule for

<!--
	block comments
-->

\*/

exports.name = "commentblock";

exports.uglify = function(text) {
	this.parse();
	while (newlineAt(this.parser.source, this.parser.pos)) {
		this.parser.pos++;
	}
	// We return nothing, because we don't want comments around
	return '';
};

function newlineAt(source, pos) {
	return source[pos] === "\n"
		|| (source[pos] === "\r" && source[pos+1] === "\n");
};
