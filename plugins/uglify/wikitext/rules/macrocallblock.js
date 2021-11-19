/*\

Uglify rule for <<macros and:params>>

\*/

var utils = require("../utils.js");

exports.name = "macrocallblock";

exports.uglify = function() {
	var call = this.parse()[0];
	var output =  utils.stringifyMacro(call, this.parser);
	if (this.parser.pos === "\n") {
		output += "\n";
		this.parser.pos++;
		this.parser.trailingJunkLength++;
	}
	return output;
};
