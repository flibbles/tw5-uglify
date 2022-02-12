/*\
title: $:/plugins/flibbles/uglify/filters/rules/allCurrent.js
module-type: uglifyfilterrule
type: application/javascript

Transforms [all[current]] to [{!!title}] in filters

\*/

exports.name = "allCurrent";

exports.transform = function(parseTree) {
	for (var i = 0; i < parseTree.length; i++) {
		var run = parseTree[i];
		for (var j = 0; j < run.operators.length; j++) {
			var op = run.operators[j];
			if (op.operator === "all"
			&& !op.suffix
			&& !op.prefix
			&& !op.regexp
			&& op.operands.length === 1) {
				var operand = op.operands[0];
				if (operand.text === "current"
				&& !operand.variable
				&& !operand.indirect) {
					op.operator = "title";
					operand.indirect = true;
					operand.text = "!!title";
				}
			}
		}
	}
};
