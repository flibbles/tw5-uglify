/*\

Uglify rule for

$:/syslinks

\*/

var utils = require("../utils.js");

exports.name = "syslink";

exports.uglify = function() {
	var p = this.parser,
		text = this.match[0],
		isLink = text[0] !== '~';
	// Is there a risk of trimming away the space separating this link from
	// text that would be slurped in?
	p.pos += text.length;
	if (p.configTrimWhiteSpace
	&& wouldBeSlurped(p.source.charAt($tw.utils.skipWhiteSpace(p.source, p.pos)))) {
		var element = {
			start: this.match.index,
			startOfBody: p.startOfBody};
		// Is this a block? If it is, we don't have to worry, but if it's
		// inline, we need to worry.
		if (!utils.tagAtStartOfBlock(element, p.source)
		|| (!utils.newlineAt(p.source, p.pos + utils.newlineAt(p.source, p.pos)))) {
			// Okay, overslurping would happen. Maybe we can make this a
			// prettylink instead?
			if (p.ruleAllowed('prettylink') && isLink) {
				return [{text: "[[" + text + "]]", textWithTrim: text + ' '}];
			} else {
				// No pretty link. We simply can't eat the whitespace.
				// need to forgo removing the whitespace trim pragma
				p.cannotEnsureNoWhiteSpace = true;
				text += ' ';
			}
		}
	}
	return [{text: text}];
};

var regexp;

function wouldBeSlurped(string) {
	if (regexp === undefined) {
		var any = $tw.config.textPrimitives.anyLetter;
		regexp = new RegExp("[" + any.substr(1, any.length - 2) + "\/._-]");
	}
	return string.match(regexp);
};
