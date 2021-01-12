/*\
title: $:/plugins/flibbles/uglify/viewWidgetText
module-type: viewwidgetformat
type: application/javascript

\*/

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var formats = require("$:/core/modules/widgets/view/formats.js");

var oldText = formats.text;
var systemTargets = {"$:/boot/boot.js": true, "$:/boot/bootprefix.js": true};

formats.text = exports.text = function(widget) {
	if (widget.wiki.compressionEnabled() && widget.viewField === "text") {
		if (systemTargets[widget.viewTitle] || widget.wiki.getPluginInfo(widget.viewTitle)) {
			return widget.wiki.getTiddlerCompressedText(widget.viewTitle);
		}
	}
	return oldText.call(this, widget);
};
