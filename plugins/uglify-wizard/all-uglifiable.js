/*\
title: $:/plugins/flibbles/uglify-wizard/all_uglifiable.js
type: application/javascript
module-type: allfilteroperator

Returns a list of all tiddlers which would be altered  by Uglify given the
current settings.

\*/

"use strict";

var utils = require("$:/plugins/flibbles/uglify/utils.js");

exports.uglifiable = function(source, prefix, options) {
	return utils.allEligibleTiddlers(options.wiki);
};
