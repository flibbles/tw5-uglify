/*\

Uglify rule for \whitespace trim.

\*/

exports.name = "whitespace";

exports.uglify = function(text) {
	this.parse();
	// We remove whitespace trim pragma. We trim it ourselves.
	// (or we add it back in later if we still need it.)
	return '';
};
