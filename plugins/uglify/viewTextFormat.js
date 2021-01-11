/*\
title: $:/plugins/flibbles/uglify/viewWidgetText
module-type: viewwidgetformat
type: application/javascript

\*/

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var formats = require("$:/core/modules/widgets/view/formats.js");
var compressor = require("./javascript/uglify.js");

var oldText = formats.text;

formats.text = exports.text = function(widget, mode, template) {
	var pluginInfo = widget.wiki.getPluginInfo(widget.viewTitle);
	if (pluginInfo && widget.viewField === "text") {
		return widget.wiki.getCacheForTiddler(widget.viewTitle, "uglify", function() {
			var newInfo = $tw.utils.extend({}, pluginInfo);
			if (widget.viewTitle === "$:/plugins/flibbles/uglify") {
				newInfo.tiddlers = pluginStubTiddlers(pluginInfo);
			} else {
				var newTiddlers = Object.create(null);
				for (var title in pluginInfo.tiddlers) {
					var tiddler = pluginInfo.tiddlers[title];
					if (tiddler.type === "application/javascript") {
						tiddler = $tw.utils.extend({}, tiddler);
						//tiddler.text = compressor.compress(tiddler.text);
					}
					newTiddlers[title] = tiddler;
				}
				newInfo = $tw.utils.extend({}, pluginInfo);
				newInfo.tiddlers = newTiddlers;
			}
			return JSON.stringify(newInfo, null, '\t');
		});
	}
	return oldText(widget, mode, template);
};

function pluginStubTiddlers(pluginInfo) {
	var tiddlers = Object.create(null);
	$tw.utils.each(pluginInfo.tiddlers, function(fields, title) {
		var tags = $tw.utils.parseStringArray(fields.tags);
		if (tags && tags.indexOf("$:/tags/flibbles/uglify/Stub") >= 0) {
			tiddlers[title] = fields;
		}
	});
	return tiddlers;
};
