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
	wiki.addTiddler({
		title: pluginName,
		type: "application/json",
		"plugin-type": "plugin",
		description: options.description || undefined,
		text: JSON.stringify(content)});
	wiki.registerPluginTiddlers("plugin");
	wiki.readPluginInfo();
	wiki.unpackPluginTiddlers();
};

test.uniqName = function() {
	var bit = (Date.now() % 1000000).toString();
	return bit + Math.floor(Math.random() * 1000000);
};

test.noCache = () => ({title: '$:/config/flibbles/uglify/cache', text: 'no'});
test.noCompress = () => ({title: '$:/config/flibbles/uglify/compress', text:'no'});
test.yesCompress = () => ({title: '$:/config/flibbles/uglify/compress', text: 'yes'});
test.blacklist = function(listArray) {
	return {title: '$:/config/flibbles/uglify/blacklist', text: $tw.utils.stringifyList(listArray)};
};
