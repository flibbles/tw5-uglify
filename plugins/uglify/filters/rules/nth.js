/*\
title: $:/plugins/flibbles/uglify/filters/rules/nth.js
module-type: uglifyfilterrule
type: application/javascript

Transforms first[], nth[1], zth[0], and limit[1] to [nth[]] in filters

\*/

exports.name = "nth";

exports.transform = function(parseTree) {
	for (var i = 0; i < parseTree.length; i++) {
		var run = parseTree[i];
		for (var j = 0; j < run.operators.length; j++) {
			var op = run.operators[j];
			if (!op.suffix
			&& !op.regexp
			&& op.operands.length === 1) {
				var operand = op.operands[0];
				if (!operand.variable && !operand.indirect) {
					if (isValidCombo(op, operand.text)) {
						op.operator = "nth";
						operand.text = "";
					}
				}
			}
		}
	}
};

function isValidCombo(operator, text) {
	switch(operator.operator) {
	case "first":
		return text === "" || text === "1";
	case "limit":
		return !operator.prefix && text === "1";
	case "zth":
		return text === "0";
	case "nth":
		return text === "1";
	}
	return false;
};
