/*\
title: Test/configuration.js
type: application/javascript
tags: $:/tags/test-spec

This ensures that only a stub of the plugin shows up on the browser.

\*/

const logger = require('$:/plugins/flibbles/uglify/logger.js');

describe('Configuration', function() {

function renderTiddler(wiki, pluginTitle) {
	var renderText =  "<$tiddler tiddler='"+pluginTitle+"'><$view field='text' format='htmlencoded' /></$tiddler>";
	return wiki.renderText("text/html", "text/vnd.tiddlywiki",renderText)
};

it("javascript setting", function() {
	var name = "$:/plugins/flibbles/whatever";
	var tiddlers = [
			{title: "readme", text: "This is the readme text"},
			{title: "code.js", type: "application/javascript", text: "function func(longArgName) {return longArgName;}"}];
	const wiki = new $tw.Wiki();
	$tw.utils.test.addPlugin(wiki, name, tiddlers);
	// Let's not worry about caching for this test.
	wiki.addTiddler($tw.utils.test.noCache);
	var text;
	var log = $tw.utils.test.collect(console, 'log', function() {
		text = renderTiddler(wiki, name);
	});
	expect(text).toContain('readme text');
	expect(text).not.toContain('longArgName');
	expect(log[0]).toContain('uglify: Compressing: $:/plugins/flibbles/whatever');

	// The same wiki should be alterable without worrying about cached values
	wiki.addTiddler({title: '$:/config/flibbles/uglify/compress', text:'no'});
	text = renderTiddler(wiki, name);
	expect(text).toContain('readme text');
	expect(text).toContain('longArgName');

	// The same wiki should be alterable without worrying about cached values
	wiki.addTiddler({title: '$:/config/flibbles/uglify/compress', text:'yes'});
	text = renderTiddler(wiki, name);
	expect(text).toContain('readme text');
	expect(text).not.toContain('longArgName');
});

it('javascript settings and boot code', function() {
	var wiki = new $tw.Wiki();
	wiki.addTiddlers([
		{title: "$:/boot/boot.js", text: "function func(longArgName) {return longArgName;}"},
		{title: "$:/boot/bootprefix.js", text: "function func(longPrefixName) {return longPrefixName;}"}]);

	expect(renderTiddler(wiki, "$:/boot/boot.js")).not.toContain('longArgName');
	expect(renderTiddler(wiki, "$:/boot/bootprefix.js")).not.toContain('longPrefixName');

	wiki.addTiddler({title: '$:/config/flibbles/uglify/compress', text:'no'});
	expect(renderTiddler(wiki, "$:/boot/boot.js")).toContain('longArgName');
	expect(renderTiddler(wiki, "$:/boot/bootprefix.js")).toContain('longPrefixName');

	wiki.addTiddler({title: '$:/config/flibbles/uglify/compress', text:'yes'});
	expect(renderTiddler(wiki, "$:/boot/boot.js")).not.toContain('longArgName');
	expect(renderTiddler(wiki, "$:/boot/bootprefix.js")).not.toContain('longPrefixName');
});

it("stub setting", function() {
	var name = "$:/plugins/flibbles/uglify";
	var text;
	var tiddlers = [
			{title: "elephant", tags: "$:/tags/flibbles/uglify/Stub"},
			{title: "zebra"},
			{title: "code.js", type: "application/javascript", text: "function func(longArgName) {return longArgName;}"}];

	const wiki = new $tw.Wiki();
	$tw.utils.test.addPlugin(wiki, name, tiddlers);
	// Let's not worry about caching for this test
	wiki.addTiddler($tw.utils.test.noCache);

	// no should not stub on either Node or browser, but it will compress
	wiki.addTiddler({title: '$:/config/flibbles/uglify/stub', text: 'no'});
	const log = $tw.utils.test.collect(console, 'log', function() {
		text = renderTiddler(wiki, name);
	});
	expect(text).toContain('elephant');
	expect(text).toContain('zebra');
	expect(text).toContain('code.js');
	expect(text).not.toContain('longArgName');
	expect(log[0]).toContain('uglify: Compressing: $:/plugins/flibbles/uglify');

	// yes should stub on Node.JS, but still NOT stub on browser
	wiki.addTiddler({title: '$:/config/flibbles/uglify/stub', text: 'yes'});
	text = renderTiddler(wiki, name);
	expect(text).toContain('elephant');
	if ($tw.node) {
		expect(text).not.toContain('zebra');
	} else {
		expect(text).toContain('zebra');
	}

	// unspecified should stub on Node.js. NOT stub on browser
	wiki.deleteTiddler('$:/config/flibbles/uglify/stub');
	text = renderTiddler(wiki, name);
	expect(text).toContain('elephant');
	if ($tw.node) {
		expect(text).not.toContain('zebra');
	} else {
		expect(text).toContain('zebra');
	}
});

});
