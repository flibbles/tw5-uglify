/*\

Uglify rule for \whitespace trim.

\*/

var utils = require("./utils.js");

exports.name = "html";

exports.uglify = function(text) {
	var tag = this.parse()[0];
	var strings = utils.joinNodeArray(tag.children);
	var tagParts = ["<", tag.tag];
	var attributes = tag.orderedAttributes || tag.attributes;
	var parser = this.parser;
	$tw.utils.each(attributes, function(attr) {
		tagParts.push(" ", attr.name);
		switch(attr.type) {
		case "string":
			if (attr.value !== "true") {
				tagParts.push("=", bestQuoteFor(attr, parser));
			}
			break;
		case "indirect":
			tagParts.push("={{", attr.textReference, "}}");
			break;
		case "macro":
			tagParts.push("=", utils.stringifyMacro(attr.value, parser));
			break;
		case "filtered":
			tagParts.push("={{{", attr.filter.trim(), "}}}");
			break;
		default:
			throw "Not Implemented";
		}
	});
	if ($tw.config.htmlVoidElements.indexOf(tag.tag) >= 0) {
		tagParts.push(">");
	} else if (tag.isSelfClosing) {
		tagParts.push("/>");
	} else {
		tagParts.push(">");
		if (tag.isBlock) {
			tagParts.push('\n\n');
		}
		tagParts = tagParts.concat(strings, ["</", tag.tag, ">"]);
	}
	return tagParts.join('');
};

function bestQuoteFor(attr, parser) {
	var string = attr.value;
	if (parser.containsPlaceholder(string)) {
		// This string contains a placeholder. We can't change the quoting
		// Figure out what the quoting used to be.
		var text = parser.source,
			pos = $tw.utils.skipWhiteSpace(text, attr.start);
		pos += attr.name.length;
		pos = $tw.utils.skipWhiteSpace(text, pos);
		pos++; // Skip right over that "="
		pos = $tw.utils.skipWhiteSpace(text, pos);
		if (text.substr(pos,3) === '"""') {
			return '"""' + string + '"""';
		}
		if (text[pos] === '"') {
			return '"' + string + '"';
		}
		if (text[pos] === "'") {
			return "'" + string + "'";
		}
		return string;
	}
	if (string.search(/[\/\s>"'=]/) < 0 && string.length > 0) {
		return string;
	}
	if (parser.apostrophesAllowed && string.indexOf("'") < 0) {
		return "'" + string + "'";
	}
	if (string.indexOf('"') < 0) {
		return '"' + string + '"';
	}
	return '"""' + string + '"""';
};
