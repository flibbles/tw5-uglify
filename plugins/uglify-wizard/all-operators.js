/*\
title: $:/plugins/flibbles/uglify-wizard/all_uglifiers.js
type: application/javascript
module-type: allfilteroperator

Gives the documentation a list of all tiddler types which have corresponding uglifiers.

\*/

"use strict";

var utils = require("$:/plugins/flibbles/uglify/utils.js");

exports.uglifiers = function(source, prefix, options) {
	return Object.keys($tw.modules.getModulesByTypeAsHashmap("uglifier", "type"));
};

exports.uglifiable = function(source, prefix, options) {
	return utils.allEligibleTiddlers(options.wiki);
};
