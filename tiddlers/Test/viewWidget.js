/*\
title: Test/viewWidget.js
type: application/javascript
tags: $:/tags/test-spec

This ensures that only a stub of the plugin shows up on the browser.

\*/

const logger = require('$:/plugins/flibbles/uglify/logger.js');

describe('widget: view', function() {

beforeEach(function() {
	spyOn(console, 'log');
});

function renderTiddler(wiki, pluginTitle, format) {
	format = format || 'htmlencoded'
	var renderText =  "<$view tiddler='"+pluginTitle+"' field='text' format='"+format+"' />";
	return wiki.renderText("text/plain", "text/vnd.tiddlywiki",renderText)
};

it("compress setting", function() {
	var name = "$:/plugins/flibbles/whatever";
	var tiddlers = [
			{title: "$:/readme", text: "This is the readme text"},
			{title: "$:/code.js", type: "application/javascript", text: "function func(longArgName) {return longArgName;}"}];
	const wiki = new $tw.Wiki();
	$tw.utils.test.addPlugin(wiki, name, tiddlers);
	// Let's not worry about caching for this test.
	wiki.addTiddler($tw.utils.test.noCache());
	var text = renderTiddler(wiki, name);
	expect(text).toContain('readme text');
	expect(text).not.toContain('longArgName');
	expect(console.log.calls.mostRecent().args.join(' ')).toContain('uglify: Compressing: $:/plugins/flibbles/whatever');

	// The same wiki should be alterable without worrying about cached values
	wiki.addTiddler($tw.utils.test.noCompress());
	text = renderTiddler(wiki, name);
	expect(text).toContain('readme text');
	expect(text).toContain('longArgName');

	// The same wiki should be alterable without worrying about cached values
	wiki.addTiddler($tw.utils.test.yesCompress());
	text = renderTiddler(wiki, name);
	expect(text).toContain('readme text');
	expect(text).not.toContain('longArgName');
});

it('respects the blacklist', function() {
	var name = "$:/plugins/flibbles/blacklistTest";
	var tiddlers = [
			{title: "$:/readme", text: "This is the readme text"},
			{title: "$:/code.js", type: "application/javascript", text: "function func(longArgName) {return longArgName;}"}];
	const wiki = new $tw.Wiki();
	var text;
	$tw.utils.test.addPlugin(wiki, name, tiddlers);

	// Let's not worry about caching for this test.
	wiki.addTiddler($tw.utils.test.noCache());
	// Test without a blacklist
	text = renderTiddler(wiki, name);
	expect(text).toContain('readme text');
	expect(text).not.toContain('longArgName');
	expect(console.log.calls.mostRecent().args.join(' ')).toContain(name);

	// Now we use a filled out blacklist
	wiki.addTiddler($tw.utils.test.blacklist([name]));
	text = renderTiddler(wiki, name);
	expect(text).toContain('readme text');
	expect(text).toContain('longArgName');

	// Now with a blank blacklist
	wiki.addTiddler($tw.utils.test.blacklist());
	text = renderTiddler(wiki, name);
	expect(text).toContain('readme text');
	expect(text).not.toContain('longArgName');
});

it('javascript settings and boot code', function() {
	var wiki = new $tw.Wiki();
	wiki.addTiddlers([
		{title: "$:/boot/boot.js",
		 type: "application/javascript",
		 text: "exports.func = function(longArgName) {return longArgName;}"},
		{title: "$:/boot/bootprefix.js",
		 type: "application/javascript",
		 text: "exports.func = function(longPrefixName) {return longPrefixName;}"}]);
	$tw.utils.test.exec(wiki, 'cache=no sourcemap=yes');
	expect(renderTiddler(wiki, "$:/boot/boot.js")).not.toContain('longArgName');
	expect(renderTiddler(wiki, "$:/boot/bootprefix.js")).not.toContain('longPrefixName');
	expect(renderTiddler(wiki, "$:/boot/boot.js")).toContain('function');
	expect(renderTiddler(wiki, "$:/boot/bootprefix.js")).toContain('function');

	wiki.addTiddler($tw.utils.test.noCompress());
	expect(renderTiddler(wiki, "$:/boot/boot.js")).toContain('longArgName');
	expect(renderTiddler(wiki, "$:/boot/bootprefix.js")).toContain('longPrefixName');

	wiki.addTiddler($tw.utils.test.yesCompress());
	expect(renderTiddler(wiki, "$:/boot/boot.js")).not.toContain('longArgName');
	expect(renderTiddler(wiki, "$:/boot/bootprefix.js")).not.toContain('longPrefixName');
	expect(renderTiddler(wiki, "$:/boot/boot.js")).toContain('function');
	expect(renderTiddler(wiki, "$:/boot/bootprefix.js")).toContain('function');

	// Test that boot code can be blacklisted
	wiki.addTiddler($tw.utils.test.blacklist('$:/boot/boot.js'));
	expect(renderTiddler(wiki, "$:/boot/boot.js")).toContain('longArgName');
	expect(renderTiddler(wiki, "$:/boot/bootprefix.js")).not.toContain('longPrefixName');
});

it("prune settings", function() {
	var name = "$:/plugins/flibbles/uglify";
	var tiddlers = [
			{title: "$:/elephant", tags: "RemoveThis"},
			{title: "$:/zebra"},
			{title: "$:/code.js", type: "application/javascript", text: "function func(longArgName) {return longArgName;}"}];

	const wiki = new $tw.Wiki();
	// Do one before we start so we can set any caches
	// We do this because we've got to be sure those caches will reset
	var text = renderTiddler(wiki, name);
	// We use newPlugin here instead of add plugin, because importing does not
	// properly install plugins, and uglify needs to be able to deal with that.
	wiki.addTiddler($tw.utils.test.newPlugin(name, tiddlers));
	// Let's not worry about caching for this test
	wiki.addTiddler($tw.utils.test.noCache());

	// no should not prune on either Node or browser, but it will compress
	//wiki.addTiddler($tw.utils.test.setting({title: '$:/config/flibbles/uglify/stub', text: 'no'});
	wiki.addTiddler({title: "$:/plugins/flibbles/uglify/prune/uglify", text: "$:/zebra [tag[RemoveThis]]"});
	$tw.utils.test.exec(wiki, 'prune/uglify=no');
	text = renderTiddler(wiki, name);
	expect(text).toContain('$:/elephant');
	expect(text).toContain('$:/zebra');
	expect(text).toContain('$:/code.js');
	expect(text).not.toContain('longArgName');
	expect(console.log.calls.mostRecent().args.join(' ')).toContain('uglify: Compressing: $:/plugins/flibbles/uglify');

	// yes should stub on Node.JS, but still NOT stub on browser
	$tw.utils.test.exec(wiki, 'prune/uglify=yes');
	text = renderTiddler(wiki, name);
	expect(text).not.toContain('$:/elephant');
	expect(text).not.toContain('$:/zebra');
	expect(text).toContain('$:/code.js');
	expect(text).not.toContain('longArgName');
});

});
