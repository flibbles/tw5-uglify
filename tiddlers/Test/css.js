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

it('handles case #71, fixed by lukasstankiewicz', function() {
	expect(compress(`@supports ((position: -webkit-sticky) or (position: sticky)) {
	.element {
		position : -webkit-sticky
		position : sticky;
	}
}`)).toBe(`@supports((position:-webkit-sticky) or (position:sticky)){.element{position:-webkit-sticky position:sticky}}`);
});

it('handles case #74', function() {
	expect(compress(`@media only screen and (min-width:768px) {
	color: #fff;
}`)).toBe(`@media only screen and (min-width:768px){color:#fff}`);
});

it('handles #72: 0deg -> 0 causes errors', function() {
	expect(compress(`.myclass {
	background: linear-gradient(0deg,rgba(105,44,145,0.3),rgba(105,44,145,0.3)),linear-gradient(0deg,rgba(0,49,131,0.3),rgba(0,49,131,0.3)),linear-gradient(90deg,rgba(0,174,239,0.9) 23.61%,rgba(0,49,131,0.0001) 99.7%);
}`)).toBe(`.myclass{background:linear-gradient(0deg,rgba(105,44,145,0.3),rgba(105,44,145,0.3)),linear-gradient(0deg,rgba(0,49,131,0.3),rgba(0,49,131,0.3)),linear-gradient(90deg,rgba(0,174,239,0.9) 23.61%,rgba(0,49,131,0.0001) 99.7%)}`);
});

it('handles #69: Incorrect minification of text-shadow', function() {
	expect(compress("p{text-shadow:0 0 0;}")).toBe("p{text-shadow:0 0}");
});

});
