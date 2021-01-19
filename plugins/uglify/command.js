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
	name: 'uglify',
	synchronous: true
};

function Command(params, commander, callback) {
	this.params = params;
	this.commander = commander;
	this.callback = callback;
};

Command.prototype.execute = function() {
	var wiki = this.commander.wiki;
	if (this.params.length == 0) {
		return list(wiki);
	}
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

function list(wiki) {
	var settings = utils.getSettings(wiki);
	var maxKeyLength = 0;
	for (var key in settings) {
		maxKeyLength = Math.max(maxKeyLength, key.length);
	}
	$tw.utils.each(settings, function(value, key) {
		var padding = new Array(maxKeyLength + 1 - key.length).join(' ');
		console.log(key + ':' + padding, stringify(value));
	});
};

function stringify(value) {
	switch(typeof value) {
		case 'boolean':
			return value? 'yes' : 'no';
		default:
			return value.toString();
	}
};

exports.Command = Command;
