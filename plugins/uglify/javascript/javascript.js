var logger = require('../logger.js');
var uglifyjs = require('./uglify.js');

exports.type = "application/javascript";

exports.uglify = function(text) {
	var code = {};
	code.text = text;
	var options = {
		toplevel: true, // top level can be minified. These are modules.
		sourceMap: {},
		output: {quote_style: 1}}; // single quotes. Smaller in TW.
	var results = uglifyjs.minify(code, options);
	if (results.error) {
		throw results.error;
	}
	// We want to store the sourceMap in case we need it.
	options.cache = options.cache || Object.create(null);
	options.cache.map = results.map;
	return {text: results.code, map: results.map};
};
