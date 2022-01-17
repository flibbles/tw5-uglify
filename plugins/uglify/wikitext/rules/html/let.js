/*\

Uglify html rule for merging nested $let widgets when possible.

\*/

var utils = require("../../utils.js");

exports["$let"] = function(tag, parser) {
	if (tag.children.length > 0) {
		var firstIndex = 0,
			lastIndex = tag.children.length-1;
		// We can back up from
		while (firstIndex < tag.children.length && tag.children[firstIndex].type == 'text') {
			firstIndex++;
		}
		while (lastIndex >= 0 && tag.children[lastIndex].type == 'text') {
			lastIndex--;
		}
		var first = tag.children[firstIndex],
			last = tag.children[lastIndex];
		if (first.tag
		&& first.tag.tag == "$let"
		&& last.text == "</$let>"
		&& (tag.isBlock || !first.tag.isBlock)
		&& last.start == first.tag.start) {
			tag.orderedAttributes.push.apply(tag.orderedAttributes, first.tag.orderedAttributes);
			// Remove that inner closing tag
			tag.children.splice(lastIndex, 1);
			if (!tag.isBlock && removalWillCauseBlock(tag.children, firstIndex)) {
				// We can't remove it without risking changing rendering.
				// We'll put in a dummy comment
				tag.children[firstIndex] = {text: "<!---->", tail: true};
			} else {
				// And that inner opening tag
				tag.children.splice(firstIndex, 1);
			}
			tag.isBlock = tag.isBlock && first.tag.isBlock;
		}
	};
};

function removalWillCauseBlock(children, index) {
	if (index <= 0 || index >= children.length-1) {
		return false;
	}
	var prevText = children[index-1].text,
		nextText = children[index+1].text;
	return (/^\s+$/.test(prevText) && /^\s*\n/.test(nextText));
};
