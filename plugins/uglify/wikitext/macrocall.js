/*\

Uglify rule for <<macros and:params>>

\*/

var utils = require("./utils.js");

exports.name = ["macrocallinline", "macrocallblock"];

exports.uglify = function() {
	var call = this.parse()[0];
	return utils.stringifyMacro(call, this.parser);
};
