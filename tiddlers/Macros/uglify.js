/*\
title: Macros/uglify.js
type: application/javascript
module-type: macro

This is used to help demonstrate uglified code of various other tiddlers.

\*/

'use strict';

exports.name = 'uglify';

exports.params = [
	{name: 'tiddler'},
	{name: 'text'}
];

exports.run = function(title, text) {
	var wiki = this.wiki;
	if (text) {
		return uglify(text, wiki);
	}
	if (!title) {
		title = this.getVariable("currentTiddler");
	}
	var tiddler = wiki.getTiddler(title);
	if (!tiddler) {
		return '';
	}
	return wiki.getTiddlerUglifiedText(title);
};

function uglify(text, wiki) {
	return wiki.getUglifier("text/vnd.tiddlywiki").uglify(text, 'test', {wiki: wiki});
};
