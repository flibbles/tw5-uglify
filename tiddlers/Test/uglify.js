/*\
title: Test/uglify.js
type: application/javascript
tags: $:/tags/test-spec

Tests the uglify compressor.
\*/

const logger = require('$:/plugins/flibbles/uglify/logger.js');
const compresser = require('$:/plugins/flibbles/uglify/javascript/uglify.js');

function compress(input, title) {
	title = title || 'test';
	return compresser.compress(input, title);
};

function exec(text) {
	var wrap = "(function(module,exports) {(function(){\n"+text+"\n;})();\nreturn exports;\n})\n";
	var method = eval(wrap);
	var module = {exports: Object.create(null)};
	method(module, module.exports);
	return module.exports;
};

describe('javascript uglify', function() {

it('modules', function() {
	var text = compress("exports.add = function(first, second) {return first + second; }");
	var exports = exec(text);
	expect(exports.add(4,6)).toBe(10);
});

it('prefers single quotes', function() {
	var text = compress("exports.singles = 'singles';\nexports.doubles = \"doubles\";");
	expect(text).not.toContain('"');
	const exports = exec(text);
	expect(exports.singles).toBe('singles');
	expect(exports.doubles).toBe('doubles');
});

it('minifies variables at top level scope', function() {
	const text = compress('var counterVar=0;\nexports.count = function() { return counterVar++; }');
	expect(text).not.toContain('counterVar');
	const exports = exec(text);
	expect(exports.count()).toBe(0);
	expect(exports.count()).toBe(1);
	expect(exports.count()).toBe(2);
});

it('throws useful error on failure', function() {
	var error;
	var text =  "exports.run = function(number) { if (isNaN(x)) { return 'not ";
	try {
		compress(text, 'Luigi.js');
		fail('Javascript should have caused an error to be thrown')
	} catch (error) {
		expect(error.filename).toBe('Luigi.js');
		expect(error.line).toBe(1);
	}
});

/*
it('can handle backticks?', function() {
	try {
	var text = compress('var run = function(status) { return `backticks are ${status}`; }');
	var exports = exec(text);
	expect(exports.run('broken')).toBe('backticks are broken');
	} catch (err) {
		console.log(err);
	}
});
*/

});
