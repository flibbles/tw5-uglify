/*\
title: $:/plugins/flibbles/uglify/viewWidgetText.js
module-type: viewwidgetformat
type: application/javascript

Introduces jsuglified view format for whoever wants it. It will probably be
alterned in the future to better handle non-text fields and such.
\*/

/*jslint node: true, browser: true */
/*global $tw: false */
'use strict';

// Technically, this is a bad view format. It ignores text and grabs the tiddler
// That means it can only be a first format, and it can't grab anything but text.
// I will probably fix this post-V1
exports.jsuglified = function(text, widget) {
	return widget.wiki.getTiddlerUglifiedText(widget.viewTitle);
};
