/*\
title: $:/plugins/flibbles/uglify/jsontiddlermacro.js
module-type: macro
type: application/javascript

A replacement for the jsontiddler macro which makes sure that the correct
tiddlers return their compressed versions.

This ends up replacing the other because it loads in after.

\*/

'use strict';

var utils = require('./utils.js');

exports.name = "jsontiddler";

exports.params = [
	{name: "title"}
];

exports.run = function(title) {
	title = title || this.getVariable("currentTiddler");
	var tiddler = !!title && this.wiki.getTiddler(title),
		fields = new Object();
	if (tiddler) {
		for (var field in tiddler.fields) {
			fields[field] = tiddler.getFieldString(field);
		}
		if (fields.text && utils.shouldCompress(this.wiki, title)) {
			fields.text = this.wiki.getTiddlerUglifiedText(title);
		}
	};
	return JSON.stringify(fields, $tw.config.preferences.jsonSpaces);
};
