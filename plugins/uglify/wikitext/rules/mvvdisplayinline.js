/*\

Uglify rule for

((( multi-variable display )))
(( thisKindTo ))

\*/

exports.name = "mvvdisplayinline";

var utils = require("../utils");

exports.uglify = function() {
	var match = this.nextMatch;
	this.nextMatch = null;
	this.parser.pos = match.end;
	if (match.type === "filter") {
		return filter(match, this.parser);
	} else {
		return variable(match, this.parser);
	}
};

function filter(match, parser) {
	var bits = ["((("],
		filter = match.filter;
	if (parser.placeholders
	&& parser.placeholders.present(filter) === filter.trim()) {
		// Special case. If the filter is just a placeholder,
		// we can't safely trim around it.
		bits.push(filter);
	} else {
		bits.push(utils.uglifyFilter(filter, parser));
	}
	// Attach custom separator, if one was specified
	if (match.separator !== ", ") {
		bits.push("||", match.separator);
	}
	bits.push(")))");
	return bits.join('');
};

function variable(match) {
	var bits = ["((", match.varName.trim()];
	// Attach custom separator, if one was specified
	if (match.separator !== ", ") {
		bits.push("||", match.separator);
	}
	bits.push("))");
	return bits.join('');
};
