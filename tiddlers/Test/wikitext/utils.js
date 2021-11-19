/*\
title: Test/wikitext/utils.js
type: application/javascript
tags: $:/tags/test-spec
list-before: 

Utils for the wikitext uglifying.

\*/

const parseUtils = require("$:/plugins/flibbles/uglify/wikitext/utils.js");

const wikitextType = "text/vnd.tiddlywiki";

exports.uglify = function(text) {
	return $tw.wiki.getUglifier(wikitextType).uglify(text, 'test', {wiki: $tw.wiki});
};

exports.test = function(text, expected, options) {
	var out = exports.uglify(text);
	if (expected) {
		expect(out).toBe(expected);
	}
	var options = options || {variables: {currentTiddler: 'test'}};
	var prettyHtml = $tw.wiki.renderText("text/html", wikitextType, text, options);
	var uglyHtml = $tw.wiki.renderText("text/html", wikitextType, out, options);
	expect(uglyHtml).toBe(prettyHtml);

	return uglyHtml === prettyHtml;
};

exports.cmp = function(a, b) {
	var options = {variables: {currentTiddler: 'test'}};
	var aHtml = $tw.wiki.renderText("text/html", wikitextType, a, options);
	var bHtml = $tw.wiki.renderText("text/html", wikitextType, b, options);
	expect(aHtml).toBe(bHtml);
};

exports.ifLetIt = function(description, fn) {
	if (parseUtils.letAvailable()) {
		return it(description, fn);
	} else {
		return xit("<$LET> unavailable: " + description);
	}
};

$tw.utils.test = $tw.utils.test || {};
$tw.utils.test.wikitext = Object.create(null);

for (var member in exports) {
	$tw.utils.test.wikitext[member] = exports[member];
}
