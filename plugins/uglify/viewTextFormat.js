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

var systemTargets = {"$:/boot/boot.js": true, "$:/boot/bootprefix.js": true};

formats.text = exports.text = function(widget, mode, template) {
	if (compressJSSetting(widget.wiki) && widget.viewField === "text") {
		if (systemTargets[widget.viewTitle]) {
			return widget.wiki.getCacheForTiddler(widget.viewTitle, "uglify", function() {
				return compressor.compress({title: widget.viewTitle, text: oldText(widget, mode, template)});
			});
		}
		var pluginInfo = widget.wiki.getPluginInfo(widget.viewTitle);
		if (pluginInfo) {
			return widget.wiki.getCacheForTiddler(widget.viewTitle, "uglify", function() {
				var newInfo = $tw.utils.extend({}, pluginInfo);
				if (widget.viewTitle === "$:/plugins/flibbles/uglify") {
					var config = stubPluginSetting(widget.wiki);
					if (config === 'no') {
						newInfo.tiddlers = compressTiddlers(pluginInfo);
					} else if (config !== 'pretty') {
						newInfo.tiddlers = pluginStubTiddlers(pluginInfo);
					} //else 'pretty', or pass it through uncompressed
				} else {
					newInfo.tiddlers = compressTiddlers(pluginInfo);
				}
				return JSON.stringify(newInfo, null);
			});
		}
	}
	return oldText(widget, mode, template);
};

function stubPluginSetting(wiki) {
	var config = wiki.getTiddler("$:/config/flibbles/uglify/stub");
	return (config && config.fields.text) || 'yes';
};

function compressJSSetting(wiki) {
	var config = wiki.getTiddler("$:/config/flibbles/uglify/javascript");
	return !config || (config.fields.text === 'yes');
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
		var fields = pluginInfo.tiddlers[title];
		if (fields.type === "application/javascript") {
			fields = $tw.utils.extend({}, fields);
			fields.text = compressor.compress(fields);
		}
		newTiddlers[title] = fields;
	}
	return newTiddlers;
};
