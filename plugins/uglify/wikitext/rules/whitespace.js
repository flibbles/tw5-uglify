/*\

Uglify rule for \whitespace trim.

\*/

exports.name = "whitespace";

exports.uglify = function(text) {
	this.parse();
	if (!this.parser.configTrimWhiteSpace) {
		return "\\whitespace notrim\n";
	}
	return '';
};
