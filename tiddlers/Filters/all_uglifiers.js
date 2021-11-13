/*\
title: Filters/all_uglifiers.js
type: application/javascript
module-type: allfilteroperator

Gives the documentation a list of all tiddler types which have corresponding uglifiers.

This is an exact copy of the uglifier used by the wizard. Copying it just seemed easier than finding a way to share one file without it being in Uglify.

\*/

"use strict";

exports.uglifiers = function(source, prefix, options) {
	return Object.keys($tw.modules.getModulesByTypeAsHashmap("uglifier", "type"));
};
