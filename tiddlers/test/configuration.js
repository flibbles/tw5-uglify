/*\
title: test/stubbing.js
type: application/javascript
tags: $:/tags/test-spec

This ensures that only a stub of the plugin shows up on the browser.

\*/

describe('Configuration', function() {

function addPlugin(pluginName, tiddlers, options) {
	options = options || {};
	var wiki = options.wiki || new $tw.Wiki();
	var tiddlerHash = Object.create(null);
	$tw.utils.each(tiddlers, function(hash) {
		tiddlerHash[hash.title] = hash;
	});
	var content = { tiddlers: tiddlerHash }
	wiki.addTiddler({
		title: pluginName,
		type: "application/json",
		"plugin-type": "plugin",
		description: options.description || undefined,
		text: JSON.stringify(content)});
	wiki.registerPluginTiddlers("plugin");
	wiki.readPluginInfo();
	wiki.unpackPluginTiddlers();
	return wiki;
};

function renderPlugin(wiki, pluginTitle) {
	var renderText =  "<$tiddler tiddler='"+pluginTitle+"'><$view field='text' format='htmlencoded' /></$tiddler>";
	return wiki.renderText("text/html", "text/vnd.tiddlywiki",renderText)
};

it("javascript setting", function() {
	var name = "$:/plugins/flibbles/whatever";
	var tiddlers = [
			{title: "readme", text: "This is the readme text"},
			{title: "code.js", type: "application/javascript", text: "function func(longArgName) {return longArgName;}"}];
	var wiki = addPlugin(name, tiddlers);
	var text = renderPlugin(wiki, name);
	expect(text).toContain('readme text');
	expect(text).not.toContain('longArgName');

	// The same wiki should be alterable without worrying about cached values
	wiki.addTiddler({title: '$:/config/flibbles/uglify/javascript', text:'no'});
	text = renderPlugin(wiki, name);
	expect(text).toContain('readme text');
	expect(text).toContain('longArgName');
});

it("stub setting", function() {
	var name = "$:/plugins/flibbles/uglify";
	var tiddlers = [
			{title: "elephant", tags: "$:/tags/flibbles/uglify/Stub"},
			{title: "zebra"},
			{title: "code.js", type: "application/javascript", text: "function func(longArgName) {return longArgName;}"}];

	// unspecified should stub on NodeJS
	var wiki = addPlugin(name, tiddlers);
	var text = renderPlugin(wiki, name);
	expect(text).toContain('elephant');
	expect(text).not.toContain('zebra');
	
	// yes should stub
	wiki = addPlugin(name, tiddlers);
	wiki.addTiddler({title: '$:/config/flibbles/uglify/stub', text: 'yes'});
	text = renderPlugin(wiki, name);
	expect(text).toContain('elephant');
	expect(text).not.toContain('zebra');

	// no should not stub, but it will compress
	wiki = addPlugin(name, tiddlers);
	wiki.addTiddler({title: '$:/config/flibbles/uglify/stub', text: 'no'});
	text = renderPlugin(wiki, name);
	expect(text).toContain('elephant');
	expect(text).toContain('zebra');
	expect(text).toContain('code.js');
	expect(text).not.toContain('longArgName');

	// no should not stub, but it will compress
	wiki = addPlugin("$:/plugins/flibbles/uglify", tiddlers);
	wiki.addTiddler({title: '$:/config/flibbles/uglify/stub', text: 'pretty'});
	text = renderPlugin(wiki, name);
	expect(text).toContain('elephant');
	expect(text).toContain('zebra');
	expect(text).toContain('code.js');
	expect(text).toContain('longArgName');
});

});
