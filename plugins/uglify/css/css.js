/*\
title: $:/plugins/flibbles/uglify/css.js
module-type: uglifier
type: application/javascript
\*/

var logger = require('../logger.js');
var uglifycss = require('./uglifycss-lib.js');

exports.type = "text/css";

exports.uglify = function(text, title) {
	return {text: uglifycss.processString(text, {noHacks: true})};
};
