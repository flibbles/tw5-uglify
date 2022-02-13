/*\

Uglify html rule for improving $transclude.

\*/

var utils = require("../../utils.js");

exports["$transclude"] = function(tag, parser) {
	var pretty = getPrettyTransclude(tag, parser);
	if (pretty) {
		var startsBlock = utils.tagAtStartOfBlock(tag, parser.source);
		if (tag.isBlock) {
			if (parser.ruleAllowed("transcludeblock")) {
				parser.skipWhitespace();
				return [{text: pretty}, {text: "\n", tail: true}];
			}
		} else if (parser.ruleAllowed("transcludeinline")) {
			if (parser.pos < parser.source.length
			&& (!startsBlock || !utils.newlineAt(parser.source, parser.pos) || parser.configTrimWhiteSpace)) {
				return [{text: pretty, cannotBeAtEnd: startsBlock}];
			} else if (parser.ruleAllowed("commentinline")) {
				return [{text: pretty+"<!---->"}];
			}
		}
		// Else do nothing. We can't convert this.
	}
};

function getPrettyTransclude(tag, options) {
	if (!tag.isSelfClosing) {
		return null;
	}
	if (tag.orderedAttributes.length == 0) {
		return "{{}}";
	}
	if (tag.orderedAttributes.length == 1
	&& tag.attributes.tiddler
	&& tag.attributes.tiddler.type === "string"
	&& !/[\|\{\}]/.test(tag.attributes.tiddler.value)
	&& (!options.placeholders || !options.placeholders.present(tag.attributes.tiddler.value))) {
		return "{{||" + tag.attributes.tiddler.value + "}}";
	}
};
