/*\
title: $:/plugins/flibbles/uglify/wikitext/placeholderList.js
module-type: library
type: application/javascript

Placeholder list for managing and detecting macrodef placeholders.

\*/

module.exports = function(parentList) {
	this.placeholders = Object.create(parentList ? parentList.placeholders : null);
};

var proto = module.exports.prototype;

proto.add = function(key) {
	this.placeholders[key] = true;
};

proto.present = function(text) {
	if (this.placeholderRegExp === undefined) {
		var placeholderArray = [];
		for (var placeholder in this.placeholders) {
			placeholderArray.push($tw.utils.escapeRegExp(placeholder));
		}
		placeholderArray.push("\\([^\\)\\$]+\\)");
		this.placeholderRegExp = new RegExp("\\$(?:" + placeholderArray.join('|') + ")\\$");
	}
	var match = text.match(this.placeholderRegExp);
	return match? match[0] : null;
};
