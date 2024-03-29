/*\

Uglify html rule for improving $set whenever possible.

\*/

var utils = require("../../utils.js");

exports["$set"] = function(tag, parser) {
	var attrs = tag.attributes;
	if (!attrs.name
	|| attrs.name.type !== "string"
	|| !isLegalAttrName(attrs.name.value)
	// transclusion is a special variable which can't be in a $let without
	// risking changing nested qualifys
	|| attrs.name.value === "transclusion") {
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
		var value = legalFilterValue(attrs.value, parser),
			empty = legalFilterValue(attrs.emptyValue, parser),
			filter = legalFilterRun(attrs.filter, parser);
		if (value && empty && filter) {
			newAttr = {
				type: 'filtered',
				filter: filter + ' +[then' + value + 'else' + empty+ ']'
			};
		}
	} else if (argCount == 2 && attrs.tiddler && utils.isCurrentTiddlerAttr(attrs.tiddler)) {
		newAttr = {
			type: "indirect",
			textReference: "!!text"
		};
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
	} else {
		// It remains a $set widget. We can at least
		// trim up a filter attr if it's there.
		if (attrs.filter && attrs.filter.type === "string") {
			attrs.filter.value = utils.uglifyFilter(attrs.filter.value, parser);
		}
	}
};

function isLegalAttrName(value) {
	return value.length > 0 && value.search(/[\/\s>"'=]/) < 0;
};

function legalFilterValue(attribute, parser) {
	var val;
	switch (attribute.type) {
		case "string":
			if (attribute.value.indexOf('}}}') < 0 && attribute.value.indexOf(']') < 0) {
				val = "[" + attribute.value + "]";
			}
			break;
		case "indirect":
			val = "{" + attribute.textReference + "}";
			break;
		//case "macro":
		// There are subtle differences in the way value=<<>> and
		// varName={{{[<>]}}} work, so for now I'm disabling this
		// minification.
	}
	if (val && (!parser.placeholders || !parser.placeholders.present(val))) {
		return val;
	}
	return null;
};

function legalFilterRun(attribute, parser) {
	var run;
	switch (attribute.type) {
		case "string":
			if (attribute.value.indexOf('}}}') < 0) {
				run = attribute.value;
			}
			break;
		case "macro":
			var optionsForFilter = Object.create(parser);
			optionsForFilter.bracketsAllowed = false;
			var macroString = utils.stringifyMacro(attribute.value, parser.source, optionsForFilter);
			if (macroString.indexOf('}}}') < 0
			&& macroString.indexOf('>') < 0) {
				run = "[subfilter<" + macroString + ">]";
			}
			break;
	}
	if (run && (!parser.placeholders || !parser.placeholders.present(run))) {
		return run;
	}
	return null;
};
