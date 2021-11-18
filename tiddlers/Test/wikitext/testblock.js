/*\
title: Test/wkitext/testblock.js
type: application/javascript
module-type: wikirule

Fake rule for testing unknown rules containing blocks in wikitext.

```
?test?class?
$(Content)$
?test?
```

\*/

exports.name = "testblock";
exports.types = {block: true};

exports.init = function(parser) {
	this.parser = parser;
	// Regexp to match
	this.matchRegExp = /\?test\?([^\r\n\s?]+)\?\r?\n/mg;
};

exports.parse = function() {
	var reEndString = "^\\?test\\?(?:\\r?\\n)?";
	var theClass = this.match[1];
	this.parser.pos = this.matchRegExp.lastIndex;
	// Parse the body
	var tree = this.parser.parseBlocks(reEndString);
	for(var t=0; t<tree.length; t++) {
		$tw.utils.addClassToParseTreeNode(tree[t],theClass);
	}
	return tree;
};
