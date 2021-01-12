/*\
title: test/uglify.js
type: application/javascript
tags: $:/tags/test-spec

Tests the uglify compressor.
\*/

var js = require("$:/plugins/flibbles/uglify/javascript/uglify");

function renderTiddler(wiki, pluginTitle) {
	var renderText =  "<$tiddler tiddler='"+pluginTitle+"'><$view field='text' format='text' /></$tiddler>";
	return wiki.renderText("text/plain", "text/vnd.tiddlywiki",renderText)
};

function exec(input) {
	var wiki = new $tw.Wiki();
	wiki.addTiddler({title: '$:/boot/bootprefix.js', text: input, type: 'application/javascript'});
	var text = renderTiddler(wiki, '$:/boot/bootprefix.js');
	var wrap = "(function(module,exports) {(function(){\n"+text+"\n;})();\nreturn exports;\n})\n";
	var method = eval(wrap);
	var module = {exports: Object.create(null)};
	method(module, module.exports);
	return module.exports;
};

describe('javascript uglify', function() {

it('modules', function() {
	var exports = exec("exports.add = function(first, second) {return first + second; }");
	expect(exports.add(4,6)).toBe(10);
});

it('notifies which file caused a failure', function() {
	var error;
	var text =  "exports.run = function(number) { if (isNaN(x)) { return 'not ";
	var wiki = new $tw.Wiki();
	wiki.addTiddler({title: '$:/boot/bootprefix.js', text: text, type: 'application/javascript'});
	var method = function() {
		try {
			renderTiddler(wiki, '$:/boot/bootprefix.js');
		} catch (e) {
			error = e;
			throw e;
		}
	};
	expect(method).toThrow();
	expect(error.filename).toBe('$:/boot/bootprefix.js');
});

/*
it('can handle backticks?', function() {
	try {
	var exports = exec('var run = function(status) { return `backticks are ${status}`; }');
	expect(exports.run('broken')).toBe('backticks are broken');
	} catch (err) {
		console.log(err);
	}
});
*/

});
