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

exports.stringifyMacro = function(macro, parser) {
	var strings = [macro.name];
	$tw.utils.each(macro.params, function(param) {
		strings.push(" ");
		if (param.name) {
			strings.push(param.name, ":");
		}
		if (parser.placeholders.present(param.value)) {
			strings.push(getOriginalQuoting(param, parser));
		} else {
			strings.push(exports.quotifyParam(param.value, false, parser));
		}
	});
	return strings.join("");
};

exports.quotifyParam = function(param, allowBrackets, options) {
	if (param.search(/[\s"']/) < 0 && param.length > 0 && (allowBrackets || param.indexOf(">") < 0)) {
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

var _letAvail;

exports.letAvailable = function() {
	if (_letAvail === undefined) {
		_letAvail = !$tw.wiki.renderText(null, null, "<$let/>");
	}
	return _letAvail;
};

function getOriginalQuoting(param, parser) {
	var text = parser.source,
		string = param.value,
		pos = $tw.utils.skipWhiteSpace(text, param.start);
	if (param.name) {
		pos += param.name.length;
		pos = $tw.utils.skipWhiteSpace(text, pos);
		pos++; // SKip over that ":"
		pos = $tw.utils.skipWhiteSpace(text, pos);
	}
	if (text.substr(pos,3) === '"""') {
		return '"""' + string + '"""';
	}
	if (text[pos] === '"') {
		return '"' + string + '"';
	}
	if (text[pos] === "'") {
		return "'" + string + "'";
	}
	if (text.substr(pos,2) === "[[") {
		return "[[" + string + "]]";
	}
	return string;
};

exports.bestQuoteForAttribute = function(attr, parser) {
	var string = attr.value;
	if (parser.placeholders.present(string)) {
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
	if (string.search(/[\/\s<>"'=]/) < 0 && string.length > 0) {
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
