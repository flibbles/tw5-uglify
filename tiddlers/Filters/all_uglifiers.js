/*\
title: Filters/all_uglifiers.js
type: application/javascript
module-type: allfilteroperator

Gives the documentation a list of all tiddler types which have corresponding uglifiers.

\*/

"use strict";

exports.uglifiers = function(source, prefix, options) {
	return Object.keys($tw.modules.getModulesByTypeAsHashmap("uglifier", "type"));
};
