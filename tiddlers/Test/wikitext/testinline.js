/*\
title: Test/wkitext/testinline.js
type: application/javascript
module-type: wikirule

Fake rule for testing unknown rules containing blocks in wikitext.

```
?test?class? Content?test?
```

\*/

exports.name = "testinline";
exports.types = {inline: true};

exports.init = function(parser) {
	this.parser = parser;
	// Regexp to match
	this.matchRegExp = /\?test\?([^\r\n\s?]+)\?/mg;
};

exports.parse = function() {
	var reEnd = /\?test\?/g;
	var theClass = this.match[1];
	this.parser.pos = this.matchRegExp.lastIndex;
	// Parse the run up to the terminator
	var tree = this.parser.parseInlineRun(reEnd,{eatTerminator: true});
	// Return the classed span
	return [{
		type: "element",
		tag: "span",
		attributes: {
			"class": {type: "string", value: theClass}
		},
		children: tree
	}];
};
