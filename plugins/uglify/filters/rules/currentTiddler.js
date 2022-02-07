/*\
title: $:/plugins/flibbles/uglify/filters/rules/currentTiddler.js
module-type: uglifyfilterrule
type: application/javascript

Transforms [<currentTiddler>] to [{!!title}] in filters

\*/

exports.name = "currentTiddler";

exports.transform = function(parseTree) {
	for (var i = 0; i < parseTree.length; i++) {
		var run = parseTree[i];
		for (var j = 0; j < run.operators.length; j++) {
			var op = run.operators[j];
			for (var k = 0; k < op.operands.length; k++) {
				var operand = op.operands[k];
				if (operand.variable
				&& /^currentTiddler\s*$/.test(operand.text)) {
					operand.indirect = true;
					operand.variable = false;
					operand.text = "!!title";
				}
			}
		}
	}
};

