/*\
title: Test/utils.js
type: application/javascript
module-type: utils

Utilities for testing. This makes them all accessable from $tw.utils.test.
Maybe this is an anti-pattern, but today it seems preferable to 'require'ing
this file in all the test suites.

\*/

var test = exports.test = Object.create(null);

test.addPlugin = function(wiki, pluginName, tiddlers, options) {
	wiki.addTiddler(test.newPlugin(pluginName, tiddlers, options));
	wiki.registerPluginTiddlers("plugin");
	wiki.readPluginInfo();
	wiki.unpackPluginTiddlers();
};

test.newPlugin = function(pluginName, tiddlers, options) {
	options = options || {};
	var tiddlerHash = Object.create(null);
	$tw.utils.each(tiddlers, function(hash) {
		var fieldsHash = Object.create(null);
		for (var field in hash) {
			if (field !== 'title') {
				fieldsHash[field] = hash[field];
			}
		}
		tiddlerHash[hash.title] = fieldsHash;
	});
	var content = { tiddlers: tiddlerHash }
	if (options.ugly !== undefined) {
		content.ugly = options.ugly;
	}
	return new $tw.Tiddler({
		title: pluginName,
		type: "application/json",
		"plugin-type": "plugin",
		description: options.description || undefined,
		text: JSON.stringify(content)});
}

test.uniqName = function() {
	var bit = (Date.now() % 1000000).toString();
	return bit + Math.floor(Math.random() * 1000000);
};

test.exec = function(wiki, /* arguments */) {
	const args = Array.prototype.slice.call(arguments, 1);
	const command = new $tw.commands.uglify.Command(args, {wiki: wiki});
	command.execute();
	return wiki;
};

test.setting = function(key, value) {
	return {title: '$:/config/flibbles/uglify/' + key, text: value};
};

test.noCache = () => test.setting('cache', 'no');
test.noCompress = () => test.setting('compress', 'no');
test.yesCompress = () => test.setting('compress', 'yes');
test.blacklist = (list) => test.setting('blacklist', $tw.utils.stringifyList(list));
