/*\

Uglify rule for <<macros and:params>>

\*/

var utils = require("../utils.js");

exports.name = "macrocallblock";

exports.uglify = function() {
	var call = this.parse()[0];
	var output =  [{text: utils.stringifyMacro(call, this.parser)}];
	if (this.parser.pos === "\n") {
		this.parser.pos++;
		// This newline doesn't have to be there if the macro is at EOF
		output.push({text: "\n", junk: true});
	}
	return output;
};
