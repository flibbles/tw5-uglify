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

exports.uglify = function(text, options) {
	var parser = new WikiWalker(undefined, text, options);
	return {text: parseutils.joinNodeArray(parser.tree)};
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
	if (text.indexOf("'") >= 0) {
		this.apostrophesAllowed = true;
	}
	if (text.indexOf("]") >= 0) {
		this.bracketsAllowed = true;
	}
	this.placeholders = options.placeholders;
	this.startOfBody = true;
	WikiParser.call(this, type, text, options);
	postProcess.call(this);
};

WikiWalker.prototype = Object.create(WikiParser.prototype);

WikiWalker.prototype.setupUglifyRules = function() {
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
};

WikiWalker.prototype.parsePragmas = function() {
	var strings = this.tree;
	var pragmaFound = false;
	var whitespace;
	// The reason we set up rules here instead of in the constructor where it
	// would make sense: We have to set up uglify rules AFTER the WikiParser
	// constructor finishes setting up ITS rules, but BEFORE it starts
	// doing any parsing.
	// This ugliness would go away if the WikiParser broke its rule setup
	// into its own method, or... you know... DIDN'T DO ITS ENTIRE JOB IN
	// ITS OWN CONSTRUCTOR.
	this.setupUglifyRules();
	while (true) {
		if (this.pos > 0 && this.source[this.pos-1] !== "\n") {
			// Some pragma aren't good about eating to the end of their line.
			// We need to put in a newline if we accidentally ate it.
			strings.push({text: '\n', tail: true});
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
		if (output.indexOf(minimum) >= 0) {
			tree.push({text: minimum, type: 'text', tail: true});
		} else {
			tree.push({text: output, type: 'text', tail: true});
		}
	}
};

// This doesn't actually produce a text widget anymore. It just produces
// a parseTreeNode-like objects containing text.
WikiWalker.prototype.pushTextWidget = function(array, text, start, end) {
	var original = text;
	var node = {type: "text", start: start, end: end};
	var cannotEndYet = false,
		cannotEndBlock = false;
	// Reset these
	if (this.placeholders && this.placeholders.present(text)) {
		this.cannotEnsureNoWhiteSpace = true;
		// Dangerous, meaning be careful about altering surrounding content.
		node.dangerous = true;
		// We turn these on, because we can't be sure how this
		// placeholder will be effected if the content that
		// comes after this text is removed.
		node.cannotBeAtEnd = true;
		node.cannotEndBlock = true;
	} else if(this.configTrimWhiteSpace) {
		text = $tw.utils.trim(text);
	}
	if (original !== text && this.insideUnknownRule) {
		this.cannotEnsureNoWhiteSpace = true;
	}
	// This block below is for the special edge case where a block of
	// wikitext might be wrapped with """. We can't let those end with ".
	if (text[text.length-1] === '"') {
		if (end === this.sourceLength) {
			if (original[original.length-1] !== '"') {
				if (this.cannotEnsureNoWhiteSpace) {
					// Whitespace won't fully trim anyway, so we can add
					// a space back in. This'll resolve """" conflicts.
					text = text + " ";
				} else {
					// We can ensure whitespace trimming so far, so let's
					// just use an entity.
					text = text.substr(0, text.length-1) + "&quot;";
				}
			}
		} else {
			node.cannotBeAtEnd = true;
		}
	}
	text = text.replace(/\r/mg,"");
	if (text) {
		node.text = text;
		array.push(node);
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

WikiWalker.prototype.amendRules = function(type, names) {
	WikiParser.prototype.amendRules.call(this, type, names);
	var list;
	if(type === "only") {
		list = "whitelist";
	} else if(type === "except") {
		list = "blacklist";
	} else {
		return;
	}
	this[list] = this[list] || Object.create(null);
	for (var i = 0; i < names.length; i++) {
		this[list][names[i]] = true;
	}
};

WikiWalker.prototype.ruleAllowed = function(name) {
	return (!this.whitelist || this.whitelist[name]) && (!this.blacklist || !this.blacklist[name]);
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
		if (!this.tree[i].tail && !this.tree[i].junk) {
			break;
		}
		if (this.tree[i-1] && this.tree[i-1].cannotBeAtEnd) {
			i--;
			break;
		}
		this.tree.pop();
	}
	// Now we get rid of all the junk in the middle
	for (; i >= 0; i--) {
		if (this.tree[i].junk
		&& (!this.tree[i+1] || !this.tree[i+1].dangerous)) {
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
