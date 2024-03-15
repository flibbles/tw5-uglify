var logger = require('../logger.js');
var utils = require('../utils.js');
var uglifyjs = require('./uglify.js');

exports.type = "application/javascript";

exports.uglify = function(text, options) {
	var files = Object.create(null),
		title = options && options.title,
		isModule = !utils.isSystemTarget(options.wiki, title);
	// Since we treat the map file as being in the same directory as the
	// source, we need to give the map file an adjacent path to the source
	files[encodeURIComponent(basename(title))] = text;
	var options = {
		toplevel: isModule, // top level can be minified. These are modules.
		module: false,
		sourceMap: {},
		output: {quote_style: 1}}; // single quotes. Smaller in TW.
	var results = uglifyjs.minify(files, options);
	if (results.error) {
		throw results.error;
	}
	if (isModule) {
		// It's too dangerous to strip wraps from system javascript,
		// but we can do it to all the modules.
		stripFunctionWrap(results);
	}
	return {text: results.code, map: results.map};
};

function basename(path) {
	return path.substr(path.lastIndexOf('/') + 1);
};

var fluffWrapper = "!function(){";
var fluffClose = "}();";

function stripFunctionWrap(results) {
	if (containsFunctionWrap(results.code)) {
		var map = JSON.parse(results.map);
		var newMappings = removeFirstTwoEntries(map.mappings);
		if (newMappings !== null) {
			results.code = results.code.slice(fluffWrapper.length, -fluffClose.length);
			map.mappings = newMappings;
			results.map = JSON.stringify(map);
		}
	}
};

function containsFunctionWrap(code) {
	return (code.indexOf(fluffWrapper) === 0
		&& code.lastIndexOf(fluffClose) === code.length-fluffClose.length);
	// In theory, the module might not be singly-wrapped. It might have
	// two methods, one proceeding the other, but we don't actually have
	// to worry about those cases, because it'll still work out when
	// TiddlyWiki puts its own wrapping around it.
	// So no counting parentheses for us!!
};

// Snags and translates the first three entries, and creates a single entry
// to replace them that points directly to the third.
function removeFirstTwoEntries(mapping) {
	var ptrs = [],
		newPtr = [],
		comma = 0;
	// Get the 3rd comma
	while (ptrs.length < 3) {
		var next = mapping.indexOf(",", comma);
		if (next < 0) {
			// We're not finding the three entries like expected.
			return null;
		}
		ptrs.push(toNum(mapping.substring(comma, next)));
		comma = next+1;
	}
	if (ptrs[0][0] !== 0 || ptrs[1][0] !== 1) {
		// First two should always be: AA..,CA..,
		// If not, then it's not what we expected. Abort.
		return null;
	}
	// What was at position x should now be at position x-wrapper, or likely 0.
	newPtr[0] = ptrs[0][0] + ptrs[1][0] + ptrs[2][0] - fluffWrapper.length;
	// Sum the source, row, and column of all three to get absolute locations
	newPtr[1] = ptrs[0][1] + ptrs[1][1] + ptrs[2][1];
	newPtr[2] = ptrs[0][2] + ptrs[1][2] + ptrs[2][2];
	newPtr[3] = ptrs[0][3] + ptrs[1][3] + ptrs[2][3];
	if (ptrs[2][4] !== undefined) {
		newPtr[4] = (ptrs[0][4] || 0) + (ptrs[1][4] || 0) + ptrs[2][4];
	}
	// We also want to remove the last two mappings.
	var lastComma = mapping.lastIndexOf(",");
	lastComma = mapping.lastIndexOf(",", lastComma-1);
	return toQLT(newPtr) + mapping.substring(comma-1,lastComma);
};

const h64map = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function toQLT(array) {
	var string = "";
	for (var i = 0; i < array.length; i++) {
		var number = array[i];
		var bits = 0;
		if (number < 0) {
			bits = 1;
			number = -number;
		}
		bits += (number * 2) & 30;
		number >>= 4;
		while (number > 0) {
			string += h64map[bits + 32];
			bits = number & 31;
			number >>= 5;
		}
		string += h64map[bits];
	}
	return string;
};

function toNum(letters) {
	var array = [];
	for (var i = 0; i < letters.length; i++) {
		var number = h64map.indexOf(letters[i]);
		var sign = number & 1;
		var continuation = !!(number & 32)
		number = (number & 30) >> 1;
		var significants = 4
		while (i < letters.length && continuation) {
			i++;
			var next = h64map.indexOf(letters[i]);
			number += (next & 31) << significants;
			significants += 5;
			continuation = !!(next & 32)
		}
		if (sign) {
			number = -number;
		}
		array.push(number);
	}
	return array;
};
