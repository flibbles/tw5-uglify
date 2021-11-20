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
	var tiddler = this.wiki.getTiddler(title);
	if (!tiddler) {
		return '';
	}
	var ugly = this.wiki.getTiddlerUglifiedText(title);
	$tw.wiki.addTiddler({title: "$:/temp/flibbles/uglify-demo/"+title, text: ugly}, tiddler);
	return ugly;
};
