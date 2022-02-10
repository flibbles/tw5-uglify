/*\
title: Test/wikimethod.js
type: application/javascript
tags: $:/tags/test-spec

This ensures that only a stub of the plugin shows up on the browser.

\*/

const logger = require('$:/plugins/flibbles/uglify/logger.js');

describe('wikimethod: getTiddlerUglifiedText', function() {

async function getTiddlerUglifiedTextAsync(wiki, name) {
	function promises() {
		var results, savePromise;
		var resultsPromise = new Promise((resolveResults, rejectResults) => {
			savePromise = new Promise((resolveSave, rejectSave) => {
				try {
					results = wiki.getTiddlerUglifiedText(name, {
						onSave: function(err, saved) {
							err ? rejectSave(err) : resolveSave(saved);
						}
					});
					resolveResults(results);
				} catch (e) {
					rejectResults(e);
				}
			});
		});
		return Promise.all([resultsPromise, savePromise]);
	};
	var array = await promises();
	return array[0];
};

it('passes through nonuglifiable tiddlers', function() {
	var wiki = new $tw.Wiki();
	wiki.addTiddlers([
		{title: 'nonUglify',
		 text: 'pass through',
		 type: 'text/x-markdown'}]);
	expect(wiki.getTiddlerUglifiedText('nonUglify')).toEqual('pass through');
});

it('on failure, be graceful', async function() {
	// We test many things in this beastly test...
	const pluginName = 'plugin_' + $tw.utils.test.uniqName();
	const filepath = './.cache/uglify/' + pluginName + '.tid';
	const goodText = 'exports.func = function(argName) {return argName;}';
	const badText = 'function func() { content does not compile;';
	const tiddlers = [
		{title: 'bad.js', type: 'application/javascript', text: badText},
		{title: 'good.js', type: 'application/javascript', text: goodText}];

	const wiki = new $tw.Wiki();
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers);
	spyOn(console, 'log');
	spyOn(logger, 'alert');
	const text = await getTiddlerUglifiedTextAsync(wiki, pluginName);
	// Test: The bad code is there, uncompressed but usable
	expect(text).toContain(badText);
	// Test: The good code is still fully compressed
	expect(text).toContain('exports.func');
	expect(text).not.toContain('argName');
	expect(console.log.calls.count()).toEqual(1);

	// Test: The logged error is helpful
	expect(logger.alert.calls.count()).toEqual(1);
	var error = logger.alert.calls.mostRecent().args.join(' ');
	expect(error).toContain('bad.js');
	expect(error).toContain('line: 1');

	// The rest of this test concerns node.js file caching
	if($tw.node) {
		const fs = require('fs/promises');
		// Test: A filecache was created
		await fs.access(filepath);

		const wiki2 = new $tw.Wiki();
		$tw.utils.test.addPlugin(wiki2, pluginName, tiddlers);
		// Test: We can get the file again without any logging or errors
		const text2 = wiki.getTiddlerUglifiedText(pluginName);
		// Test: Expect the results to be identical
		expect(text2).toBe(text);
		await fs.rm(filepath);
	}
});

it('can toggle particular uglifiers', async function() {
	const pluginName = "plugin_" + $tw.utils.test.uniqName();
	const filepath = './.cache/uglify/' + pluginName + '.tid';
	const javascript = 'exports.jsPresent = function(arg) {return arg;}';
	const stylesheet = '/* comment */\n.class { cssPresent: red; }';
	const tiddlers = [
		{title: 'test.js', text: javascript, type: 'application/javascript'},
		{title: 'test.css', text: stylesheet, type: 'text/css'}];
	const wiki = new $tw.Wiki();
	var fs, content;
	spyOn(console, 'log');
	$tw.utils.test.addPlugin(wiki, pluginName, tiddlers);
	var output = await getTiddlerUglifiedTextAsync(wiki, pluginName);
	expect(output).toContain('jsPresent');
	expect(output).toContain('cssPresent');
	expect(output).not.toContain('argName');
	expect(output).not.toContain('comment');

	if ($tw.node) {
		fs = require('fs/promises');
		content = await fs.readFile(filepath);
		expect(output).toContain('jsPresent');
		expect(output).toContain('cssPresent');
		expect(output).not.toContain('argName');
		expect(output).not.toContain('comment');
	}

	// But now we disable css
	wiki.addTiddler($tw.utils.test.setting('text/css', 'no'));
	var output = await getTiddlerUglifiedTextAsync(wiki, pluginName);
	expect(output).toContain('jsPresent');
	expect(output).toContain('cssPresent');
	expect(output).not.toContain('argName');
	expect(output).toContain('comment');

	if($tw.node) {
		content = await fs.readFile(filepath);
		expect(output).toContain('jsPresent');
		expect(output).toContain('cssPresent');
		expect(output).not.toContain('argName');
		expect(output).toContain('comment');
		await fs.rm(filepath);
	}
});

it('adds directives to boot files', function() {
	const wiki = new $tw.Wiki(),
		boot = '$:/boot/boot.js',
		text = 'exports.func = function(argName) {return argName;}';
	wiki.addTiddler($tw.utils.test.noCache());
	wiki.addTiddler({title: boot, text: text, type: "application/javascript"});
	spyOn(console, 'log');
	expect(wiki.getTiddlerUglifiedText(boot)).toContain("sourceURL=");
	wiki.addTiddler({title: "$:/state/flibbles/uglify/server", text: "yes"});
	expect(wiki.getTiddlerUglifiedText(boot)).toContain("sourceMappingURL=");
	// Without sourcemapping can be controlled through configuration
	wiki.addTiddler($tw.utils.test.setting("sourcemap", "no"));
	expect(wiki.getTiddlerUglifiedText(boot)).toContain("sourceURL=");
	wiki.addTiddler($tw.utils.test.setting("sourcemap", "yes"));
	expect(wiki.getTiddlerUglifiedText(boot)).toContain("sourceMappingURL=");
	// If compression is disabled, so is sourcemapping
	wiki.addTiddler($tw.utils.test.noCompress());
	expect(wiki.getTiddlerUglifiedText(boot)).toContain("sourceURL=");
	wiki.addTiddler($tw.utils.test.yesCompress());
	expect(wiki.getTiddlerUglifiedText(boot)).toContain("sourceMappingURL=");
	// If javascript in particular is disabled, then so is sourcemapping
	wiki.addTiddler($tw.utils.test.setting("application/javascript", "no"));
	expect(wiki.getTiddlerUglifiedText(boot)).toContain("sourceURL=");
	wiki.addTiddler($tw.utils.test.setting("application/javascript", "yes"));
	expect(wiki.getTiddlerUglifiedText(boot)).toContain("sourceMappingURL=");
	// blacklisting a plugin disables for all containing javascript
	wiki.addTiddler($tw.utils.test.setting("blacklist", boot + " cats"));
	expect(wiki.getTiddlerUglifiedText(boot)).toContain("sourceURL=");
	wiki.addTiddler($tw.utils.test.setting("blacklist", "cats"));
	expect(wiki.getTiddlerUglifiedText(boot)).toContain("sourceMappingURL=");
});

it('adds directives to boot file that already has directives', function() {
	const wiki = new $tw.Wiki(),
		boot = '$:/boot/boot.js',
		text = 'exports.func = function(argName) {return argName;}\n\n//# sourceURL='+boot;
	wiki.addTiddler($tw.utils.test.noCache());
	wiki.addTiddler({title: boot, text: text, type: "application/javascript"});
	spyOn(console, 'log');
	expect(wiki.getTiddlerUglifiedText(boot)).toContain("sourceURL=");
	expect(wiki.getTiddlerUglifiedText(boot)).not.toContain("sourceMappingURL=");
	wiki.addTiddler({title: "$:/state/flibbles/uglify/server", text: "yes"});
	expect(wiki.getTiddlerUglifiedText(boot)).toContain("sourceMappingURL=");
	expect(wiki.getTiddlerUglifiedText(boot)).not.toContain("sourceURL=");
});

it('does not add directives to css boot file', function() {
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
	expect(map.sources[0]).toBe('$:/boot/boot.js');
	// Now for bootprefix
	wiki.addTiddler({title: "$:/boot/bootprefix.js", text: javascript, type: 'application/javascript'});
	map = wiki.getTiddlerSourceMap('$:/boot/bootprefix.js');
	expect(map.mappings[0]).not.toBe(';');
	expect(map.sources[0]).toBe('$:/boot/bootprefix.js');
});

it('gets undefined source maps for non-javascript tiddlers', function() {
	const wiki = new $tw.Wiki();
	// non-existent
	expect(wiki.getTiddlerSourceMap("nothing.js")).toBeUndefined();
	wiki.addTiddler({title: "wikitext", text: "This is wikitext"});
	expect(wiki.getTiddlerSourceMap("wikitext")).toBeUndefined();
});

});
