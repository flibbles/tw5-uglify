/*\
title: $:/plugins/flibbles/uglify/wikitext.js
module-type: uglifier
type: application/javascript

Uglifies wikitext
\*/

exports.type = "text/vnd.tiddlywiki";

var WikiParser = require("$:/core/modules/parsers/wikiparser/wikiparser.js")[exports.type];
var logger = require('./logger.js');

exports.uglify = function(text, title) {
	try {
		var options = {}
		var parser = new WikiWalker(undefined, text, options);
		var stringArray = [];
		$tw.utils.each(parser.tree, function(node) {
			if (node.text) {
				stringArray.push(node.text);
			}
		});
		return stringArray.join('');
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
	this.options = options;
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
	WikiParser.call(this, type, text, options);
};

WikiWalker.prototype = Object.create(WikiParser.prototype);

WikiWalker.prototype.parsePragmas = function() {
	var entries = this.tree;
	while (true) {
		entries.push(this.preserveWhitespace());
		if (this.pos >= this.sourceLength) {
			break;
		}
		var nextMatch = this.findNextMatch(this.pragmaRules, this.pos);
		if (!nextMatch || nextMatch.matchIndex !== this.pos) {
			break;
		}
		entries.push.apply(entries, this.handleRule(nextMatch));
	}
	return entries;
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
	strings.push(this.preserveWhitespace());
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

WikiWalker.prototype.amendRules = function(type, names) {
	var only;
	WikiParser.prototype.amendRules.call(this, type, names);
	/*
	if (type === "only") {
		only = true;
	} else if (type === "except") {
		only = false;
	} else {
		return;
	}
	if (only !== (names.indexOf("macrodef") >= 0) && this.options.macrodefCanBeDisabled) {
		this.options.placeholder = undefined
	}
	if (only !== (names.indexOf("html") >= 0)) {
		this.context.allowWidgets = disabled;
	}
	if (only !== (names.indexOf("prettylink") >= 0)) {
		this.context.allowPrettylinks = disabled;
	}
	*/
};

WikiWalker.prototype.preserveWhitespace = function(options) {
	options = options || {};
	var output = '';
	var whitespaceRegExp = options.treatNewlinesAsNonWhitespace ? /([^\S\n]+)/mg : /(\s+)/mg;
	whitespaceRegExp.lastIndex = this.pos;
	var whitespaceMatch = whitespaceRegExp.exec(this.source);
	if(whitespaceMatch && whitespaceMatch.index === this.pos) {
		output = this.source.substring(this.pos, whitespaceRegExp.lastIndex);
		this.pos = whitespaceRegExp.lastIndex;
	}
	return {text: output};
};

// This doesn't actually produce a text widget anymore. It just produces
// a parseTreeNode-like objects containing text.
WikiWalker.prototype.pushTextWidget = function(tree,substring) {
	if (substring) {
		tree.push({text: substring});
	}
};

WikiWalker.prototype.handleRule = function(ruleInfo) {
	if (ruleInfo.rule.uglify) {
		var start = ruleInfo.matchIndex;
		var newEntry = ruleInfo.rule.relink(this.source, this.fromTitle, this.toTitle, this.options);
		if (newEntry !== undefined) {
			if (newEntry.output) {
				newEntry.start = start;
				newEntry.end = this.pos;
			}
			return [newEntry];
		}
	} else {
		var start = this.pos;
		// We parse the rule and look to where it moved the head.
		// Then we can copy this unknown rule without change
		ruleInfo.rule.parse();
		var substring = this.source.substring(start, this.pos);
		return [{text: substring}];
	}
	return [];
};

