/*\

Uglify rule for <% conditionals %>

\*/

var utils = require("../utils.js");

exports.name = "conditional";

exports.uglify = function() {
	var filter = this.parser.source.substring(this.match.index + this.match[0].length, this.terminateIfMatch.index),
		array = [{text: "<%if "}],
		isBlock = this.is.block,
		ex;
	this.parser.pos = this.terminateIfMatch.index + this.terminateIfMatch[0].length;
	var reEndString = "\\<\\%\\s*(endif)\\s*\\%\\>|\\<\\%\\s*(else)\\s*\\%\\>|\\<\\%\\s*(elseif)\\s+([\\s\\S]+?)\\%\\>";
	array.push({text: utils.uglifyFilter(filter, this.parser)});
	while (true) {
		array.push({text: "%>"});
		// Check for an immediately following double linebreak
		var hasLineBreak = doubleLineBreakAtPos(this.parser);
		if (hasLineBreak) {
			array.push({text: "\n\n"});
		}
		// Parse the body looking for else or endif
		if (hasLineBreak) {
			ex = this.parser.parseBlocksTerminatedExtended(reEndString);
		} else {
			var reEnd = new RegExp(reEndString,"mg");
			ex = this.parser.parseInlineRunTerminatedExtended(reEnd,{eatTerminator: true});
		}
		array = array.concat(ex.tree);
		if (ex.match) {
			if (ex.match[3] === "elseif") {
				array.push({text: "<%elseif "});
				array.push({text: utils.uglifyFilter(ex.match[4], this.parser)});
				continue;
			} else if (ex.match[2] === "else") {
				array.push({text: "<%else"});
				reEndString = "\\<\\%\\s*(endif)\\s*\\%\\>";
				continue;
			}
		}
		break;
	}
	array.push({text: "<%endif%>", tail: true});
	if (isBlock) {
		this.parser.skipWhitespace();
	}
	return array;
};

function doubleLineBreakAtPos(parser) {
	return !!$tw.utils.parseTokenRegExp(parser.source, parser.pos, /([^\S\n\r]*\r?\n(?:[^\S\n\r]*\r?\n|$))/g);
};
