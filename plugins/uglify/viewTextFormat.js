/*\
title: $:/plugins/flibbles/uglify/viewWidgetText
module-type: viewwidgetformat
type: application/javascript

This is the preferred way to introduce uglify into the ViewWidget.

This replaces the viewwidgetformat 'text'.

\*/

/*jslint node: true, browser: true */
/*global $tw: false */
'use strict';

var formats = require('$:/core/modules/widgets/view/formats.js');
var utils = require('./utils.js');

formats.text = exports.text = utils.getPluginOrBootCompressedTextMethod(formats.text);
