/*\
title: $:/plugins/flibbles/uglify/filters/filters.js
module-type: uglifier
type: application/javascript

Uglifies filters.
\*/

var utils = require('../wikitext/utils.js');
var rules = $tw.modules.getModulesByTypeAsHashmap("uglifyfilterrule");

exports.type = "application/x-tiddler-filter";

exports.uglify = function(text, options) {
	var parseTree = parseFilter(text, options.wiki),
		bits = [],
		title,
		needsSpace = false,
		options = {
			wiki: options.wiki,
			placeholders: options.placeholders,
			apostrophesAllowed: text.indexOf("'") >= 0,
			bracketsAllowed: text.indexOf("]") >= 0
		};
	for (var name in rules) {
		// Let every rule have a chance to apply its magic
		rules[name].transform(parseTree, options);
	}
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
			var quotedTitle = bestQuoteFor(title, text.charAt(run.titleStart), options);
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
				} else {
					for (var k = 0; k < op.operands.length; k++) {
						var operand = op.operands[k];
						if (!firstOperand) {
							bits.push(',');
						}
						firstOperand = false;
						if (operand.variable) {
							var macro = $tw.utils.parseFilterVariable(operand.text);
							bits.push('<',utils.stringifyMacro(macro, operand.text, options), '>');
						} else if (operand.indirect) {
							bits.push('{', operand.text, '}');
						} else {
							bits.push('[', operand.text, ']');
						}
					}
				}
			}
			bits.push(']');
			needsSpace = false;
		}
	}
	return {text: bits.join('')};
};

function runIsSingleTitle(run) {
	if (run.operators.length === 1 && !run.namedPrefix) {
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

/**
 * This functions the same as wiki.parseFilter, except that it gets
 * start indices for all the titles.
 */
function parseFilter(text, wiki) {
	var parseTree = wiki.parseFilter(text),
		ptr = $tw.utils.skipWhiteSpace(text, 0);
	for (var i = 0; i < parseTree.length; i++) {
		ptr = $tw.utils.skipWhiteSpace(text, ptr);
		var run = parseTree[i];
		var title = runIsSingleTitle(run);
		if (title) {
			ptr += run.prefix.length;
			// This line is the whole reason for this function.
			// We need to set titleStart
			run.titleStart = ptr;
			ptr = indexOfTitleClosingQuote(text, ptr) + 1;
		} else if (run.operators.length === 0) {
			// Strange case of empty quotes
			ptr += 2;
		} else {
			ptr = text.indexOf('[', ptr);
			for (var j = 0; j < run.operators.length; j++) {
				var op = run.operators[j];
				if (op.regexp) {
					ptr = text.indexOf('/', ptr) + op.regexp.source.length + 2;
				} else {
					for (var k = 0; k < op.operands.length; k++) {
						var operand = op.operands[k];
						if (operand.variable) {
							ptr = text.indexOf('>', ptr) + 1;
						} else if (operand.indirect) {
							ptr = text.indexOf('}', ptr) + 1;
						} else {
							ptr = text.indexOf(']', ptr) + 1;
						}
					}
				}
			}
			ptr = text.indexOf(']', ptr) + 1;
		}
	}
	// This bit is a sanity test to ensure we walked the filter correctly.
	/*
	ptr = $tw.utils.skipWhiteSpace(text, ptr) ;
	if (ptr !== text.length) {
		throw "ptr was only at: " + ptr + " out of " + text.length + " in " + text;
	}
	*/
	return parseTree;
};

function indexOfTitleClosingQuote(filter, ptr) {
	switch (filter.charAt(ptr)) {
	case '"':
		return filter.indexOf('"', ptr+1);
	case "'":
		return filter.indexOf("'", ptr+1);
	case '[':
		return filter.indexOf(']]', ptr) + 1;
	default:
		var regexp = /(?:\s|\[|\]|$)/g;
		regexp.lastIndex = ptr;
		// Go to 1 before the end of the space-less string
		return regexp.exec(filter).index - 1;
	}
};

function bestQuoteFor(title, originalQuote, options) {
	if (options.placeholders && options.placeholders.present(title)) {
		// There is a placeholder present here. We can't afford to change
		// the quotation
		switch (originalQuote) {
		case '"':
			return '"' + title + '"';
		case "'":
			return "'" + title + "'";
		case '[':
			return "[[" + title + "]]";
		default:
			return title;
		}
	}
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
