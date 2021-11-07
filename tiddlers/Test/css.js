/*\
title: Test/css.js
type: application/javascript
tags: $:/tags/test-spec

Tests the uglify compressor.
\*/

const logger = require('$:/plugins/flibbles/uglify/logger.js');

describe('stylesheet uglifier', function() {

function compress(input, title) {
	title = title || 'test';
	return $tw.wiki.getUglifier('text/css').uglify(input, title);
};

it('handles', function() {
	var text = compress(`/*comments*/
	.myclass {
		background-color: #FFFFFF;
		color: #000;
	}
	`);
	expect(text).toBe(".myclass{background-color:#fff;color:#000}");
});

it('deals with errors', function() {
	// This doesn't throw an error. I don't know what does.
	var badCss = ".myclass}color:#00";
	var text = compress(badCss);
	expect(text).toBe(badCss);
});

});
