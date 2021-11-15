/*\
title: $:/plugins/flibbles/uglify/wikitext.js
module-type: uglifier
type: application/javascript

Uglifies wikitext
\*/

exports.type = "text/vnd.tiddlywiki";

var WikiParser = require("$:/core/modules/parsers/wikiparser/wikiparser.js")[exports.type];
var logger = require('./logger.js');
var parseutils = require('./wikitext/utils.js');

exports.uglify = function(text, title, options) {
	try {
		var parser = new WikiWalker(undefined, text, options);
		return parseutils.joinNodeArray(parser.tree);
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
					$tw.utils.extend(classList[name].prototype, rules[name]);
				}
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
	WikiParser.call(this, type, text, options);
};

WikiWalker.prototype = Object.create(WikiParser.prototype);

WikiWalker.prototype.parsePragmas = function() {
	var strings = this.tree;
	while (true) {
		this.preserveWhitespace(strings);
		if (this.pos >= this.sourceLength) {
			break;
		}
		var nextMatch = this.findNextMatch(this.pragmaRules, this.pos);
		if (!nextMatch || nextMatch.matchIndex !== this.pos) {
			break;
		}
		strings.push.apply(strings, this.handleRule(nextMatch));
	}
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
		this.preserveWhitespace(strings);
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
	while (this.pos < this.sourceLength && nextMatch) {
		if (nextMatch.matchIndex > this.pos) {
			this.pushTextWidget(strings,this.source.substring(this.pos,nextMatch.matchIndex));
			this.pos = nextMatch.matchIndex;
		}
		strings.push.apply(strings, this.handleRule(nextMatch));
		nextMatch = this.findNextMatch(this.inlineRules, this.pos);
	}
	if(this.pos < this.sourceLength) {
		this.pushTextWidget(strings, this.source.substr(this.pos));
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
					this.pushTextWidget(strings, this.source.substring(this.pos,terminatorMatch.index));
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
				this.pushTextWidget(strings, this.source.substring(this.pos,inlineRuleMatch.matchIndex));
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
		this.pushTextWidget(strings, this.source.substr(this.pos));
	}
	this.pos = this.sourceLength;
	return strings;

};

WikiWalker.prototype.parseBlock = function(terminatorRegExpString) {
	var terminatorRegExp = terminatorRegExpString ? new RegExp("(" + terminatorRegExpString + "|\\r?\\n\\r?\\n)","mg") : /(\r?\n\r?\n)/mg;
	var strings = [];
	this.preserveWhitespace(strings);
	if (this.pos >= this.sourceLength) {
		return strings;
	}
	var nextMatch = this.findNextMatch(this.blockRules, this.pos);
	if(nextMatch && nextMatch.matchIndex === this.pos) {
		strings.push.apply(strings, this.handleRule(nextMatch));
	} else {
		strings.push.apply(strings, this.parseInlineRun(terminatorRegExp));
	}
	return strings;
};

WikiWalker.prototype.preserveWhitespace = function(tree, options) {
	options = options || {};
	var output = '';
	var whitespaceRegExp = options.treatNewlinesAsNonWhitespace ? /([^\S\n]+)/mg : /(\s+)/mg;
	whitespaceRegExp.lastIndex = this.pos;
	var whitespaceMatch = whitespaceRegExp.exec(this.source);
	if(whitespaceMatch && whitespaceMatch.index === this.pos) {
		output = this.source.substring(this.pos, whitespaceRegExp.lastIndex);
		this.pos = whitespaceRegExp.lastIndex;
	}
	if (output) {
		tree.push({text: output});
	}
};

// This doesn't actually produce a text widget anymore. It just produces
// a parseTreeNode-like objects containing text.
WikiWalker.prototype.pushTextWidget = function(tree,substring) {
	if (substring) {
		tree.push({text: substring});
	}
};

WikiWalker.prototype.handleRule = function(ruleInfo) {
	var substring;
	if (ruleInfo.rule.uglify) {
		substring = ruleInfo.rule.uglify(this.source);
	} else {
		var start = this.pos;
		// We parse the rule and look to where it moved the head.
		// Then we can copy this unknown rule without change
		ruleInfo.rule.parse();
		substring = this.source.substring(start, this.pos);
	}
	if (substring) {
		return [{text: substring}];
	} else {
		return [];
	}
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
