/*\
title: $:/plugins/flibbles/uglify/filters/rules/hasDraftOf.js
module-type: uglifyfilterrule
type: application/javascript

Transforms [has[draft.of]] to [is[draft]] in filters

\*/

exports.name = "hasDraftOf";

exports.transform = function(parseTree) {
	for (var i = 0; i < parseTree.length; i++) {
		var run = parseTree[i];
		for (var j = 0; j < run.operators.length; j++) {
			var op = run.operators[j];
			if (op.operator === "has"
			&& !op.suffix
			&& !op.regexp
			&& op.operands.length === 1) {
				var operand = op.operands[0];
				if (operand.text === "draft.of"
				&& !operand.variable
				&& !operand.indirect) {
					op.operator = "is";
					operand.text = "draft";
				}
			}
		}
	}
};

