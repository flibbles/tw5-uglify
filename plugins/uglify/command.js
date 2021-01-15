/*\
title: $:/plugins/flibbles/uglify/command.js
module-type: command
type: application/javascript

Commands for configuring uglify during build tasks.

\*/

/*jslint node: true, browser: true */
/*global $tw: false */
'use strict';

var logger = require('./logger.js');
var utils = require('./utils.js');

exports.info = {
	name: "uglify",
	synchronous: true
};

function Command(params, commander, callback) {
	this.params = params;
	this.commander = commander;
	this.callback = callback;
};

var settings = {
	javascript: Boolean,
	stub: Boolean,
	cache: Boolean,
	cacheDirectory: String
};

Command.prototype.execute = function() {
	var wiki = this.commander.wiki;
	for (var i = 0; i < this.params.length; i+=2) {
		var property = this.params[i];
		var value = this.params[i+1];
		if (utils.getSetting(wiki, property) !== undefined) {
			var title = '$:/config/flibbles/uglify/' + property;
			if (value) {
				wiki.addTiddler({title: title, text: value});
			} else {
				wiki.deleteTiddler(title);
			}
		} else {
			logger.warn('Unrecognized configuration flag: ' + property);
		}
	}
};

exports.Command = Command;
