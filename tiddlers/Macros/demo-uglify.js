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

exports.run = function(tiddler) {
	var compressedCode = this.wiki.getTiddlerUglifiedText(tiddler);
	var strCode = $tw.utils.stringify(compressedCode);
	return '<$codeblock language="application/javascript" code="""'+compressedCode+'""" />'
};
