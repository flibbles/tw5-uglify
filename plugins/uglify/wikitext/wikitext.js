/*\
title: $:/plugins/flibbles/uglify/wikitext/wikitext.js
module-type: uglifier
type: application/javascript

Uglifies wikitext
\*/

exports.type = "text/vnd.tiddlywiki";

var WikiParser = require("$:/core/modules/parsers/wikiparser/wikiparser.js")[exports.type];
var logger = require('../logger.js');
var parseutils = require('./utils.js');

exports.uglify = function(text, title, options) {
	try {
		var parser = new WikiWalker(undefined, text, options);
		var string = parseutils.joinNodeArray(parser.tree);
		return string;
	} catch (e) {
		logger.warn('Failed to compress', title + "\n\n    * message:", e);
		return text;
	}
};

function collectRules() {
	var rules = Object.create(null);
	$tw.modules.forEachModuleOfType("uglifywikitextrule", function(title, exports) {
		var names = exports.name;
		if (typeof names === "string") {
			names = [names];
		}
		if (names !== undefined) {
			for (var i = 0; i < names.length; i++) {
				rules[names[i]] = exports;
			}
		}
	});
	return rules;
}

function WikiWalker(type, text, options) {
	if (!this.uglifyMethodsInjected) {
		var rules = collectRules();
		$tw.utils.each([this.pragmaRuleClasses, this.blockRuleClasses, this.inlineRuleClasses], function(classList) {
			for (var name in classList) {
				if (rules[name]) {
					delete rules[name].name;
					$tw.utils.extend(classList[name].prototype, rules[name]); }
			}
		});
		WikiWalker.prototype.uglifyMethodsInjected = true;
	}
	if (text.indexOf("'") >= 0) {
		this.apostrophesAllowed = true;
	}
	if (text.indexOf("]") >= 0) {
		this.bracketsAllowed = true;
	}
	this.placeholders = options.placeholders || Object.create(null);
	this.startOfBody = true;
	WikiParser.call(this, type, text, options);
	postProcess.call(this);
};

WikiWalker.prototype = Object.create(WikiParser.prototype);

WikiWalker.prototype.parsePragmas = function() {
	var strings = this.tree;
	var pragmaFound = false;
	var whitespace;
	while (true) {
		if (this.pos > 0 && this.source[this.pos-1] !== "\n") {
			// Some pragma aren't good about eating to the end of their line.
			// We need to put in a newline if we accidentally ate it.
			strings.push({text: '\n'});
		}
		whitespace = [];
		this.preserveWhitespace(whitespace);
		if (this.pos >= this.sourceLength) {
			break;
		}
		var nextMatch = this.findNextMatch(this.pragmaRules, this.pos);
		if (!nextMatch || nextMatch.matchIndex !== this.pos) {
			break;
		}
		pragmaFound = true;
		strings.push.apply(strings, this.handleRule(nextMatch));
	}
	if (!pragmaFound) {
		// If we haven't found pragma, we need to be
		// careful that this isn't actually a plaintext
		// file, so we keep any leading whitespace.
		strings.push.apply(strings, whitespace);
	}
	this.startOfBody = true;
	return strings;
};

WikiWalker.prototype.parseBlocksTerminated = function(terminatorRegExpString) {
	var terminatorRegExp = new RegExp("(" + terminatorRegExpString + ")","mg"),
		strings = [];
	// Skip any whitespace
	this.skipWhitespace();
	//  Check if we've got the end marker
	terminatorRegExp.lastIndex = this.pos;
	var match = terminatorRegExp.exec(this.source);
	// Parse the text into blocks
	while(this.pos < this.sourceLength && !(match && match.index === this.pos)) {
		var blocks = this.parseBlock(terminatorRegExpString);
		strings.push.apply(strings,blocks);
		// Skip any whitespace
		this.preserveWhitespace(strings, "\n\n");
		//  Check if we've got the end marker
		terminatorRegExp.lastIndex = this.pos;
		match = terminatorRegExp.exec(this.source);
	}
	if(match && match.index === this.pos) {
		this.pos = match.index + match[0].length;
	}
	return strings;
};

WikiWalker.prototype.parseInlineRunUnterminated = function(options) {
	var strings = [];
	var nextMatch = this.findNextMatch(this.inlineRules, this.pos);
	this.startOfBody = false;
	while (this.pos < this.sourceLength && nextMatch) {
		if (nextMatch.matchIndex > this.pos) {
			this.pushTextWidget(strings,this.source.substring(this.pos,nextMatch.matchIndex), this.pos, nextMatch.matchIndex);
			this.pos = nextMatch.matchIndex;
		}
		strings.push.apply(strings, this.handleRule(nextMatch));
		nextMatch = this.findNextMatch(this.inlineRules, this.pos);
	}
	if(this.pos < this.sourceLength) {
		this.pushTextWidget(strings, this.source.substr(this.pos),this.pos,this.sourceLength);
	}
	this.pos = this.sourceLength;
	return strings;
};

WikiWalker.prototype.parseInlineRunTerminated = function(terminatorRegExp,options) {
	var strings = [];
	options = options || {};
	terminatorRegExp.lastIndex = this.pos;
	var terminatorMatch = terminatorRegExp.exec(this.source);
	var inlineRuleMatch = this.findNextMatch(this.inlineRules,this.pos);
	while(this.pos < this.sourceLength && (terminatorMatch || inlineRuleMatch)) {
		if (terminatorMatch) {
			if (!inlineRuleMatch || inlineRuleMatch.matchIndex >= terminatorMatch.index) {
				if(terminatorMatch.index > this.pos) {
					this.pushTextWidget(strings, this.source.substring(this.pos,terminatorMatch.index), this.pos, terminatorMatch.index);
				}
				this.pos = terminatorMatch.index;
				if (options.eatTerminator) {
					this.pos += terminatorMatch[0].length;
				}
				return strings;
			}
		}
		if (inlineRuleMatch) {
			if (inlineRuleMatch.matchIndex > this.pos) {
				this.pushTextWidget(strings, this.source.substring(this.pos,inlineRuleMatch.matchIndex), this.pos, inlineRuleMatch.matchIndex);
				this.pos = inlineRuleMatch.matchIndex;
			}
			strings.push.apply(strings, this.handleRule(inlineRuleMatch));
			inlineRuleMatch = this.findNextMatch(this.inlineRules, this.pos);
			terminatorRegExp.lastIndex = this.pos;
			terminatorMatch = terminatorRegExp.exec(this.source);
		}
	}
	// Process the remaining text
	if(this.pos < this.sourceLength) {
		this.pushTextWidget(strings, this.source.substr(this.pos), this.pos, this.sourceLength);
	}
	this.pos = this.sourceLength;
	return strings;

};

WikiWalker.prototype.parseBlock = function(terminatorRegExpString) {
	var terminatorRegExp = terminatorRegExpString ? new RegExp("(" + terminatorRegExpString + "|\\r?\\n\\r?\\n)","mg") : /(\r?\n\r?\n)/mg;
	var strings = [];
	this.preserveWhitespace(strings, "\n\n");
	if (this.pos < this.sourceLength) {
		var nextMatch = this.findNextMatch(this.blockRules, this.pos);
		if(nextMatch && nextMatch.matchIndex === this.pos) {
			strings.push.apply(strings, this.handleRule(nextMatch));
		} else {
			strings.push.apply(strings, this.parseInlineRun(terminatorRegExp));
		}
	}
	return strings;
};

WikiWalker.prototype.preserveWhitespace = function(tree, minimum, options) {
	options = options || {};
	var output = '';
	var whitespaceRegExp = options.treatNewlinesAsNonWhitespace ? /([^\S\n]+)/mg : /(\s+)/mg;
	whitespaceRegExp.lastIndex = this.pos;
	var whitespaceMatch = whitespaceRegExp.exec(this.source);
	if(whitespaceMatch && whitespaceMatch.index === this.pos) {
		output = this.source.substring(this.pos, whitespaceRegExp.lastIndex);
		this.pos = whitespaceRegExp.lastIndex;
	}
	output = output.replace(/\r/mg,"");
	if (output) {
		if (!this.configTrimWhiteSpace) {
			tree.push({text: output, junk: true});
		} else if (minimum) {
			tree.push({text: minimum, junk: true});
		}
	}
};

// This doesn't actually produce a text widget anymore. It just produces
// a parseTreeNode-like objects containing text.
WikiWalker.prototype.pushTextWidget = function(array, text, start, end) {
	var original = text;
	var cannotEndYet = false,
		cannotEndBlock = false;
	// Reset these
	if (this.containsPlaceholder(text)) {
		this.cannotEnsureNoWhiteSpace = true;
		// We turn these on, because we can't be sure how this
		// placeholder will be effected if the content that
		// comes after this text is removed.
		cannotEndYet = true;
		cannotEndBlock = true;
	} else if(this.configTrimWhiteSpace) {
		text = $tw.utils.trim(text);
	}
	if (original !== text && this.insideUnknownRule) {
		this.cannotEnsureNoWhiteSpace = true;
	}
	text = text.replace(/\r/mg,"");
	if (text) {
		array.push({
			type: "text",
			text: text,
			start: start, end: end,
			cannotBeAtEnd: cannotEndYet, cannotEndBlock: cannotEndBlock});
		// There is new text. We have to keep any earlier trailing junk
		this.startOfBody = false;
	}
};

WikiWalker.prototype.handleRule = function(ruleInfo) {
	var tree;
	if (ruleInfo.rule.uglify) {
		tree = ruleInfo.rule.uglify();
		if (typeof tree === "string") {
			tree = tree ? [{text: tree}] : [];
		}
	} else {
		var start = this.pos,
			wasInsideUnknownRule = this.insideUnknownRule;
		this.insideUnknownRule = true;
		// We parse the rule and look to where it moved the head.
		// Then we can copy this unknown rule without change
		ruleInfo.rule.parse();
		var substring = this.source.substring(start, this.pos);
		this.insideUnknownRule = wasInsideUnknownRule;
		if (substring) {
			// unknown rules aren't changed, so they must be okay at the EOF
			// since they would have already been there.
			tree = [{text: substring}];
		}
	}
	this.startOfBody = false;
	return tree;
};

WikiWalker.prototype.containsPlaceholder = function(text) {
	if (this.placeholderRegExp === undefined) {
		var placeholderArray = [];
		for (var placeholder in this.placeholders) {
			placeholderArray.push($tw.utils.escapeRegExp(placeholder));
		}
		placeholderArray.push("\\([^\\)\\$]+\\)");
		this.placeholderRegExp = new RegExp("\\$(?:" + placeholderArray.join('|') + ")\\$");
	}
	return text.search(this.placeholderRegExp) >= 0;
};

function postProcess() {
	// First, we use longform for anything if we have to keep trim around
	var i;
	if (this.configTrimWhiteSpace && this.cannotEnsureNoWhiteSpace) {
		// Looks like we still need to specify a pragma to be sure
		this.tree.unshift({text: "\\whitespace trim\n"});
		for (i = 0; i < this.tree.length; i++) {
			var node = this.tree[i];
			if (node.textWithTrim) {
				// We also need to use all the longform nodes that otherwise
				// could have collapsed if we trimmed the whitespace ourselves.
				node.text = node.textWithTrim;
			}
		}
	}
	// Now let's slice off all the trailing junk
	for (i = this.tree.length-1; i >= 0; i--) {
		if (!this.tree[i].junk && !this.tree[i].drop) {
			break;
		}
		if (this.tree[i-1].cannotBeAtEnd) {
			i--;
			break;
		}
		this.tree.pop();
	}
	// Now we get rid of all the junk in the middle
	for (; i >= 0; i--) {
		if (this.tree[i].drop) {
			if (!this.tree[i-1].cannotEndBlock || !newlineFollows(this.tree, i)) {
				this.tree.splice(i, 1);
			}
		}
	}
};

function newlineFollows(tree, i) {
	i++;
	if (i >= tree.length) {
		return false;
	}
	return tree[i].text[0] === "\n";
};
