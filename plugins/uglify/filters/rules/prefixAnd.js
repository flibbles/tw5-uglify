/*\
title: $:/plugins/flibbles/uglify/filters/rules/prefixAnd.js
module-type: uglifyfilterrule
type: application/javascript

Transforms [...] +[...] to [......]

Because an "and" prefix after a single run is unnecessary and expensive.

\*/

exports.name = "prefixAnd";

exports.transform = function(parseTree, options) {
	if (options.bracketsAllowed) {
		while (parseTree.length >= 2
		&& (parseTree[0].prefix === "")
		&& (parseTree[1].prefix === "+" || parseTree[1].namedPrefix === "and")
		&& bracketSafe(parseTree[0], options)
		&& bracketSafe(parseTree[1], options)) {
			parseTree[0].operators = parseTree[0].operators.concat(parseTree[1].operators);
			parseTree.splice(1,1);
		}
	}
};

// This isn't a run which was just a string title with dangerous brackets
function bracketSafe(run, options) {
	var operator = run.operators[0],
		op = operator && operator.operands[0];
	if (operator.operator == "title" && options.placeholders && options.placeholders.present(op.text)) {
		// This is a dangerous operator. It has placeholders in it.
		// It might even be just a straight placeholder.
		return false;
	}
	return !op || op.indirect || op.variable || (op.text.indexOf("]") < 0);
};
