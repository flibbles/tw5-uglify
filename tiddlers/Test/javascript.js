/*\
title: Test/javascript.js
type: application/javascript
tags: $:/tags/test-spec

Tests the uglify compressor.
\*/

const logger = require('$:/plugins/flibbles/uglify/logger.js');

describe('javascript uglifier', function() {

function compress(input, title) {
	title = title || 'test';
	return $tw.wiki.getUglifier('application/javascript').uglify(input, {title: title});
};

function exec(text) {
	var module = {exports: Object.create(null)};
	var context = {module: module, exports: module.exports};
	$tw.utils.evalGlobal(text, context, "test.js");
	return module.exports;
};

it('modules', function() {
	var text = compress("exports.add = function(first, second) {return first + second; }").text;
	var exports = exec(text);
	expect(exports.add(4,6)).toBe(10);
});

it('prefers single quotes', function() {
	var text = compress("exports.singles = 'singles';\nexports.doubles = \"doubles\";").text;
	expect(text).not.toContain('"');
	const exports = exec(text);
	expect(exports.singles).toBe('singles');
	expect(exports.doubles).toBe('doubles');
});

it('minifies variables at top level scope', function() {
	const text = compress('var counterVar=0;\nexports.count = function() { return counterVar++; }').text;
	expect(text).not.toContain('counterVar');
	const exports = exec(text);
	expect(exports.count()).toBe(0);
	expect(exports.count()).toBe(1);
	expect(exports.count()).toBe(2);
});

it('generates source map', function() {
	var pretty = "exports.add = function(first, second) {return first + second; }";
	var text = compress(pretty, "directory/test.js").map;
	// The first mapping should point to the "exports".
	expect(text).toContain("\"AAAAA,");
});

it('can handle backticks?', function() {
	var text = compress('exports.run = function(status) { return `backticks are ${status}`; }').text;
	expect(text).not.toContain("status");
	var exports = exec(text);
	expect(exports.run('working')).toBe('backticks are working');
});

function removeWrapping(text, expectedNewMapping, log) {
	var results = compress(text);
	var ugly = results.text
	expect(ugly).toContain('function');
	expect(ugly).toContain('use strict');
	// Function shouldn't show up twice.
	expect(ugly.substr(ugly.indexOf('function')+8)).not.toContain('function');
	expect(results.map).toContain('"' + expectedNewMapping + ',');
	if (log) {
		console.log("###");
		console.log(text);
		console.log("---");
		console.log(ugly);
		console.log("---");
		console.log(results.map);
		console.log("###");
	}
	//*/
	results.exports = exec(ugly);
	return results;
};

it('can remove wrapping functions', function() {
	var pretty = '/**Function stuff\n */\n(function() {\n"use strict";\nexports.identity = function() {};\n                  })();';
	expect(removeWrapping(pretty, "AAGA").exports.identity()).toBe(undefined);
	// Test with some indentation
	pretty = '/**Function stuff\n */\n       (     function() {\n   "use strict";\nexports.factorial = function(number) { return number * (number + 1) / 2; }\n})();';
	expect(removeWrapping(pretty, "AAGG").exports.factorial(5)).toBe(15);
	// Test with some crazy indentation
	pretty = '/**Function stuff\n */\n'+' '.repeat(645)+'(function() {\n\t"use strict";\nexports.factorial = function(number) { return number * (number + 1) / 2; }\n})();';
	expect(removeWrapping(pretty, "AAGC").exports.factorial(5)).toBe(15);
	// Test with a lot of newlines
	pretty = '/**Function stuff'+'\n'.repeat(530)+'*/\n(function() {\n"use strict";\nexports.factorial = function(number) { return number * (number + 1) / 2; }\n})();';
	expect(removeWrapping(pretty, "AAohBA").exports.factorial(5)).toBe(15);
});

it('can remove wrapping from nothing', function() {
	var pretty = '(function() {\n"use strict";\n})();';
	var results = compress(pretty);
	expect(results.text).toBe('');
	expect(results.map).toContain('"mappings":""');
});

// Apparently, we don't even have to consider the possibility of twin-wrapping,
// because it still works.
// We still test this in case TiddlyWiki's behavior ever changes.
it('handles unwrapping twin-wrapped modules', function() {
	var pretty = '(function() {"use strict";\nexports.a = 5;})();\n(function() {"use strict"; exports.b = 6;})();';
	var results = compress(pretty);
	var exports = exec(results.text);
	expect(exports.a).toBe(5);
	expect(exports.b).toBe(6);
});

});
