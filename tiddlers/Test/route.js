/*\
title: Test/route.js
type: application/javascript
tags: $:/tags/test-spec

Tests the server ability to route browser requests for maps and source.

This suite can only be tested on Node.JS

\*/


if (!$tw.browser) {

describe('route', function() {

var getDirective = require("$:/temp/library/flibbles/uglify.js").getDirective;
var Server = require("$:/core/modules/server/server.js").Server;
var path = require('path');

var response = {
	writeHead: console.warn,
	end: function() {}
};

beforeEach(function() {
	spyOn(response, 'writeHead');
	spyOn(response, 'end');
	spyOn(console, 'log');
});

function addPlugin(wiki, moduleName, moduleText) {
	var pluginName = 'plugin_' + $tw.utils.test.uniqName(),
		tiddlers = [ {
			title: moduleName,
			type: 'application/javascript',
			text: moduleText}];
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers);
};

// This gets the compressed file, takes the sourceMapURL, gets the
// sourcemap, and then gets the underlying original source.
function fetch(title) {
	const wiki = new $tw.Wiki(),
		pluginName = 'plugin_' + $tw.utils.test.uniqName(),
		text = 'exports.func = function(argName) {return argName;}',
		tiddlers = [
			{title: title, type: 'application/javascript', text: text}];
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers);
	wiki.addTiddler($tw.utils.test.noCache());
	const server = new Server({
			wiki: wiki,
			variables: {}});
	// First we get the directive.
	var directive = getDirective(wiki, title);
	expect(directive.indexOf("sourceMappingURL=")).not.toBeLessThan(0);
	var domain = "http://127.0.0.1";
	var mapPath = path.join("/", directive.substr(directive.indexOf('=')+1));
	server.requestHandler({method: "GET", url: domain + mapPath}, response);
	expect(response.writeHead).toHaveBeenCalledWith(200, {'Content-Type': 'application/json'});
	expect(response.end).toHaveBeenCalledTimes(1);
	var calls = response.end.calls.first();
	expect(calls.args[1]).toBe('utf8');
	var map = JSON.parse(calls.args[0]);
	var sourcePath = path.join(path.dirname(mapPath), map.sourceRoot || '', map.sources[0]);
	// Now we try to fetch the original source
	response.end.calls.reset();
	response.writeHead.calls.reset();
	server.requestHandler({method: "GET", url: domain + sourcePath}, response);
	expect(response.writeHead).toHaveBeenCalledWith(200, {'Content-Type': 'application/javascript'});
	expect(response.end).toHaveBeenCalledTimes(1);
	var calls = response.end.calls.first();
	expect(calls.args[0]).toBe(text);
};

// Don't change these values. I've tested carefully that that url should
// link to that module. Just the right amount of escaping.
var crazyFile = '$:/!@#$:;\'"%^&*()[]{}\\|<>,? 语言处理.js';
var crazyUrl = "http://127.0.0.1/source/$:/!%40%23$:%3B'%22%25%5E%26*()%5B%5D%7B%7D%5C%7C%3C%3E%2C%3F%20%E8%AF%AD%E8%A8%80%E5%A4%84%E7%90%86.js";
var crazySource = "!%40%23%24%3A%3B'%22%25%5E%26*()%5B%5D%7B%7D%5C%7C%3C%3E%2C%3F%20%E8%AF%AD%E8%A8%80%E5%A4%84%E7%90%86.js";

it('can fetch source map with illegal URL characters in name', function() {
	const wiki = new $tw.Wiki();
	addPlugin(wiki, crazyFile, 'exports.val = 3;');
	wiki.addTiddler($tw.utils.test.noCache());
	const server = new Server({ wiki: wiki, variables: {} });
	server.requestHandler({method: 'GET', url: crazyUrl + '.map'}, response);
	expect(response.writeHead).toHaveBeenCalledWith(200, {'Content-Type': 'application/json'});
	expect(response.end).toHaveBeenCalledTimes(1);
	var calls = response.end.calls.first();
	expect(calls.args[1]).toBe('utf8');
	var map = JSON.parse(calls.args[0]);
	expect(map.sources[0]).toBe(crazySource);
});

it('can fetch source js with illegal URL characters in name', function() {
	const wiki = new $tw.Wiki();
	const text = 'exports.func = function(arg) {return arg;}';
	addPlugin(wiki, crazyFile, text);
	wiki.addTiddler($tw.utils.test.noCache());
	const server = new Server({ wiki: wiki, variables: {} });
	server.requestHandler({method: "GET", url: crazyUrl}, response);
	expect(response.writeHead).toHaveBeenCalledWith(200, {'Content-Type': 'application/javascript'});
	expect(response.end).toHaveBeenCalledTimes(1);
	var calls = response.end.calls.first();
	expect(calls.args[0]).toBe(text);
});

it('can fetch a non-system tiddler map', function() {
	fetch('file.js');
});

it('can fetch a system tiddler map', function() {
	fetch('$:/plugins/flibbles/uglify/file.js');
});

it('can fetch tiddler with illegal URI characters in dir', function() {
	fetch('$:/plugins/#/?/file.js');
});

});

}
