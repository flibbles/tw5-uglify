/*\

Uglify inline rule for <<macros and:params>>

\*/

var utils = require("../utils.js");

exports.name = "macrocallinline";

exports.uglify = function() {
	var start = this.parser.pos;
	var call = this.parse()[0];
	if (this.parser.pos !== "\n"
	&& (startOfBlock(this.parser.source, start) || this.parser.startOfBody)) {
		this.cannotBeAtEnd = true;
		this.cannotLeadToNewBlock = true;
	}
	return utils.stringifyMacro(call, this.parser);
};

function startOfBlock(source, pos) {
	if (pos === 0 ) {
		return true; //start of stream
	}
	if (source[pos-1] !== "\n") {
		return false; // Not start of line
	}
	// Ensure previous line is blank
	return (source[pos-2] === "\n"
		|| (source[pos-2] === "\r" && source[pos-3] === "\n"));
};
