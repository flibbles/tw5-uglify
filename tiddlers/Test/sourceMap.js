/*\
title: Test/sourceMap.js
type: application/javascript
tags: $:/tags/test-spec

Tests the server ability to fetch source maps.
Currently only javascript can supply them.

\*/

if ($tw.browser) {
describe('source map', function() {

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

//TODO: Test for 404
//TODO: Test for blacklisted
//TODO: test for boot files

});
}
