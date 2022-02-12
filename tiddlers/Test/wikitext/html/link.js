/*\
title: Test/wikitext/html/link.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with html attributes
which contain more wikitext.

\*/

describe('wikitext uglifier', function() {
describe('html', function() {
describe('nested', function() {

const test = $tw.utils.test.wikitext.test;

it('removes unnecessary to attributes', function() {
	test('<$link to=<<currentTiddler>>>Link</$link>', '<$link>Link');
	test('<$link to=<<currentTiddler   >>>Link</$link>', '<$link>Link');
	test('<$link to={{!!title}}>Link</$link>', '<$link>Link');
	// These ones should not convert
	test('<$link to=<< currentTiddler>>>Link</$link>', '<$link to << currentTiddler>>>Link');
	test('<$link to=<<currentTiddler val>>>Link</$link>', '<$link to=<<currentTiddler val>>>Link');
	test('<$link to={{!!title }}>Link</$link>', '<$link to={{!!title }}>Link');
	test('<$link to={{ !!title}}>Link</$link>', '<$link to={{ !!title}}>Link');
	test('<$link to={{!! title}}>Link</$link>', '<$link to={{!! title}}>Link');
	test('<$link class=butts to=<<currentTiddler>>>Link</$link>', '<$link class=butts>Link');
});

it('compresses nested tooltip attr', function() {
	test('<$link tooltip="<$text  text=stuff/>">Link',
	     '<$link tooltip="<$text text=stuff/>">Link');
	test('<$link tooltip=<<text  text>>>Link',
	     '<$link tooltip=<<text text>>>Link');
});

});});});
