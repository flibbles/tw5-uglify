/*\

Uglify html rule for improving $set whenever possible.

\*/

var utils = require("../../utils.js");

exports["$set"] = function(tag, parser) {
	var attrs = tag.attributes;
	if ($tw.utils.count(attrs) === 2
	&& attrs.name
	&& attrs.name.type === "string"
	&& isLegalAttrName(attrs.name.value)
	&& attrs.value) {
		if (utils.letAvailable()) {
			tag.tag = "$let";
			tag.type = "let";
		} else {
			tag.tag = "$vars";
			tag.type = "vars";
		}
		tag.attributes = {};
		// I don't change the original name in the
		// attribute, because we may use that to find
		// the attr's original quoting in bestQuoteFor.
		attrs.value.newName = attrs.name.value;
		tag.orderedAttributes = [attrs.value];
		// Below may not be necessary since we're
		// setting orderedAttributes
		tag.attributes[attrs.name.value] = attrs.value;
	}
};

function isLegalAttrName(value) {
	return value.length > 0 && value.search(/[\/\s>"'=]/) < 0;
};
