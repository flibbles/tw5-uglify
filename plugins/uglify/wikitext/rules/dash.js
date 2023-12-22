/*\

Uglify rule for--en and---em dash

\*/

var utils = require("../utils.js");

exports.name = "dash";

exports.uglify = function() {
	var length = this.match[0].length,
		rtn = [{text: length === 2? "--": "---"}],
		element = this.parse();
	if (length > 2) {
		element.start = this.match.index;
		element.startOfBody = this.parser.startOfBody;
		// We have to take a whole bunch of precautions if the length is > 2
		// Because there's a risk this could turn into a horizrule if we remove
		// stuff from around it.
		if (utils.tagAtStartOfBlock(element, this.parser.source)
			// Also, if "-"s preced this. We'll need to treat this as
			// volatile anyway.  We just can't confirm whether this is safe,
			// but this is rare. No one uses four "-" inline on purpose.
		|| this.parser.source[element.start-1] === "-") {
			rtn[0].cannotBeAtEnd = true;
			rtn[0].cannotEndBlock = true;
		}
		if (this.parser.source[this.parser.pos] === " ") {
			//this.parser.pos++;
			rtn.push({text: "<!---->", junk: true});
		}
	}
	return rtn;
};
