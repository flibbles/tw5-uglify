/*\
title: $:/plugins/flibbles/uglify/logger.js
module-type: library
type: application/javascript

The logger used by the uglifier plugin.
\*/

/*jslint node: true, browser: true */
/*global $tw: false */
'use strict';

module.exports = new $tw.utils.Logger('uglifier', {colour: 'green'});
