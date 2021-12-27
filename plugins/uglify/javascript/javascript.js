var logger = require('../logger.js');
var uglifyjs = require('./uglify.js');

exports.type = "application/javascript";

exports.uglify = function(text, title, options) {
	var code = {};
	code[title] = text;
	var options = {
		toplevel: true, // top level can be minified. These are modules.
		output: {quote_style: 1}}; // single quotes. Smaller in TW.
	var results = uglifyjs.minify(code, options);
	options
	if (results.error) {
		var err = results.error;
		logger.warn('Failed to compress', err.filename + '.\n\n    * message:', err.message, '\n    * line:', err.line, '\n    * col:', err.col, '\n    * pos:', err.pos);
		// Return the uncompressed text as a backup
		return text;
	}
	// We want to store the sourceMap in case we need it.
	options.cache = options.cache || Object.create(null);
	options.cache.map = results.map;
	return results.code;
};

exports.map = function(text, title, options) {
	var code = {};
	code[title] = text;//"\n"+text;
	var options = {
		toplevel: true, // top level can be minified. These are modules.
		sourceMap: {},
		output: {quote_style: 1}}; // single quotes. Smaller in TW.
	var results = uglifyjs.minify(code, options);
	options
	if (results.error) {
		var err = results.error;
		logger.warn('Failed to compress', err.filename + '.\n\n    * message:', err.message, '\n    * line:', err.line, '\n    * col:', err.col, '\n    * pos:', err.pos);
		// Return the uncompressed text as a backup
		return text;
	}
	return results.map;
};
