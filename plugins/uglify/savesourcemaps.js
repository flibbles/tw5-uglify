/*\
title: $:/plugins/flibbles/uglify/savesourcemaps.js
module-type: command
type: application/javascript

Command for generating the sourcemap directory that can be used by standalone wikis.

\*/

'use strict';

var utils = require('./utils.js');
var fs, path;

exports.info = {
	name: 'savesourcemaps',
	synchronous: true
};

function Command(params, commander, callback) {
	this.params = params;
	this.commander = commander;
	this.callback = callback;
};

Command.prototype.execute = function() {
	var wiki = this.commander.wiki,
		dir = this.commander.outputPath,
		tiddlers = utils.allEligibleTiddlers(wiki);
	if (fs === undefined) {
		fs = require("fs");
		path = require("path");
	}
	for (var i = 0; i < tiddlers.length; i++) {
		var tiddler = wiki.getTiddler(tiddlers[i]);
		// This gets all system tiddlers that are javascript. Skips the plugins.
		if (tiddler && tiddler.fields.type === "application/javascript") {
			genSourceContent(wiki, dir, tiddlers[i]);
		}
	}
	tiddlers = wiki.filterTiddlers("[all[shadows]type[application/javascript]]");
	for (var i = 0; i < tiddlers.length; i++) {
		// Now we focus on each javascript tiddler within the plugins
		genSourceContent(wiki, dir, tiddlers[i]);
	}
};

function genSourceContent(wiki, outputPath, title) {
	var sourceMap = wiki.getTiddlerSourceMap(title);
	// Not all javascript files get uglified. This is because they may
	// be pruned instead. In those cases, we don't need to do anything.
	if (sourceMap && title.indexOf('$:/') === 0) {
		// 3 being the length of "$:/"
		// We're cutting $:/ off and re-adding it, because soon the prefix
		// might be different.
		var dir = path.resolve(outputPath, "$:", title.substr(3));
		$tw.utils.createFileDirectories(dir);
		fs.writeFile(
			dir,
			wiki.getTiddlerText(title),
			"utf8",
			function(err) {if (err) {console.log("Error writing file:", err);}});
		fs.writeFile(
			dir + ".map",
			JSON.stringify(sourceMap),
			"utf8",
			function(err) {if (err) {console.log("Error writing file:", err);}});
	}
};

exports.Command = Command;
