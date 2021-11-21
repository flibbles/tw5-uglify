/*\

Uglify rule for \whitespace trim.

\*/

exports.name = "whitespace";

exports.uglify = function() {
	this.parse();
	// We remove whitespace trim pragma. We trim it ourselves.
	// (or we add it back in later if we still need it.)
	return '';
};
