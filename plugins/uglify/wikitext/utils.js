/*\
title: $:/plugins/flibbles/uglify/wikitext/utils.js
module-type: library
type: application/javascript

Utils for the wikitext uglify rules and parser.

\*/

exports.joinNodeArray = function(array) {
	var string = [];
	$tw.utils.each(array, function(node) {
		if (node.text) {
			string.push(node.text);
		}
	});
	return string.join('');
};

exports.stringifyMacro = function(macro, source, options) {
	var strings = [macro.name !== undefined? macro.name: macro.attributes["$variable"].value],
		needsSpace = true,
		value,
		hasName,
		positionalName = 0;
	$tw.utils.each(macro.params || macro.orderedAttributes, function(param) {
		if (macro.params === undefined && param.name === "$variable") {
			// This is a v5.3.0 macrocall, which is really just a transclusion
			// We need to ignore the $variable argument
			return;
		}
		if (
			param.name === undefined
			// >=v5.3.0, name may be present, but only as a positional
			|| (macro.params === undefined && param.name == positionalName.toString())) {
			// If it was an unnamed parameters, we need to increment this
			// so it'll match with the next unnamed parameter.
			positionalName++;
			hasName = false;
		} else {
			if (needsSpace) {
				// If param key is there, we always need preceding space
				strings.push(" ");
				needsSpace = false;
			}
			strings.push(param.name, ":");
			hasName = true;
		}
		if (options.placeholders && options.placeholders.present(param.value)) {
			// If there is a placeholder in the value, we can't change the
			// quotes to something else, or we might break something
			value = getOriginalQuoting(param, source, hasName);
		} else {
			var newOptions = Object.create(options);
			newOptions.hasName = hasName;
			value = exports.quotifyParam(param.value, false, newOptions);
		}
		if (value === param.value || value[0] === "[") {
			if (needsSpace) {
				// If value is unquoted, we need preceding space
				strings.push(" ");
			}
			// We won't need a following space if [[brackets]] were used.
			needsSpace = (value === param.value);
		} else {
			needsSpace = false;
		}
		strings.push(value);
	});
	return strings.join("");
};

exports.quotifyParam = function(param, allowBrackets, options) {
	if (param.search(/[\s"']/) < 0
	&& (options.hasName || param.indexOf(":") < 0)
	&& param.length > 0
	&& (allowBrackets || param.indexOf(">") < 0)
	&& (param[0] !== "[" || param[1] !== "[")) {
		return param;
	}
	if (options.apostrophesAllowed && param.indexOf("'") < 0) {
		return "'" + param + "'";
	}
	if (options.bracketsAllowed && param.indexOf("]") < 0) {
		return "[[" + param + "]]";
	}
	if (param.indexOf('"') < 0) {
		return '"' + param + '"';
	}
	return '"""' + param + '"""';
};

// Returns the length of the newline if it's there, otherwise 0.
// This can be used to check two consecutive newlines by chaining the method.
// e.g: if (newlineAt(source, pos + newlineAt(source, pos)))
// The advantage to this is it handles \r\n just fine.
exports.newlineAt = function(source, pos) {
	switch (source[pos]) {
	case "\n":
		return 1;
	case "\r":
		if (source[pos+1]) {
			return 2;
		}
	default:
		return 0;
	}
};

exports.uglifyFilter = function(text, options) {
	var uglifier = options.wiki.getUglifier('text/x-tiddler-filter');
	try {
		return uglifier.uglify(text, options).text;
	} catch (e) {
		// We swallow the error here. Just assume parsing the filter
		// failed because it had weird placeholders in it or something.
		return text.trim();
	}
};

var _letAvail;

exports.letAvailable = function() {
	if (_letAvail === undefined) {
		_letAvail = !$tw.wiki.renderText(null, null, "<$let/>");
	}
	return _letAvail;
};

function getOriginalQuoting(param, source, hasName) {
	var string = param.value,
		pos = $tw.utils.skipWhiteSpace(source, param.start);
	if (hasName) {
		pos += param.name.length;
		pos = $tw.utils.skipWhiteSpace(source, pos);
		pos++; // SKip over that ":"
		pos = $tw.utils.skipWhiteSpace(source, pos);
	}
	if (source.substr(pos,3) === '"""') {
		return '"""' + string + '"""';
	}
	if (source[pos] === '"') {
		return '"' + string + '"';
	}
	if (source[pos] === "'") {
		return "'" + string + "'";
	}
	if (source.substr(pos,2) === "[[") {
		return "[[" + string + "]]";
	}
	return string;
};

exports.bestQuoteForAttribute = function(attr, parser) {
	var string = attr.value;
	if (parser.placeholders && parser.placeholders.present(string)) {
		// This string contains a placeholder. We can't change the quoting
		// Figure out what the quoting used to be.
		var text = parser.source,
			pos = $tw.utils.skipWhiteSpace(text, attr.start);
		// There may have been a name change, so we
		// use an old name if it's present.
		pos += (attr.oldName || attr.name).length;
		pos = $tw.utils.skipWhiteSpace(text, pos);
		pos++; // Skip right over that "="
		pos = $tw.utils.skipWhiteSpace(text, pos);
		if (text.substr(pos,3) === '"""') {
			return '"""' + string + '"""';
		}
		if (text[pos] === '"') {
			return '"' + string + '"';
		}
		if (text[pos] === "'") {
			return "'" + string + "'";
		}
		return string;
	}
	if (string.search(/[\/\s<>"'=`]/) < 0 && string.length > 0) {
		return string;
	}
	if (parser.apostrophesAllowed && string.indexOf("'") < 0) {
		return "'" + string + "'";
	}
	if (string.indexOf('"') < 0) {
		return '"' + string + '"';
	}
	return '"""' + string + '"""';
};

// This optimization puts an attribute that does not need quotes at the end
// That way we don't have to put a space after it.
// This optimization will save exactly 1 byte. Fuck yeah...
exports.optimizeAttributeOrdering = function(orderedAttrs, parser) {
	if (orderedAttrs) {
		for (var i = orderedAttrs.length-1; i >= 0; i--) {
			var attr = orderedAttrs[i];
			if (attr.type === "string"
			&& exports.bestQuoteForAttribute(attr, parser) === attr.value) {
				// Fuck yeah. Save that byte.
				orderedAttrs.splice(i, 1);
				orderedAttrs.push(attr);
				break;
			}
		}
	}
}

exports.tagAtStartOfBlock = function(tag, source) {
	var pos = tag.start;
	if (tag.startOfBody || pos === 0 ) {
		return true; //start of stream
	}
	if (source[pos-1] !== "\n") {
		return false; // Not start of line
	}
	// Ensure previous line is blank
	return (source[pos-2] === "\n"
		|| (source[pos-2] === "\r" && source[pos-3] === "\n"));
};

exports.isCurrentTiddlerAttr = function(attr) {
	switch (attr.type) {
		case "macro":
			return attr.value.name === "currentTiddler"
				&& attr.value.params.length == 0;
		case "indirect":
			return attr.textReference == "!!title";
		default:
			return false;
	}
};
