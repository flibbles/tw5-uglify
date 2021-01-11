/*\
title: test/uglify.js
type: application/javascript
tags: $:/tags/test-spec

Tests the uglify compressor.
\*/

var js = require("$:/plugins/flibbles/uglify/javascript/uglify");

function exec(input) {
	var output = js.compress(input);
	var wrap = "(function(module,exports) {(function(){\n"+output+"\n;})();\nreturn exports;\n})\n";
	var method = eval(wrap);
	var module = {exports: Object.create(null)};
	method(module, module.exports);
	return module.exports;
};

describe('javascript compressor', function() {

it('modules', function() {
	var exports = exec("exports.add = function(first, second) {return first + second; }");
	expect(exports.add(4,6)).toBe(10);
});

});
