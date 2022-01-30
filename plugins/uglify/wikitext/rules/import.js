/*\

Uglify rule for \import.

\*/

var utils = require("../utils.js");

exports.name = "import";

exports.uglify = function() {
	var parseTree = this.parse(),
		filter = parseTree[0].attributes.filter.value,
		uglyFilter = utils.uglifyFilter(filter, this.parser);
	if (uglyFilter) {
		return "\\import " + uglyFilter;
	} else {
		// Eat a newline if it's there.
		this.parser.pos += utils.newlineAt(this.parser.source, this.parser.pos);
		return "";
	}
};
