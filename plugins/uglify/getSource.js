/*\
title: $:/plugins/flibbles/uglify/getSource.js
type: application/javascript
module-type: route

GET /$:/:title

\*/
(function() {

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var logger = require('./logger.js');

exports.method = "GET";

exports.path = /^\/(\$:|uglify\/source)\/(.+)$/;

exports.handler = function(request,response,state) {
	var title = $tw.utils.decodeURIComponentSafe(state.params[1]);
	if (state.params[0] === "$:") {
		// We can handle system javascript nicely like this, where its
		// URI is its title. Good thing 99.9% of all compressed javascript
		// is named this way.
		title = "$:/" + title;
	}
	var tiddler = state.wiki.getTiddler(title);
	if (tiddler) {
		var text = tiddler.fields.text;
		//text = "(function(module,exports,console,setInterval,clearInterval,setTimeout,clearTimeout,Buffer,$tw,require) {(function(){\n" + text + "\n;})();\nreturn exports;\n})\n";
		state.sendResponse(200,{"Content-Type": "application/javascript"},text,"utf8");
	} else {
		logger.alert('No original source for:', title);
		response.writeHead(404);
		response.end();
	}
};

}());
