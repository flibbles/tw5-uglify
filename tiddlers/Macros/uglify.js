/*\
title: Macros/uglify.js
type: application/javascript
module-type: macro

This is used to help demonstrate uglified code of various other tiddlers.

\*/

'use strict';

exports.name = 'uglify';

exports.params = [
	{name: 'tiddler'}
];

exports.run = function(title) {
	if (!title) {
		title = this.getVariable("currentTiddler");
	}
	var wiki = this.wiki;
	var tiddler = this.wiki.getTiddler(title);
	if (!tiddler) {
		return '';
	}
	return wiki.getTiddlerUglifiedText(title);
};
