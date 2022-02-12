/*\
title: $:/plugins/flibbles/uglify/filters/rules/tag.js
module-type: uglifyfilterrule
type: application/javascript

Transforms [all[shadows+tiddlers]tag[X]] to [[X]tagging[]] in filters

\*/

exports.name = "tag";

exports.transform = function(parseTree) {
	for (var i = 0; i < parseTree.length; i++) {
		var run = parseTree[i];
		for (var j = 1; j < run.operators.length; j++) {
			var tag = run.operators[j];
			var all = run.operators[j-1];
			if (tag.operator === "tag"
			&& all.operator === "all"
			&& !all.prefix && !tag.prefix
			&& !all.suffix && !tag.suffix
			&& !all.regexp && !tag.regexp
			&& all.operands.length == 1 && tag.operands.length == 1
			&& !all.operands[0].indirect && !all.operands[0].variable
			&& coversAllTiddlers(all.operands[0].text)) {
				var tagOp = tag.operands[0];
				var allOp = all.operands[0];
				all.operator = "title";
				all.operands[0] = tag.operands[0];
				tag.operator = "tagging";
				tag.operands[0] = {text: ""};
			}
		}
	}
};

function coversAllTiddlers(parameter) {
	var bits = parameter.split("+") || [],
		shadows = false, tiddlers = false;
	if (bits.length !== 2) {
		return false;
	}
	for (var i = 0; i < bits.length; i++) {
		var bit = bits[i];
		if (bit === "shadows") {
			shadows = true;
		}
		if (bit === "tiddlers") {
			tiddlers = true;
		}
	}
	return shadows && tiddlers
};
