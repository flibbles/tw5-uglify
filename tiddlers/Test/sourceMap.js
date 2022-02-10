/*\
title: Test/sourceMap.js
type: application/javascript
tags: $:/tags/test-spec

Tests the server ability to fetch source maps.
Currently only javascript can supply them.

\*/

describe('source map', function() {

var getDirective = require("$:/plugins/flibbles/uglify/startup_eval.js").getDirective;

if (!$tw.browser) {

var Server = require("$:/core/modules/server/server.js").Server;

var response = {
	writeHead: console.warn,
	end: function() {}
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
	wiki.addTiddler({title: "$:/state/flibbles/uglify/server", text: "yes"});
	const server = new Server({
			wiki: wiki,
			variables: {}});
	spyOn(response, 'writeHead');
	spyOn(response, 'end');
	spyOn(console, 'log');
	// First we get the directive.
	var directive = getDirective(wiki, title);
	expect(directive.indexOf("sourceMappingURL=")).not.toBeLessThan(0);
	var mapPath = "http://127.0.0.1"+directive.substr(directive.indexOf('=')+1);
	server.requestHandler({method: "GET", url: mapPath}, response);
	expect(response.writeHead).toHaveBeenCalledWith(200, {'Content-Type': 'application/json'});
	expect(response.end).toHaveBeenCalledTimes(1);
	var calls = response.end.calls.first();
	expect(calls.args[1]).toBe('utf8');
	var map = JSON.parse(calls.args[0]);
	var sourcePath = "http://127.0.0.1" + map.sourceRoot + map.sources[0];
	// Now we try to fetch the original source
	response.end.calls.reset();
	response.writeHead.calls.reset();
	server.requestHandler({method: "GET", url: sourcePath}, response);
	expect(response.writeHead).toHaveBeenCalledWith(200, {'Content-Type': 'application/javascript'});
	expect(response.end).toHaveBeenCalledTimes(1);
	var calls = response.end.calls.first();
	expect(calls.args[0]).toBe(text);
};

it('can fetch a non-system tiddler map', function() {
	fetch('file.js');
});

it('can fetch a system tiddler map', function() {
	fetch('$:/plugins/flibbles/uglify/file.js');
});

it('can fetch system tiddlers with illegal URI characters', function() {
	fetch('$:/plugins/#/?/file.js');
});

}

it('clients add directive only when appropriate', function() {
	const wiki = new $tw.Wiki(),
		pluginName = 'plugin_' + $tw.utils.test.uniqName(),
		text = 'exports.func = function(argName) {return argName;}',
		tiddlers = [
			{title: 'file.js', type: 'application/javascript', text: text}];
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers);
	// Is dependent on the state tiddler, even dynamically
	expect(getDirective(wiki, 'file.js')).toContain("sourceURL=");
	wiki.addTiddler({title: "$:/state/flibbles/uglify/server", text: "yes"});
	expect(getDirective(wiki, 'file.js')).toContain("sourceMappingURL=");
	// Without sourcemapping can be controlled through configuration
	wiki.addTiddler($tw.utils.test.setting("sourcemap", "no"));
	expect(getDirective(wiki, 'file.js')).toContain("sourceURL=");
	wiki.addTiddler($tw.utils.test.setting("sourcemap", "yes"));
	expect(getDirective(wiki, 'file.js')).toContain("sourceMappingURL=");
	// If compression is disabled, so is sourcemapping
	wiki.addTiddler($tw.utils.test.noCompress());
	expect(getDirective(wiki, 'file.js')).toContain("sourceURL=");
	wiki.addTiddler($tw.utils.test.yesCompress());
	expect(getDirective(wiki, 'file.js')).toContain("sourceMappingURL=");
	// If javascript in particular is disabled, then so is sourcemapping
	wiki.addTiddler($tw.utils.test.setting("application/javascript", "no"));
	expect(getDirective(wiki, 'file.js')).toContain("sourceURL=");
	wiki.addTiddler($tw.utils.test.setting("application/javascript", "yes"));
	expect(getDirective(wiki, 'file.js')).toContain("sourceMappingURL=");
	// blacklisting a plugin disables for all containing javascript
	wiki.addTiddler($tw.utils.test.setting("blacklist", pluginName + " cats"));
	expect(getDirective(wiki, 'file.js')).toContain("sourceURL=");
	wiki.addTiddler($tw.utils.test.setting("blacklist", "cats"));
	expect(getDirective(wiki, 'file.js')).toContain("sourceMappingURL=");
	// Overridden javascript shouldn not be sourcemapped
	wiki.addTiddler({title: "file.js", text: text, type: "application/javascript"});
	expect(getDirective(wiki, 'file.js')).toContain("sourceURL=");
});

});
