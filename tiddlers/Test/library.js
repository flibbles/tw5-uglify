/*\
title: Test/library.js
type: application/javascript
tags: $:/tags/test-spec

Tests the server ability to fetch source maps.
Currently only javascript can supply them.

\*/

describe('client boot library', function() {

// This evaluates the uglify library in a control context
function clientEval(wiki, tiddlerName) {
	var libraryText = $tw.wiki.getTiddlerText("$:/temp/library/flibbles/uglify.js");
	var container = {};
	var method = new Function("window", libraryText);
	var module = {exports: {}};
	method(container);
	// It should have populated our container now with $tw-like stuff
	container.$tw.utils = {};
	container.$tw.wiki = wiki;
	container.eval = function(text) { return () => text; };
	container.$tw.hooks.names['th-boot-tiddlers-loaded'][0]();
	return container.$tw.utils.evalSandboxed(
		wiki.getTiddlerText(tiddlerName),
		{module: module, exports: module.exports},
		tiddlerName);
};

it('adds directive to shadow modules', function() {
	const wiki = new $tw.Wiki(),
		pluginName = '$:/plugin_' + $tw.utils.test.uniqName(),
		tiddlerName = pluginName + "/file.js",
		text = 'exports.func = function(argName) {return argName;}',
		tiddlers = [
			{title: tiddlerName, type: 'application/javascript', text: text, "module-type": "library"}];
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers, {ugly: true});
	$tw.utils.test.exec(wiki, "cache", "no", "sourcemap", "yes");
	var directive = clientEval(wiki, tiddlerName);
	expect(directive).toContain("sourceMappingURL=");
	expect(directive).not.toContain("sourceURL=");
	// Now we override the shadow module...
	wiki.addTiddlers(tiddlers);
	directive = clientEval(wiki, tiddlerName);
	expect(directive).not.toContain("sourceMappingURL=");
	expect(directive).toContain("sourceURL=");
});

it('properly escapes sourceMappingURL', function() {
	const wiki = new $tw.Wiki(),
		pluginName = '$:/plugin_' + $tw.utils.test.uniqName(),
		tiddlerName = pluginName + "/!@#$%^&*()[]{}\\|<>,? 语言处理.js",
		text = 'exports.test = true;',
		tiddlers = [
			{title: tiddlerName, type: 'application/javascript', text: text, "module-type": "library"}];
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers, {ugly: true});
	$tw.utils.test.exec(wiki, "sourcemap", "yes");
	var output = clientEval(wiki, tiddlerName);
	// We hard-code this expected result, because this URL gets passed
	// to the browser. In other words, contact with an outside program.
	// No matter what changes in Uglify, that tiddlerName should always
	// correspond to the escape-soup below.
	expect(output).toContain("sourceMappingURL=" + pluginName + "/!%40%23$%25%5E%26*()%5B%5D%7B%7D%5C%7C%3C%3E%2C%3F%20%E8%AF%AD%E8%A8%80%E5%A4%84%E7%90%86.js.map");
});

it('does not add mapping directive to standalone modules', function() {
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

it('can customize the source directory', function() {
	const wiki = new $tw.Wiki(),
		pluginName = '$:/plugin',
		tiddlerName = pluginName + "/file.js",
		text = 'exports.test = true; // comment',
		tiddlers = [
			{title: tiddlerName, type: 'application/javascript', text: text, "module-type": "library"}];
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers, {ugly: true});
	wiki.addTiddler($tw.utils.test.noCache());
	$tw.utils.test.exec(wiki, "sourcemap", "yes");
	$tw.utils.test.exec(wiki, "sourceDirectory", "my/dir");
	expect(clientEval(wiki, tiddlerName)).toContain("=my/dir/plugin/file.js");
	$tw.utils.test.exec(wiki, "sourceDirectory", "source/");
	expect(clientEval(wiki, tiddlerName)).toContain("=source/plugin/file.js");
	$tw.utils.test.exec(wiki, "sourceDirectory", ".");
	expect(clientEval(wiki, tiddlerName)).toContain("=./plugin/file.js");
	// This makes the path absolute, which is very tricky, but allowed.
	$tw.utils.test.exec(wiki, "sourceDirectory", "/source");
	expect(clientEval(wiki, tiddlerName)).toContain("=/source/plugin/file.js");
	$tw.utils.test.exec(wiki, "sourceDirectory", "/");
	expect(clientEval(wiki, tiddlerName)).toContain("=/plugin/file.js");
	// Local paths work too
	$tw.utils.test.exec(wiki, "sourceDirectory", "..");
	expect(clientEval(wiki, tiddlerName)).toContain("=../plugin/file.js");
	// Filter
	$tw.utils.test.exec(wiki, "sourceDirectory", "[[x-]addsuffix<version>]");
	expect(clientEval(wiki, tiddlerName)).toContain("=x-"+$tw.version+"/plugin/file.js");
	// Illegal characters
	$tw.utils.test.exec(wiki, "sourceDirectory", "x?#$:");
	expect(clientEval(wiki, tiddlerName)).toContain("=x%3F%23$:/plugin/file.js");
});

});
