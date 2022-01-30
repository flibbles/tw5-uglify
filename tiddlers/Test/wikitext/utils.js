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
	return $tw.wiki.getUglifier(wikitextType).uglify(text, {wiki: $tw.wiki});
};

exports.test = function(text, expected, options) {
	var out = exports.uglify(text);
	if (expected) {
		expect(out).toBe(expected);
	}
	var options = options || {};
	options.variables = {currentTiddler: 'test'};
	const wiki = options.wiki || $tw.wiki;
	var prettyHtml = wiki.renderText("text/html", wikitextType, text, options);
	var uglyHtml = wiki.renderText("text/html", wikitextType, out, options);
	expect(uglyHtml).toBe(prettyHtml);

	return uglyHtml === prettyHtml;
};

exports.cmp = function(a, b, options) {
	var options = options || {};
	options.variables = {currentTiddler: 'test'};
	const wiki = options.wiki || $tw.wiki;
	var aHtml = wiki.renderText("text/html", wikitextType, a, options);
	var bHtml = wiki.renderText("text/html", wikitextType, b, options);
	console.log(aHtml)
	console.log(bHtml)
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
