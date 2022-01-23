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
		if (parser.containsPlaceholder(param.value)) {
			strings.push(getOriginalQuoting(param, parser));
		} else {
			strings.push(exports.quotifyParam(param.value, parser));
		}
	});
	return strings.join("");
};

exports.quotifyParam = function(param, parser, options) {
	var allowBrackets = options && options.allowBrackets;
	if (param.search(/[\s"']/) < 0 && param.length > 0 && (allowBrackets || param.indexOf(">") < 0)) {
		return param;
	}
	if (parser.apostrophesAllowed && param.indexOf("'") < 0) {
		return "'" + param + "'";
	}
	if (parser.bracketsAllowed && param.indexOf("]") < 0) {
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

