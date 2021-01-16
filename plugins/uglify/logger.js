/*\
title: $:/plugins/flibbles/uglify/logger.js
module-type: library
type: application/javascript

The logger used by the uglifier plugin.
\*/

/*jslint node: true, browser: true */
/*global $tw: false */
'use strict';

var logger = new $tw.utils.Logger('uglify', {colour: 'green'});
var oldAlert = logger.alert;

logger.warn = function(/*arguments*/) {
	var args = [];
	if ($tw.node) {
		// That empty string puts a space before the alert so it lines up
		// with all the log messages. I'm neurotic like that.
		args.push('', this.componentName + ':');
	}
	args.push.apply(args, arguments);
	return this.alert.apply(this, args);
};

module.exports = logger;
