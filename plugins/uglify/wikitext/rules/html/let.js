/*\

Uglify html rule for merging nested $let widgets when possible.

\*/

var utils = require("../../utils.js");

exports["$let"] = function(tag, parser) {
	var children = tag.children;
	if (children.length > 0) {
		var firstIndex = 0,
			lastIndex = children.length-1,
			nonSpaceBetween = false;
		// We can back up from
		while (firstIndex < children.length && children[firstIndex].type == 'text') {
			// Track if there's non whitespace between the tags
			nonSpaceBetween = nonSpaceBetween || !/^\s+$/.test(children[firstIndex].text);
			firstIndex++;
		}
		while(lastIndex >= 0 && children[lastIndex].type == 'text') {
			nonSpaceBetween = nonSpaceBetween || ~/^\s+$/.test(children[lastIndex].text);
			lastIndex--;
		}
		var first = children[firstIndex],
			last = children[lastIndex];
		if (first && first.tag && first.tag.tag == "$let"
		&& last.text == "</$let>"
		&& canFold(tag.isBlock, first.tag.isBlock, nonSpaceBetween)
		&& last.start == first.tag.start) {
			tag.orderedAttributes.push.apply(tag.orderedAttributes, first.tag.orderedAttributes);
			// Remove that inner closing tag
			children.splice(lastIndex, 1);
			if (!tag.isBlock && removalWillCauseBlock(children, firstIndex)) {
				// We can't remove it without risking changing rendering.
				// We'll put in a dummy comment
				children[firstIndex] = {text: "<!---->", tail: true};
			} else {
				// And that inner opening tag
				children.splice(firstIndex, 1);
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
