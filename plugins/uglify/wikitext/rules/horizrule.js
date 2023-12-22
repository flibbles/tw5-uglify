/*\

Uglify rule for horizontal rule:

---

\*/

exports.name = "horizrule";

exports.uglify = function() {
	this.parse();
	this.parser.skipWhitespace();
	return [{text: "---"}, {text: "\n", tail: true}];
};
