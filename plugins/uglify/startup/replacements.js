/*\
title: $:/plugins/flibbles/uglify/startup/replacements.js
module-type: startup
type: application/javascript

Replaces various macros and methods in $tw.

\*/

'use strict';

var utils = require('../utils.js');

exports.name = 'uglify_replacements';
exports.synchronous = true;
// Before commands, or else the server hook may get called before this does.
exports.after = ['load-modules'];

exports.startup = function() {
	$tw.Wiki.prototype.getTiddlersAsJson = getTiddlersAsJson;
};

function getTiddlersAsJson(filter, spaces) {
	var tiddlers = this.filterTiddlers(filter),
		spaces = (spaces === undefined) ? $tw.config.preferences.jsonSpaces : spaces,
		data = [];
	for(var t=0;t<tiddlers.length; t++) {
		var tiddler = this.getTiddler(tiddlers[t]);
		if(tiddler) {
			var fields = new Object();
			for(var field in tiddler.fields) {
				if (field === "text" && utils.shouldCompress(this, tiddlers[t])) {
					fields.text = this.getTiddlerUglifiedText(tiddlers[t]);
				} else {
		
					fields[field] = tiddler.getFieldString(field);
				}
			}
			data.push(fields);
		}
	}
	return JSON.stringify(data,null,spaces);
};
