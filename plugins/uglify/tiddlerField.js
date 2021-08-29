/*\
title: $:/plugins/flibbles/uglify/tiddlerfield.js
module-type: tiddlerfield
type: application/javascript

Commands for configuring uglify during build tasks.

\*/

var utils = require('./utils.js');

exports.name = "text"

exports.parse = function(t) { return t; };

var systemTargets = {'$:/boot/boot.js': true, '$:/boot/bootprefix.js': true};

exports.stringify = function(t) {
	var title = this.fields.title;
	if ($tw.wiki.compressionEnabled()
	&& ($tw.wiki.getPluginInfo(title) || systemTargets[title])
	&& !blacklisted($tw.wiki, title)) {
		return $tw.wiki.getTiddlerUglifiedText(title);
	} else {
		return t.toString();
	}
};

function blacklisted(wiki, title) {
	return utils.getSetting(wiki, 'blacklist').indexOf(title) >= 0;
};

