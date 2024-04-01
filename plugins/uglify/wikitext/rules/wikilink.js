/*\

Uglify rule for

WikiLinks

\*/

var utils = require("../utils.js");

exports.name = "wikilink";

exports.uglify = function() {
	var p = this.parser,
		text = this.match[0];
	// Is there a risk of trimming away the space separating this link from
	// text that would be slurped in?
	p.pos += text.length;
	if (p.configTrimWhiteSpace) {
		// Is this a block? If it is, we don't have to worry, but if it's
		// inline, we need to worry.
		var element = {
			start: this.match.index,
			startOfBody: p.startOfBody};
		if (!utils.tagAtStartOfBlock(element, p.source)
		|| (!utils.newlineAt(p.source, p.pos + utils.newlineAt(p.source, p.pos)))) {
			var trimText = text,
				slurpRisk = false,
				isLink = text[0] !== $tw.config.textPrimitives.unWikiLink;
			// Slurp risk at the end of the text?
			if (wouldBeSlurped(p.source.charAt($tw.utils.skipWhiteSpace(p.source, p.pos)))) {
				trimText += ' ';
				slurpRisk = true;
			}
			// Slurp risk at the beginning?
			if (!p.startOfBody && wouldBeSlurped(precedingChar(p.source, this.match.index))) {
				trimText = ' ' + trimText;
				slurpRisk = true;
			}
			if (slurpRisk) {
				// Okay, overslurping would happen. Maybe we can make this a
				// prettylink instead?
				if (p.ruleAllowed('prettylink') && isLink) {
					return [{text: "[[" + text + "]]", textWithTrim: trimText}];
				}
				// No pretty link. We simply can't eat the whitespace.
				// need to forgo removing the whitespace trim pragma
				p.cannotEnsureNoWhiteSpace = true;
				text = trimText;
			}
		}
	}
	return [{text: text}];
};

function precedingChar(source, pos) {
	while (--pos >= 0) {
		var c = source.charAt(pos);
		if ($tw.utils.skipWhiteSpace(c, 0) === 0) {
			return c;
		}
	}
	return '';
};

var regexp;

function wouldBeSlurped(string) {
	if (regexp === undefined) {
		regexp = new RegExp($tw.config.textPrimitives.blockPrefixLetters);
	}
	return string.match(regexp);
};
