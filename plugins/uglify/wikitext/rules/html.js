/*\

Uglify rule for \whitespace trim.

\*/

var utils = require("../utils.js");
var htmlModifiers = $tw.modules.applyMethods('uglifyhtmlwikitextrule');

exports.name = "html";

exports.uglify = function(text) {
	var tag = this.parse()[0];
	if (htmlModifiers[tag.tag]) {
		// Before we get started,  we give a chance for all
		// the custom rules to make modifications to it.
		htmlModifiers[tag.tag](tag, parser);
	}
	var strings = utils.joinNodeArray(tag.children);
	var tagParts = ["<", tag.tag];
	var attributes = tag.orderedAttributes || tag.attributes;
	var parser = this.parser;
	$tw.utils.each(attributes, function(attr) {
		tagParts.push(" ", attr.newName || attr.name);
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
		if (tag.isBlock) {
			tagParts.push("\n\n");
			// This is tricky. if it's a block, it either has two newlines,
			// or it has a single newline at EOF. We want to claim those two
			// newlines, but we set the trailing junk to 1, because if this
			// ends up at EOF, we want to chomp one of those newlines.
			this.parser.trailingJunkLength++;
			// No matter the situation, we need to preserve that newline
			this.parser.pos+=2;
			if (this.parser.pos > this.parser.sourceLength) {
				// We want to jump past those newlines, but not past EOF
				this.parser.pos = this.parser.sourceLength;
			}
		} else if (!this.parser.configTrimWhiteSpace
		&& utils.newlineAt(this.parser.source, tag.end)
		&& startOfBlock(this.parser.source, tag.start)) {
			// This is a special use case. An inline <closing-tag/> with a
			// newline following it can only exist if it's followed by
			// something. So we can't allow the EOF to occur here.
			this.cannotBeAtEnd = true;
		}
	} else {
		tagParts.push(">");
		if (tag.isBlock) {
			tagParts.push('\n\n');
		}
		tagParts = tagParts.concat(strings, ["</", tag.tag, ">"]);
		if (!this.parser.cannotEndYet && (tag.isBlock || strings !== "\n")) {
			// That closing tag is potentially trailing junk. Add its length.
			this.parser.trailingJunkLength += 3 + tag.tag.length;
		}
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

function startOfBlock(source, pos) {
	if (pos === 0 ) {
		return true; //start of stream
	}
	if (source[pos-1] !== "\n") {
		return false; // Not start of line
	}
	// Ensure previous line is blank
	return (source[pos-2] === "\n"
		|| (source[pos-2] === "\r" && source[pos-3] === "\n"));
};
