/*\

Uglify rule for

((( multi-variable display )))
(( thisKindTo ))

\*/

exports.name = "mvvdisplayinline";

var utils = require("../utils");

exports.uglify = function() {
	var match = this.nextMatch,
		filter = match.filter,
		bits = ["((("];
	this.parser.pos = match.end;
	this.nextMatch = null;
	if (this.parser.placeholders && this.parser.placeholders.present(filter) === filter.trim()) {
		// Special case. If the filter is just a placeholder, we can't safely
		// trim around it.
		bits.push(filter);
	} else {
		bits.push(utils.uglifyFilter(filter, this.parser));
	}
	if (match.separator !== ", ") { // separator
		// As far as I can tell, tooltips aren't used in any way, but I
		// guess if the rule specifies one, the user must want it.
		bits.push("||", this.match[2]);
	}
	bits.push(")))");
	return [{text: bits.join('')}];
};
