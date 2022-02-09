/*\
title: Test/sourceMap.js
type: application/javascript
tags: $:/tags/test-spec

Tests the server ability to fetch source maps.
Currently only javascript can supply them.

\*/

describe('source map', function() {

var addDirectives = require("$:/plugins/flibbles/uglify/startup_eval.js").addDirectives;

if ($tw.browser) {

var Server = require("$:/core/modules/server/server.js").Server;

var response = {
	writeHead: console.warn,
	end: function() {}
};

it('can fetch a shadow tiddler map', function() {
	const wiki = new $tw.Wiki(),
		pluginName = 'plugin_' + $tw.utils.test.uniqName(),
		text = 'exports.func = function(argName) {return argName;}',
		tiddlers = [
			{title: 'file.js', type: 'application/javascript', text: text}];
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers);
	const path = "http://127.0.0.1/uglify/maps/file.js";
	const server = new Server({
			wiki: wiki,
			variables: {}}),
		request = {method: "GET", url: path};
	spyOn(response, 'writeHead');
	spyOn(response, 'end');
	server.requestHandler(request, response);
	expect(response.writeHead).toHaveBeenCalledWith(200, {'Content-Type': 'application/json'});
	expect(response.end).toHaveBeenCalledTimes(1);
	var calls = response.end.calls.first();
	expect(calls.args[1]).toBe('utf8');
	expect(JSON.parse(calls.args[0]).sources).toEqual(['file.js']);
});

}

//TODO: Test for 404
//TODO: Test for blacklisted
//TODO: test for boot files

it('clients add directive only when appropriate', function() {
	const wiki = new $tw.Wiki(),
		pluginName = 'plugin_' + $tw.utils.test.uniqName(),
		text = 'exports.func = function(argName) {return argName;}',
		tiddlers = [
			{title: 'file.js', type: 'application/javascript', text: text}];
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers);
	// Without the server cue, no sourceMapping
	expect(addDirectives(wiki, text, 'file.js')).toContain("sourceURL=");
	wiki.addTiddler({title: "$:/state/flibbles/uglify/server", text: "yes"});
	expect(addDirectives(wiki, text, 'file.js')).toContain("sourceMappingURL=");
});

});
