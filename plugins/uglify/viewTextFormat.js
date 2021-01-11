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
				var config = stubPlugin(widget.wiki);
				if (config === 'no') {
					newInfo.tiddlers = compressTiddlers(pluginInfo);
				} else if (config !== 'pretty') {
					newInfo.tiddlers = pluginStubTiddlers(pluginInfo);
				} //else 'pretty', or pass it through uncompressed
			} else {
				newInfo.tiddlers = compressTiddlers(pluginInfo);
			}
			return JSON.stringify(newInfo, null, '\t');
		});
	}
	return oldText(widget, mode, template);
};

function stubPlugin(wiki) {
	var config = wiki.getTiddler("$:/config/flibbles/uglify/stub");
	return (config && config.fields.text) || 'yes';
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

function compressTiddlers(pluginInfo) {
	var newTiddlers = Object.create(null);
	for (var title in pluginInfo.tiddlers) {
		var tiddler = pluginInfo.tiddlers[title];
		if (tiddler.type === "application/javascript") {
			tiddler = $tw.utils.extend({}, tiddler);
			//tiddler.text = compressor.compress(tiddler.text);
		}
		newTiddlers[title] = tiddler;
	}
	return newTiddlers;
};
