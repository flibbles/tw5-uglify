/*\
title: Test/sourceMap.js
type: application/javascript
tags: $:/tags/test-spec

Tests the server ability to fetch source maps.
Currently only javascript can supply them.

\*/

describe('source map', function() {

var getEpilogue = require("$:/temp/library/flibbles/uglify.js").getEpilogue;

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
