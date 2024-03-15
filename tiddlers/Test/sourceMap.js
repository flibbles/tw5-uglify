/*\
title: Test/sourceMap.js
type: application/javascript
tags: $:/tags/test-spec

Tests the server ability to fetch source maps.
Currently only javascript can supply them.

\*/

describe('source map', function() {

// This evaluates the uglify library in a control context
function clientEval(wiki, tiddlerName) {
	var libraryText = $tw.wiki.getTiddlerText("$:/temp/library/flibbles/uglify.js");
	var container = {};
	var method = new Function("window", libraryText);
	method(container);
	// It should have populated our container now with $tw-like stuff
	container.$tw.utils = {};
	container.$tw.wiki = wiki;
	container.eval = function(text) { return () => text; };
	container.$tw.hooks.names['th-boot-tiddlers-loaded'][0]();
	return container.$tw.utils.evalSandboxed(wiki.getTiddlerText(tiddlerName), {}, tiddlerName);
};

it('client adds directive to shadow modules', function() {
	const wiki = new $tw.Wiki(),
		pluginName = 'plugin_' + $tw.utils.test.uniqName(),
		tiddlerName = pluginName + "/file.js",
		text = 'exports.func = function(argName) {return argName;}',
		tiddlers = [
			{title: tiddlerName, type: 'application/javascript', text: text, "module-type": "library"}];
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers, {ugly: true});
	wiki.addTiddler($tw.utils.test.noCache());
	var directive = clientEval(wiki, tiddlerName);
	expect(directive).toContain("sourceMappingURL=");
	expect(directive).not.toContain("sourceURL=");
	// Now we override the shadow module...
	wiki.addTiddlers(tiddlers);
	directive = clientEval(wiki, tiddlerName);
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
	var directive = clientEval(wiki, title);
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
	expect(out).not.toContain("sourceMappingURL=");
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
	wiki.addTiddler($tw.utils.test.setting("sourcemap", "yes"));
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

it('gets source maps for shadow tiddlers', function() {
	const pluginName = "plugin_" + $tw.utils.test.uniqName();
	const filepath = './.cache/uglify/' + pluginName + '.tid';
	const javascript = 'exports.jsPresent = function(arg) {return arg;}';
	const stylesheet = '/* comment */\n.class { cssPresent: red; }';
	const tiddlers = [
		{title: 'test.js', text: javascript, type: 'application/javascript'},
		{title: 'test.css', text: stylesheet, type: 'text/css'}];
	const wiki = new $tw.Wiki();
	wiki.addTiddler($tw.utils.test.noCache());
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers);
	spyOn(console, "log");
	var map = wiki.getTiddlerSourceMap('test.js');
	// all shadow javascript must skip the first line that boot.js adds
	expect(map.mappings[0]).toBe(";");
	expect(map.sources[0]).toBe("test.js");
	wiki.addTiddler({title: 'test.js', text: javascript, type: 'application/javascript'});
	var newMap = wiki.getTiddlerSourceMap('test.js');
	// Even though the tiddler is overridden, we still return the underlying
	// shadow tiddler, because the only reason a browser would be asking for
	// source for an overridden tiddler is because it was overridden since
	// the last refresh, and the shadow version is still the version in use.
	expect(newMap.mappings).toBe(map.mappings);
	expect(newMap.sources[0]).toBe("test.js");
});

it('gets source maps for boot.js and bootprefix.js', function() {
	const javascript = 'exports.jsPresent = function(arg) {return arg;}';
	const wiki = new $tw.Wiki();
	wiki.addTiddler($tw.utils.test.noCache());
	wiki.addTiddler({title: "$:/boot/boot.js", text: javascript, type: 'application/javascript'});
	spyOn(console, "log");
	var map = wiki.getTiddlerSourceMap('$:/boot/boot.js');
	expect(map.mappings[0]).not.toBe(';');
	expect(map.sources[0]).toBe('boot.js');
	// Now for bootprefix
	wiki.addTiddler({title: "$:/boot/bootprefix.js", text: javascript, type: 'application/javascript'});
	map = wiki.getTiddlerSourceMap('$:/boot/bootprefix.js');
	expect(map.mappings[0]).not.toBe(';');
	expect(map.sources[0]).toBe('bootprefix.js');
});

it('gets undefined source maps for non-javascript tiddlers', function() {
	const wiki = new $tw.Wiki();
	wiki.addTiddler($tw.utils.test.noCache());
	// non-existent
	spyOn(console, "log");
	expect(wiki.getTiddlerSourceMap("nothing.js")).toBeUndefined();
	wiki.addTiddler({title: "wikitext", text: "This is wikitext"});
	expect(wiki.getTiddlerSourceMap("wikitext")).toBeUndefined();
});

});
