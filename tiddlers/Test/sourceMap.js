/*\
title: Test/sourceMap.js
type: application/javascript
tags: $:/tags/test-spec

Tests the server ability to fetch source maps.
Currently only javascript can supply them.

\*/

describe('source map', function() {

var addDirectives = require("$:/plugins/flibbles/uglify/startup_eval.js").addDirectives;

if (!$tw.browser) {

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
	const path = "http://127.0.0.1/uglify/map/file.js";
	const server = new Server({
			wiki: wiki,
			variables: {}}),
		request = {method: "GET", url: path};
	spyOn(response, 'writeHead');
	spyOn(response, 'end');
	spyOn(console, 'log');
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
	// Without sourcemapping can be controlled through configuration
	expect(addDirectives(wiki, text, 'file.js')).toContain("sourceMappingURL=");
	wiki.addTiddler($tw.utils.test.setting("sourcemap", "no"));
	expect(addDirectives(wiki, text, 'file.js')).toContain("sourceURL=");
	wiki.addTiddler($tw.utils.test.setting("sourcemap", "yes"));
	expect(addDirectives(wiki, text, 'file.js')).toContain("sourceMappingURL=");
	// If compression is disabled, so is sourcemapping
	wiki.addTiddler($tw.utils.test.noCompress());
	expect(addDirectives(wiki, text, 'file.js')).toContain("sourceURL=");
	wiki.addTiddler($tw.utils.test.yesCompress());
	expect(addDirectives(wiki, text, 'file.js')).toContain("sourceMappingURL=");
	// If javascript in particular is disabled, then so is sourcemapping
	wiki.addTiddler($tw.utils.test.setting("application/javascript", "no"));
	expect(addDirectives(wiki, text, 'file.js')).toContain("sourceURL=");
	wiki.addTiddler($tw.utils.test.setting("application/javascript", "yes"));
	expect(addDirectives(wiki, text, 'file.js')).toContain("sourceMappingURL=");
	// blacklisting a plugin disables for all containing javascript
	wiki.addTiddler($tw.utils.test.setting("blacklist", pluginName + " cats"));
	expect(addDirectives(wiki, text, 'file.js')).toContain("sourceURL=");
	wiki.addTiddler($tw.utils.test.setting("blacklist", "cats"));
	expect(addDirectives(wiki, text, 'file.js')).toContain("sourceMappingURL=");
	// Overridden javascript shouldn not be sourcemapped
	wiki.addTiddler({title: "file.js", text: text, type: "application/javascript"});
	expect(addDirectives(wiki, text, 'file.js')).toContain("sourceURL=");
});

});
