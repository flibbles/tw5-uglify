/*\

Uglify html rule for trimming down the $link widget.

\*/

var utils = require("../../utils.js");

exports["$link"] = function(tag, parser) {
	var attrs = tag.attributes;
	if (attrs.to && utils.isCurrentTiddlerAttr(attrs.to)) {
		attrs.to = undefined;
		// Remove it from ordered attributes as well.
		for (var i = 0; i < tag.orderedAttributes.length; i++) {
			if (tag.orderedAttributes[i].name == "to") {
				tag.orderedAttributes.splice(i, 1);
				break;
			}
		}
	}
	var tooltip = attrs.tooltip;
	if (tooltip && tooltip.type === "string") {
		var uglifier = parser.wiki.getUglifier("text/vnd.tiddlywiki");
		tooltip.value = uglifier.uglify(tooltip.value, parser).text;
	}
};
