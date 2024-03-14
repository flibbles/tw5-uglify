/*\
title: Test/sourceMap.js
type: application/javascript
tags: $:/tags/test-spec

Tests the server ability to fetch source maps.
Currently only javascript can supply them.

\*/

describe('source map', function() {

var getEpilogue = require("$:/temp/library/flibbles/uglify.js").getEpilogue;

if (!$tw.browser) {

var Server = require("$:/core/modules/server/server.js").Server;
var path = require('path');

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
	wiki.addTiddler($tw.utils.test.noCache());
	const server = new Server({
			wiki: wiki,
			variables: {}});
	spyOn(response, 'writeHead');
	spyOn(response, 'end');
	spyOn(console, 'log');
	// First we get the directive.
	var directive = getEpilogue(wiki, title);
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

it('can fetch a non-system tiddler map', function() {
	fetch('file.js');
});

it('can fetch a system tiddler map', function() {
	fetch('$:/plugins/flibbles/uglify/file.js');
});

it('can fetch tiddler with illegal URI characters in dir', function() {
	fetch('$:/plugins/#/?/file.js');
});

it('can fetch tiddler with illegal URI characters in name', function() {
	fetch('$:/plugins/this file contains !@?#$:%^&*().js');
});

}

it('client adds directive to shadow modules', function() {
	const wiki = new $tw.Wiki(),
		pluginName = 'plugin_' + $tw.utils.test.uniqName(),
		tiddlerName = pluginName + "/file.js",
		text = 'exports.func = function(argName) {return argName;}',
		tiddlers = [
			{title: tiddlerName, type: 'application/javascript', text: text, "module-type": "library"}];
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers);
	wiki.addTiddler($tw.utils.test.noCache());
	var directive = getEpilogue(wiki, tiddlerName);
	expect(directive).toContain("sourceMappingURL=");
	expect(directive).not.toContain("sourceURL=");
	// Now we override the shadow module...
	wiki.addTiddlers(tiddlers);
	directive = getEpilogue(wiki, tiddlerName);
	expect(directive).not.toContain("sourceMappingURL=");
	expect(directive).toContain("sourceURL=");
});

it('client does not add mapping directive to standalone modules', function() {
	const wiki = new $tw.Wiki(),
		title = "standalone.js",
		text = 'exports.love = true';
	wiki.addTiddler({
		title: title,
		text: 'exports.love = true',
		type: 'application/javascript',
		"module-type": "library"});
	var directive = getEpilogue(wiki, title);
	expect(directive).not.toContain("sourceMappingURL=");
	expect(directive).toContain("sourceURL=");
});

it('server does not add directives to modules', function() {
	const wiki = new $tw.Wiki(),
		pluginName = 'plugin_' + $tw.utils.test.uniqName(),
		tiddlerName = pluginName + "/file.js",
		text = 'exports.myFunc = function(argName) {return argName;}',
		tiddlers = [
			{title: tiddlerName, type: 'application/javascript', text: text}];
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers);
	wiki.addTiddler($tw.utils.test.noCache());
	spyOn(console, 'log');
	var output = wiki.getTiddlerUglifiedText(tiddlerName);
	expect(output).not.toContain("sourceMappingURL=");
	expect(output).not.toContain("sourceURL=");
	expect(output).not.toContain("argName");
	expect(output).toContain("myFunc");
	// Now we override the shadow module...
	// It still compresses, because it's being explicitly asked for.
	wiki.addTiddlers(tiddlers);
	output = wiki.getTiddlerUglifiedText(tiddlerName);
	expect(output).not.toContain("sourceMappingURL=");
	expect(output).not.toContain("sourceURL=");
	expect(output).not.toContain("argName");
	expect(output).toContain("myFunc");
});

it('server adds directives to boot files', function() {
	const wiki = new $tw.Wiki(),
		boot = '$:/boot/boot.js',
		text = 'exports.func = function(argName) {return argName;}';
	var out;
	wiki.addTiddler($tw.utils.test.noCache());
	wiki.addTiddler({title: boot, text: text, type: "application/javascript"});
	spyOn(console, 'log');
	out = wiki.getTiddlerUglifiedText(boot);
	expect(out).not.toContain("sourceURL=");
	expect(out).toContain("sourceMappingURL=");
	expect(out).not.toContain("argName");
	// Without sourcemapping can be controlled through configuration
	wiki.addTiddler($tw.utils.test.setting("sourcemap", "no"));
	out = wiki.getTiddlerUglifiedText(boot);
	expect(out).not.toContain("sourceURL=");
	expect(out).not.toContain("sourceMappingURL=");
	expect(out).not.toContain("argName");
	// Now with sourcemap explciitly enabled
	wiki.addTiddler($tw.utils.test.setting("sourcemap", "yes"));
	out = wiki.getTiddlerUglifiedText(boot);
	expect(out).not.toContain("sourceURL=");
	expect(out).toContain("sourceMappingURL=");
	expect(out).not.toContain("argName");
});

it('server adds directives to boot that already has directives', function() {
	const wiki = new $tw.Wiki(),
		boot = '$:/boot/boot.js',
		text = 'exports.func = function(argName) {return argName;}\n\n//# sourceURL='+boot;
	wiki.addTiddler($tw.utils.test.noCache());
	wiki.addTiddler({title: boot, text: text, type: "application/javascript"});
	spyOn(console, 'log');
	var out = wiki.getTiddlerUglifiedText(boot);
	expect(out).not.toContain("sourceURL=");
	expect(out).toContain("sourceMappingURL=");
});

it('server does not add directives to css boot file', function() {
	const wiki = new $tw.Wiki(),
		boot = '$:/boot/boot.css',
		text = '.class {color: black;}';
	wiki.addTiddler($tw.utils.test.noCache());
	wiki.addTiddler({title: boot, text: text, type: "text/css"});
	spyOn(console, 'log');
	expect(wiki.getTiddlerUglifiedText(boot)).not.toContain("sourceURL=");
	expect(wiki.getTiddlerUglifiedText(boot)).not.toContain("sourceMappingURL=");
});


});
