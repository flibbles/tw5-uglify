/*\

Uglify rule for

<!--
	block comments
-->

\*/

var utils = require("../utils.js");

exports.name = "commentblock";

exports.uglify = function() {
	this.parse();
	while (utils.newlineAt(this.parser.source, this.parser.pos)) {
		this.parser.pos++;
	}
	// If there is trailing whitespace, we can just skip it all.
	// It'll never render.
	this.parser.skipWhitespace();
	// We return nothing, because we don't want comments around
	return '';
};
