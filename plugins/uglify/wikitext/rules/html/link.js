/*\

Uglify html rule for trimming down the $link widget.

\*/

var utils = require("../../utils.js");

exports["$link"] = function(tag, parser) {
	var attrs = tag.attributes;
	var pointsToCurrent = !attrs.to;
	if (attrs.to && utils.isCurrentTiddlerAttr(attrs.to)) {
		attrs.to = undefined;
		pointsToCurrent = true;
		// Remove it from ordered attributes as well.
		for (var i = 0; i < tag.orderedAttributes.length; i++) {
			if (tag.orderedAttributes[i].name == "to") {
				tag.orderedAttributes.splice(i, 1);
				break;
			}
		}
	}
	// TODO: If it would become a block from inline
	if (pointsToCurrent
	&& tag.children
	&& tag.children.length == 1
	&& isTitleText(tag.children[0].text)) {
		tag.children = [];
		if (canBecomeSelfClosing(tag, parser)) {
			tag.isSelfClosing = true;
		}
	}
	var tooltip = attrs.tooltip;
	if (tooltip && tooltip.type === "string") {
		var uglifier = parser.wiki.getUglifier("text/vnd.tiddlywiki");
		tooltip.value = uglifier.uglify(tooltip.value, parser).text;
	}
};

function isTitleText(text) {
	return text === "<$view field=title/>" || text === "<$text text={{!!title}}/>";
};

function canBecomeSelfClosing(tag, parser) {
	return !couldBeForBlock(parser.source, parser.pos)
		|| !utils.tagAtStartOfBlock(tag, parser.source);
};

// Is double newline at pos, or a newline-EOF?
function couldBeForBlock(source, pos) {
	var firstChar = utils.newlineAt(source, pos);
	if (firstChar) {
		pos += firstChar;
		return utils.newlineAt(source, pos) || pos >= source.length;
	}
	return false;
};
