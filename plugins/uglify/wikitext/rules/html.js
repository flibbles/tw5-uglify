/*\

Uglify rule for \whitespace trim.

\*/

var utils = require("../utils.js");
var htmlModifiers = $tw.modules.applyMethods('uglifyhtmlwikitextrule');

exports.name = "html";

exports.uglify = function() {
	var startOfBody = this.parser.startOfBody;
	this.parser.startOfBody = false;
	var tag = this.parse()[0],
		oldTag;
	while (oldTag !== tag.tag && htmlModifiers[tag.tag]) {
		// We keep running these htmlModifiers until the tag stops changing
		oldTag = tag.tag;
		// Before we get started,  we give a chance for all
		// the custom rules to make modifications to it.
		htmlModifiers[tag.tag](tag, this.parser);
	}
	var tagParts = ["<", tag.tag];
	if (tag.tag[0] !== "$" || optimizeAttrWhitelist[tag.type]) {
		// It it's a whitelisted widget or an html element, we can move
		// the attributes around to optimize packing.
		utils.optimizeAttributeOrdering(tag.orderedAttributes, this.parser);
	}
	var attributes = tag.orderedAttributes || tag.attributes;
	var parser = this.parser;
	var tree = [{}];
	var needsSpace = true;
	$tw.utils.each(attributes, function(attr) {
		if (needsSpace) {
			tagParts.push(" ");
			needsSpace = false;
		}
		tagParts.push(attr.name);
		switch(attr.type) {
		case "string":
			if (attr.value !== "true") {
				var value = utils.bestQuoteForAttribute(attr, parser);
				if (value === attr.value) {
					needsSpace = true;
				}
				tagParts.push("=", value);
			} else {
				needsSpace = true;
			}
			break;
		case "indirect":
			tagParts.push("={{", attr.textReference, "}}");
			break;
		case "macro":
			if (utils.isCurrentTiddlerAttr(attr)) {
				tagParts.push("={{!!title}}");
			} else {
				tagParts.push("=<<", utils.stringifyMacro(attr.value, parser.source, parser),">>");
			}
			break;
		case "filtered":
			tagParts.push("={{{", utils.uglifyFilter(attr.filter,parser),"}}}");
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
			// This is tricky. if it's a block, its end is either two
			// newlines, or a single newline at EOF. We want to claim those
			// two newlines, but we set the trailing junk to 1, because if
			// this ends up at EOF, we want to chomp one of those newlines.
			tagParts.push("\n");
			tree.push({text: "\n", tail: true});
			// No matter the situation, we need to preserve that newline
			this.parser.pos+=2;
			if (this.parser.pos > this.parser.sourceLength) {
				// We want to jump past those newlines, but not past EOF
				this.parser.pos = this.parser.sourceLength;
			}
		} else if (utils.newlineAt(this.parser.source, tag.end)
		&& startOfBlock(this.parser.source, tag.start, startOfBody)) {
			// Let's eat that newline
			this.parser.pos+=utils.newlineAt(this.parser.source, this.parser.pos);
			if (!this.parser.configTrimWhiteSpace) {
				// This is a special use case. An inline <closing-tag/> with a
				// newline following it can only exist if it's followed by
				// something. So we can't allow the EOF to occur here.
				tagParts.push("\n");
				tree[0].cannotBeAtEnd = true;
			}
			tree[0].cannotEndBlock = true;
		}
	} else {
		tagParts.push(">");
		if (tag.isBlock) {
			tagParts.push('\n\n');
		} else {
		}
		var tail = {text: "</" + tag.tag + ">"}
		if (tag.isBlock || tag.children.length !== 1 || tag.children[0].text !== "\n") {
			// That closing tag is potentially trailing junk. Add its length.
			tail.tail = true;
		}
		if (tag.children.length >= 1 && tag.children[0].text === "\n") {
			// This is "<$tag>\n...</$tag>". That newline can't become the end.
			tag.children[0].cannotBeAtEnd = true;
		}
		// Funny thing about widgets is that block eval starts right after
		// them. No newlines needed.
		if (startOfBlock(this.parser.source, tag.start, startOfBody)
		&& tag.isBlock) {
			this.parser.skipWhitespace();
		}
		// We record the start of the tag in the tail so that enclosing
		// widgets can match this tail with the correct head.
		tail.start = tag.start;
		tree = tree.concat(tag.children, tail);
	}
	tree[0].text = tagParts.join('');
	tree[0].tag = tag;
	return tree;
};

function startOfBlock(source, pos, startOfBody) {
	if (startOfBody || pos === 0 ) {
		return true; //start of stream
	}
	if (source[pos-1] !== "\n") {
		return false; // Not start of line
	}
	// Ensure previous line is blank
	return (source[pos-2] === "\n"
		|| (source[pos-2] === "\r" && source[pos-3] === "\n"));
};

// These are the widgets which are okay to shuffle the attributes around for.
var optimizeAttrWhitelist = {
"action-createtiddler": true,
"action-deletefield": true,
"action-deletetiddler": true,
"action-listops": true,
"action-log": true,
"action-navigate": true,
"action-popup": true,
"action-sendmessage": true,
"action-setfield": true,
"action-setmultiplefields": true,
browse: true,
button: true,
checkbox: true,
codeblock: true,
count: true,
"diff-text": true,
draggable: true,
droppable: true,
dropzone: true,
edit: true,
"edit-binary": true,
"edit-bitmap": true,
"edit-shortcut": true,
"edit-text": true,
element: true,
encrypt: true,
entity: true,
eventcatcher: true,
fieldmangler: true,
fields: true,
image: true,
importvariables: true,
jsontiddler: true,
keyboard: true,
link: true,
linkcatcher: true,
list: true,
listitem: true,
macrocall: true,
messagecatcher: true,
navigator: true,
password: true,
qualify: true,
radio: true,
railroad: true,
range: true,
raw: true,
reveal: true,
scrollable: true,
select: true,
set: true,
setmultiplevariables: true,
setvariable: true,
text: true,
tiddler: true,
transclude: true,
vars: true,
view: true,
widget: true,
wikify: true
};
