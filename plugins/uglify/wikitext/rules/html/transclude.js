/*\

Uglify html rule for improving $transclude.

\*/

var utils = require("../../utils.js");

exports["$transclude"] = function(tag, parser) {
	if (tag.orderedAttributes.length == 0 && tag.isSelfClosing) {
		var startsBlock = utils.tagAtStartOfBlock(tag, parser.source);
		if (tag.isBlock) {
			if (parser.ruleAllowed("transcludeblock")) {
				parser.skipWhitespace();
				return [{text: "{{}}"}, {text: "\n", tail: true}];
			}
		} else if (parser.ruleAllowed("transcludeinline")) {
			if (parser.pos < parser.source.length
			&& (!startsBlock || !utils.newlineAt(parser.source, parser.pos) || parser.configTrimWhiteSpace)) {
				return [{text: "{{}}", cannotBeAtEnd: startsBlock}];
			} else if (parser.ruleAllowed("commentinline")) {
				return [{text: "{{}}<!---->"}];
			}
		}
		// Else do nothing. We can't convert this.
	}
};
