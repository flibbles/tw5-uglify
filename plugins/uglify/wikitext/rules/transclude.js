/*\

Uglify rule for

{{ transcludes }}

\*/

exports.name = ["transcludeblock", "transcludeinline"];

var utils = require("../utils");

exports.uglify = function() {
	var call = this.parse()[0];
	var bits = ["{{"];
	if (this.match[1]) {
		bits.push(this.match[1].trim());
	}
	if (this.match[2]) {
		bits.push("||", this.match[2].trim());
	}
	if (this.match[3]) {
		bits.push("|", this.match[3]);
	}
	bits.push("}}");
	var array = [{text: bits.join("")}];
	if (this.parser.source[this.parser.pos-1] == "\n") {
		array.push({text: "\n", tail: true});
		// We don't need any following whitespace
		this.parser.skipWhitespace();
	}
	return array;
};
