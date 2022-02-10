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

exports.path = /^\/uglify\/map\/(.+)$/;

exports.handler = function(request,response,state) {
	var title = $tw.utils.decodeURIComponentSafe(state.params[0]);
	var map = state.wiki.getTiddlerSourceMap(title);
	if(map) {
		map.sourceRoot = (title.substr(0, 3) !== "$:/")? "/uglify/source/": "/";
		map = JSON.stringify(map);
		state.sendResponse(200,{"Content-Type": "application/json"},map,"utf8");
	} else {
		logger.alert('No source map for:', title);
		response.writeHead(404);
		response.end();
	}
};

}());
