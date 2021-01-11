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

it("configurable stubbing", function() {
	var renderText =  "<$tiddler tiddler='$:/plugins/flibbles/uglify'><$view field='text' format='htmlencoded' /></$tiddler>",
		text,
		wiki = addPlugin("$:/plugins/flibbles/uglify", [
			{title: "elephant", tags: "$:/tags/flibbles/uglify/Stub"},
			{title: "zebra"}]);

	// unspecified should stub on NodeJS
	text = wiki.renderText("text/html", "text/vnd.tiddlywiki",renderText)
	expect(text).toContain('elephant');
	expect(text).not.toContain('zebra');
	
	// yes should stub
	wiki.addTiddler({title: '$:/config/flibbles/uglify/stub', text: 'yes'});
	text = wiki.renderText("text/html", "text/vnd.tiddlywiki",renderText)
	expect(text).toContain('elephant');
	expect(text).not.toContain('zebra');

	// no should not stub, but it will compress
	wiki.addTiddler({title: '$:/config/flibbles/uglify/stub', text: 'yes'});
	text = wiki.renderText("text/html", "text/vnd.tiddlywiki",renderText)
	expect(text).toContain('elephant');
	expect(text).not.toContain('zebra');
});

});
