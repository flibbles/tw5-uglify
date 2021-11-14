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
		tagParts.push(" ", attr.name, "=");
		switch(attr.type) {
		case "string":
			tagParts.push(bestQuoteFor(attr.value, parser));
			break;
		case "indirect":
			tagParts.push("{{", attr.textReference, "}}");
			break;
		case "macro":
			tagParts.push(utils.stringifyMacro(attr.value, parser));
			break;
		case "filtered":
			tagParts.push("{{{", attr.filter.trim(), "}}}");
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

function bestQuoteFor(string, parser) {
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
