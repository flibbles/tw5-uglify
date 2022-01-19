/*\

Uglify html rule for improving $set whenever possible.

\*/

var utils = require("../../utils.js");

exports["$set"] = function(tag, parser) {
	var attrs = tag.attributes;
	if (!attrs.name
	|| attrs.name.type !== "string"
	|| !isLegalAttrName(attrs.name.value)) {
		// If none of the stuff above is true, then the variable value can't
		// be an attribute and there's nothing we can do.
		return;
	}
	var argCount = $tw.utils.count(attrs),
		newAttr;
	if (argCount === 2 && attrs.value) {
		newAttr = attrs.value;
		// Since this attr can be a string value, and that
		// string value can contain placeholders, I retain
		// the original name in the attribute, because
		// we may use that to find the attr's original
		// quoting in bestQuoteFor.
		newAttr.oldName = newAttr.name;
	} else if (argCount == 4 && attrs.filter && attrs.value && attrs.emptyValue) {
	}
	if (newAttr) {
		// We've managed some kind of conversion, Let's prep the new
		// attribute's name and fix the widget attributes.
		newAttr.name = attrs.name.value;
		tag.orderedAttributes = [newAttr];
		// Below may not be necessary since we're
		// setting orderedAttributes
		tag.attributes = {};
		tag.attributes[attrs.name.value] = newAttr;
		// now let's change the tag.
		if (utils.letAvailable()) {
			tag.tag = "$let";
			tag.type = "let";
		} else {
			tag.tag = "$vars";
			tag.type = "vars";
		}
	}
};

function isLegalAttrName(value) {
	return value.length > 0 && value.search(/[\/\s>"'=]/) < 0;
};
