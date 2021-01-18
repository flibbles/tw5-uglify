/*\
title: Macros/demo-uglify.js
type: application/javascript
module-type: macro

This is used to help demonstrate uglified code of various other tiddlers.

\*/

'use strict';

exports.name = 'demo-uglify';

exports.params = [
	{name: 'tiddler'}
];

exports.run = function(title) {
	var tiddler = this.wiki.getTiddler(title);
	if (!tiddler) {
		return '';
	}
	var compressedCode = this.wiki.getTiddlerUglifiedText(title);
	var type = tiddler.fields.type;
	return '<$codeblock language="'+type+'" code="""'+compressedCode+'""" />'
};
