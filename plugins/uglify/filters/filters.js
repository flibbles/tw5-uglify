/*\
title: $:/plugins/flibbles/uglify/filters/filters.js
module-type: uglifier
type: application/javascript

Uglifies filters.
\*/

var utils = require('../wikitext/utils.js');

exports.type = "text/x-tiddler-filter";

// TODO: Make this take options as {wiki, placeholders}
exports.uglify = function(text, parser) {
	var parseTree;
	try {
		parseTree = parser.wiki.parseFilter(text);
	} catch (e) {
		// We swallow the error here. Just assume parsing the filter
		// failed because it had weird placeholders in it or something.
		return text.trim();
	}
	var bits = [],
		title,
		needsSpace = false,
		options = {
			apostrophesAllowed: text.indexOf("'") >= 0,
			bracketsAllowed: text.indexOf("]]") >= 0
		};
	for (var i = 0; i < parseTree.length; i++) {
		var run = parseTree[i];
		if (run.prefix) {
			if (needsSpace) {
				bits.push(" ");
				needsSpace = false;
			}
			bits.push(run.prefix);
		}
		title = runIsSingleTitle(run);
		if (title) {
			var quotedTitle = bestQuoteFor(title, options);
			if (needsSpace && quotedTitle[0] !== "[") {
				// We must have had an unquoted title before. It needs room.
				bits.push(" ");
			}
			bits.push(quotedTitle);
			needsSpace = (quotedTitle === title);
		} else if (run.operators.length > 0) {
			bits.push('[');
			for (var j = 0; j < run.operators.length; j++) {
				var op = run.operators[j];
				var firstOperand = true;
				if (op.prefix) {
					bits.push(op.prefix);
				}
				if (op.operator !== "title" || op.suffix) {
					bits.push(op.operator);
				}
				if (op.suffix) {
					bits.push(':', op.suffix);
				}
				if (op.regexp) {
					bits.push("/", op.regexp.source, "/");
					if (op.regexp.flags) {
						bits.push("(", op.regexp.flags, ")");
					}
				}
				for (var k = 0; k < op.operands.length; k++) {
					var operand = op.operands[k];
					if (!firstOperand) {
						bits.push(',');
					}
					firstOperand = false;
					if (operand.variable) {
						var macro = $tw.utils.parseFilterVariable(operand.text);
						bits.push('<',utils.stringifyMacro(macro, parser), '>');
					} else if (operand.indirect) {
						bits.push('{', operand.text, '}');
					} else {
						bits.push('[', operand.text, ']');
					}
				}
			}
			bits.push(']');
			needsSpace = false;
		}
	}
	return bits.join('');
};

function runIsSingleTitle(run) {
	if (run.operators.length === 1) {
		var op = run.operators[0];
		if (op.operator === "title"
		&& op.operands.length === 1
		&& !op.suffix
		&& !op.prefix) {
			var operand = op.operands[0];
			if (!operand.variable && !operand.indirect) {
				return operand.text;
			}
		}
	}
	return null;
};

function bestQuoteFor(title, options) {
	if (/^[^\s\[\]\-+~=:'"][^\s\[\]]*$/.test(title)) {
		return title;
	}
	if (options.apostrophesAllowed && title.indexOf("'") < 0) {
		return "'" + title + "'";
	}
	if (options.bracketsAllowed && title.indexOf("]") < 0) {
		return "[[" + title + "]]";
	}
	return '"' + title + '"';
};
