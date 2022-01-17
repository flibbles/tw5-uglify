/*\

Uglify html rule for merging nested $let widgets when possible.

\*/

var utils = require("../../utils.js");

exports["$let"] = function(tag, parser) {
	if (tag.children.length > 0) {
		var firstIndex = 0,
			lastIndex = tag.children.length-1,
			nonWhitespaceBetween = false;
		// We can back up from
		while (firstIndex < tag.children.length && tag.children[firstIndex].type == 'text') {
			// Track if there's non whitespace between the tags
			nonWhitespaceBetween = nonWhitespaceBetween || !/^\s+$/.test(tag.children[firstIndex].text);
			firstIndex++;
		}
		var first = tag.children[firstIndex],
			last = tag.children[lastIndex];
		if (first && first.tag && first.tag.tag == "$let"
		&& last.text == "</$let>"
		&& canFold(tag.isBlock, first.tag.isBlock, nonWhitespaceBetween)
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

function canFold(outerIsBlock, innerIsBlock, nonWhitespaceBetween) {
	if (outerIsBlock) {
		return !nonWhitespaceBetween || innerIsBlock;
	} else {
		return !innerIsBlock;
	}
};

function removalWillCauseBlock(children, index) {
	if (index <= 0 || index >= children.length-1) {
		return false;
	}
	var prevText = children[index-1].text,
		nextText = children[index+1].text;
	return (/^\s+$/.test(prevText) && /^\s*\n/.test(nextText));
};
