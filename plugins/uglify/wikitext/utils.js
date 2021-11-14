/*\
module-type: library

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
	var strings = ["<<", macro.name];
	$tw.utils.each(macro.params, function(param) {
		strings.push(" ");
		if (param.name) {
			strings.push(param.name, ":");
		}
		strings.push(bestQuoteFor(param.value, parser));
	});
	strings.push(">>");
	return strings.join("");
};

function bestQuoteFor(param, parser) {
	if (param.search(/[\s>"']/) < 0 && param.length > 0) {
		return param;
	}
	if (parser.apostrophesAllowed && param.indexOf("'") < 0) {
		return "'" + param + "'";
	}
	if (parser.bracketsAllowed && param.indexOf("]]") < 0) {
		return "[[" + param + "]]";
	}
	if (param.indexOf('"') < 0) {
		return '"' + param + '"';
	}
	return '"""' + param + '"""';
};
