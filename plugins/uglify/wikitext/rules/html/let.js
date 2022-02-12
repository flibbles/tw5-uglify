/*\

Uglify html rule for merging nested $let widgets when possible.

\*/

var utils = require("../../utils.js");

exports["$let"] = function(tag, parser) {
	var children = tag.children;
	if (children && children.length > 0) {
		var firstIndex = 0,
			lastIndex = children.length-1,
			startTagGap = "",
			endTagGap = "";
		// We can back up from
		while (firstIndex < children.length && children[firstIndex].type == 'text') {
			startTagGap = startTagGap + children[firstIndex].text;
			firstIndex++;
		}
		while(lastIndex >= 0 && children[lastIndex].type == 'text') {
			endTagGap = children[lastIndex].text + endTagGap;
			lastIndex--;
		}
		var first = children[firstIndex],
			last = children[lastIndex];
		if (first && first.tag && first.tag.tag == "$let"
		&& last.text == "</$let>"
		// If lets contain transclusion as a variable, this can affect qualifying. Pass.
		&& first.tag.attributes.transclusion === undefined
		&& tag.attributes.transclusion === undefined
		&& last.start == first.tag.start // Ensure open and close tags match
		&& canFold(tag.isBlock, first.tag.isBlock, startTagGap, endTagGap, children[firstIndex+1], parser)) {
			var dummyRequired = !tag.isBlock && removalWillCauseBlock(children, firstIndex);
			if (dummyRequired && !parser.ruleAllowed("commentinline")) {
				// We'd need to put a dummy in place to maintain proper
				// block rendering, but comments are disabled.
				// Nothing we can do.
				return;
			}
			tag.orderedAttributes.push.apply(tag.orderedAttributes, first.tag.orderedAttributes);
			// Remove that inner closing tag
			children.splice(lastIndex, 1);
			if (dummyRequired) {
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

function containsNoPlaceholders(childNode, parser) {
	return childNode.type !== 'text'
		|| !parser.placeholders.present(childNode.text);
};

function canFold(outerIsBlock, innerIsBlock, startTagGap, endTagGap, innerNode, parser) {
	var placeholders = parser.placeholders;
	if (placeholders &&
	(placeholders.present(startTagGap) || placeholders.present(endTagGap))) {
		// Merging $lets will move placeholders around. No good.
		return false;
	}
	var regexp = /\S/,
		anyNonSpaces = regexp.test(startTagGap) || regexp.test(endTagGap);
	if (outerIsBlock) {
		if (anyNonSpaces && !innerIsBlock) {
			return false;
		}
	} else if (innerIsBlock) {
		return false;
	}
	if (innerNode.type == 'text'
	&& placeholders
	&& placeholders.present(innerNode.text)) {
		// There's a placeholder just inside the inner $let. Be careful.
		if (!outerIsBlock || anyNonSpaces) {
			return false;
		}
	}
	return true;
};

function removalWillCauseBlock(children, index) {
	if (index <= 0 || index >= children.length-1) {
		return false;
	}
	var prevText = children[index-1].text,
		nextText = children[index+1].text;
	return (/^\s+$/.test(prevText) && /^\s*\n/.test(nextText));
};
