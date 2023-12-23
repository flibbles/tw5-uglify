/*\

Uglify rule for <% conditionals %>

\*/

var utils = require("../utils.js");

exports.name = "conditional";

exports.uglify = function() {
	var filter = this.parser.source.substring(this.match.index + this.match[0].length, this.terminateIfMatch.index),
		array = [{text: "<%if "}],
		isBlock = this.is.block;
	this.parser.pos = this.terminateIfMatch.index + this.terminateIfMatch[0].length;
	while (true) {
		array.push({text: [utils.uglifyFilter(filter, this.parser), "%>"].join('')});
		// Check for an immediately following double linebreak
		var hasLineBreak = doubleLineBreakAtPos(this.parser);
		if (hasLineBreak) {
			array.push({text: "\n\n"});
		}
		// Parse the body looking for else or endif
		var reEndString = "\\<\\%\\s*(endif)\\s*\\%\\>|\\<\\%\\s*(else)\\s*\\%\\>|\\<\\%\\s*(elseif)\\s+([\\s\\S]+?)\\%\\>",
			ex;
		if(hasLineBreak) {
			ex = this.parser.parseBlocksTerminatedExtended(reEndString);
		} else {
			var reEnd = new RegExp(reEndString,"mg");
			ex = this.parser.parseInlineRunTerminatedExtended(reEnd,{eatTerminator: true});
		}
		array = array.concat(ex.tree);
		if (ex.match) {
			if (ex.match[1] === "endif") {
				break;
			} else if (ex.match[2] === "else") {
				hasLineBreak = doubleLineBreakAtPos(this.parser);
				if (hasLineBreak) {
					array.push({text: "\n\n"});
				}
				var reEndString = "\\<\\%\\s*(endif)\\s*\\%\\>",
					ex;
				if (hasLineBreak) {
					ex = this.parser.parseBlocksTerminatedExtended(reEndString);
				} else {
					var reEnd = new RegExp(reEndString,"mg");
					ex = this.parser.parseInlineRunTerminatedExtended(reEnd,{eatTerminator: true});
				}
				array.push({text: "<%else%>"});
				array = array.concat(ex.tree);
				break;
			} else if (ex.match[3] === "elseif") {
				filter = ex.match[4];
				array.push({text: "<%elseif "});
			}
		}
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
