/*\
title: Test/route.js
type: application/javascript
tags: $:/tags/test-spec

Tests the server ability to route browser requests for maps and source.

This suite can only be tested on Node.JS

\*/


if (!$tw.browser) {

describe('route', function() {

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

// Don't change these values. I've tested carefully that that url should
// link to that module. Just the right amount of escaping.
var crazyFile = '$:/plugins/!@#$:;\'"%^&*()[]{}\\|<>,? 语言处理.js';
var crazyUrl = "http://127.0.0.1/$:/plugins/!%40%23$:%3B'%22%25%5E%26*()%5B%5D%7B%7D%5C%7C%3C%3E%2C%3F%20%E8%AF%AD%E8%A8%80%E5%A4%84%E7%90%86.js";
var crazySource = "!%40%23%24%3A%3B'%22%25%5E%26*()%5B%5D%7B%7D%5C%7C%3C%3E%2C%3F%20%E8%AF%AD%E8%A8%80%E5%A4%84%E7%90%86.js";

it('can fetch source map with illegal URL characters in name', function() {
	const wiki = new $tw.Wiki();
	addPlugin(wiki, crazyFile, 'exports.val = 3;');
	wiki.addTiddler($tw.utils.test.noCache());
	const server = new Server({ wiki: wiki, variables: {} });
	server.requestHandler({method: 'GET', url: crazyUrl + '.map'}, response);
	expect(response.writeHead).toHaveBeenCalledWith(200, jasmine.objectContaining({'Content-Type': 'application/json'}));
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
	expect(response.writeHead).toHaveBeenCalledWith(200, jasmine.objectContaining({'Content-Type': 'application/javascript'}));
	expect(response.end).toHaveBeenCalledTimes(1);
	var calls = response.end.calls.first();
	expect(calls.args[0]).toBe(text);
});

it('will not fetch a non-system tiddler map', function() {
	const wiki = new $tw.Wiki();
	addPlugin(wiki, 'file.js', 'exports.val = 3;');
	wiki.addTiddler($tw.utils.test.noCache());
	const server = new Server({ wiki: wiki, variables: {} });
	// This doesn't even hit our route, but this would be the url.
	server.requestHandler({method: 'GET', url: 'http://127.0.0.1/file.js.map'}, response);
	expect(response.writeHead).toHaveBeenCalledWith(404);
	expect(response.end).toHaveBeenCalledTimes(1);
});

});

}
