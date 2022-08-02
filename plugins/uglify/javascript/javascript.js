var logger = require('../logger.js');
var utils = require('../utils.js');
var uglifyjs = require('./uglify.js');

exports.type = "application/javascript";

exports.uglify = function(text, options) {
	var code = {},
		title = options && options.title;
	code.text = text;
	var options = {
		toplevel: !utils.isSystemTarget(title), // top level can be minified. These are modules.
		sourceMap: {},
		output: {quote_style: 1}}; // single quotes. Smaller in TW.
	var results = uglifyjs.minify(code, options);
	if (results.error) {
		throw results.error;
	}
	return {text: results.code, map: results.map};
};
