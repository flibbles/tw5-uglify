/*\

Uglify html rule for converting $vars to $let when possible

\*/

var utils = require("../../utils.js");

exports["$vars"] = function(tag, parser) {
	var attrs = tag.orderedAttributes,
		indexOfDependent,
		currentTiddler = tag.attributes.currentTiddler;
	if (!utils.letAvailable()) {
		// We don't do anything if there is no $let to work with.
		return;
	}
	if (attrs === undefined) {
		// This is a version of TiddlyWiki which doesn't
		// support ordered attributes. So how would $let
		// even be a thing? Dunno, but let's  make sure.
		return;
	}
	for (var i = 0; i < attrs.length; i++) {
		var attr = attrs[i];
		if (attr.type !== "string"
		&& !independentIndirect(attr, parser, currentTiddler)) {
			if (indexOfDependent !== undefined) {
				// There is now two or more dependents.
				// We can't safely convert this widget.
				return;
			}
			indexOfDependent = i;
		}
	}
	if (indexOfDependent) {
		// We have a single dependent
		var dependent = attrs.splice(indexOfDependent, 1)[0];
		// Move it to the front
		attrs.unshift(dependent);
	}
	// We don't have to worry about bumping the dependent attribute
	// out of first with an attribute optimization because it will never
	// be selected. It's not a string.
	utils.optimizeAttributeOrdering(attrs, parser);
	tag.tag = "$let";
	tag.type = "let";
};

// Independent indirects either don't use currentTiddler, or they do and
// this vars macro does not effect currentTiddler.
function independentIndirect(attr, parser, currentTiddler) {
	if (attr.type === "indirect") {
		var ref = $tw.utils.parseTextReference(attr.textReference);
		if (!currentTiddler) {
			// If currentTiddler is not changed in this vars,
			// then all indirects are safe.
			return true;
		}
		if (ref.title && (!parser.placeholders || !parser.placeholders.present(ref.title))) {
			// If it's a title, and one that can't change on us
			// then it's safe.
			return true;
		}
	}
	return false;
};
