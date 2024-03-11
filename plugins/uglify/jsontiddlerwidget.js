/*\
title: $:/plugins/flibbles/uglify/jsontiddlerwidget.js
module-type: widget-subclass
type: application/javascript

A variation of the V5.2.* <$jsontiddler> which allows for uglifying to happen.

\*/

'use strict';

var Widget = require('$:/core/modules/widgets/widget.js').widget;
var utils = require('./utils.js');

if (Widget.prototype.widgetClasses.jsontiddler) {
	// Only extend the class if it exists
	exports.baseClass = 'jsontiddler';
}

exports.constructor = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

exports.prototype = {};

exports.prototype.getTiddlerFields = function() {
	var fields = {};
	if(this.attTiddler) {
		var tiddler = this.wiki.getTiddler(this.attTiddler);
		if(tiddler) {
			fields = tiddler.getFieldStrings({exclude: this.attExclude.split(" ")});
			if (fields.text && utils.shouldCompress(this.wiki,this.attTiddler)) {
				fields.text = this.wiki.getTiddlerUglifiedText(this.attTiddler);
			}
		}
	}
	return fields;
};
