/*\
title: Test/wikitext/html/setvariable.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with $setvariable widgets

\*/

describe('wikitext uglifier', function() {
describe('html', function() {
describe('$setvariable', function() {

const test = $tw.utils.test.wikitext.test;
const parseUtils = require("$:/plugins/flibbles/uglify/wikitext/utils.js");
const dump = "<$text text={{{[variables[]join[,]]=[variables[]!match[m]getvariable[]join[,]]+[join[;]]}}}/>";
const vars = parseUtils.letAvailable() ? "<$let" : "<$vars";

it('converts to $set', function() {
	test('<$setvariable name="v" filter="A [[B C]] +[addsuffix[s]]">'+dump,
	     '<$set filter="A[[B C]]+[addsuffix[s]]"name=v>'+dump);
});

it('converts to $let', function() {
	test('<$setvariable name="v" value="var">'+dump,
	     vars+' v=var>'+dump);
});

});});});
