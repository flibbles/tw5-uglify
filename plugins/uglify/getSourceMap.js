/*\
title: $:/plugins/flibbles/uglify/getSourceMap.js
type: application/javascript
module-type: route

GET /uglify/maps/:title

\*/
(function() {

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var logger = require('./logger.js');

exports.method = "GET";

exports.path = /^\/uglify\/(map|original)\/(.+)$/;

exports.handler = function(request,response,state) {
	var title = $tw.utils.decodeURIComponentSafe(state.params[1]),
		option = state.params[0];
	if (option === "original") {
		var tiddler = state.wiki.getTiddler(title);
		if (tiddler) {
			logger.log('Returning original source for:', title);
			var text = tiddler.fields.text;
			//text = "(function(module,exports,console,setInterval,clearInterval,setTimeout,clearTimeout,Buffer,$tw,require) {(function(){\n" + text + "\n;})();\nreturn exports;\n})\n";
			state.sendResponse(200,{"Content-Type": "application/javascript"},text,"utf8");
		} else {
			logger.alert('No original source for:', title);
			response.writeHead(404);
			response.end();
		}
		return;
	}
	var map = state.wiki.getTiddlerSourceMap(title);
	if(map) {
		map.sourceRoot = "/uglify/original/";
		map = JSON.stringify(map);
		logger.log('Returning source map for:', title, map);
		state.sendResponse(200,{"Content-Type": "application/json"},map,"utf8");
	} else {
		logger.alert('No source map for:', title);
		response.writeHead(404);
		response.end();
	}
};

}());
