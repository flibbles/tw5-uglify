/*\
title: $:/plugins/flibbles/uglify/route.js
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

exports.path = /^\/\$:\/(.+?)(.map)?$/;

exports.handler = function(request,response,state) {
	// We can do this, because we're sure that only system tiddlers will
	// ever be called for. It's a deliberate limitation of uglify
	var title = "$:/" + $tw.utils.decodeURIComponentSafe(state.params[0]);
	var contentType;
	var content;
	if (state.params[1]) { // ".map"
		// This is a sourcemap request
		contentType = "application/json";
		content = state.wiki.getTiddlerSourceMap(title);
		//map.sourceRoot = (title.substr(0, 3) !== "$:/")? "/uglify/source/": "/";
		content = JSON.stringify(content);
	} else {
		// This is a sourcefile request
		contentType = "application/javascript";
		content = state.wiki.getTiddlerText(title);
	}
	if (content !== undefined) {
		state.sendResponse(200,{"Content-Type": contentType},content,"utf8");
	} else {
		var msg = state.params[1]? 'No source map for:': 'No original source for:';
		logger.alert(msg, title);
		response.writeHead(404);
		response.end();
	}
};

}());
