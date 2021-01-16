/*\
title: Test/command.js
type: application/javascript
tags: $:/tags/test-spec

Tests the uglify command.

\*/

const logger = require('$:/plugins/flibbles/uglify/logger.js');
const Command = $tw.commands.uglify.Command;
const prefix = '$:/config/flibbles/uglify/';

function exec(wiki, /* arguments */) {
	const args = Array.prototype.slice.call(arguments, 1);
	const command = new Command(args, {wiki: wiki}, () => null);
	command.execute();
	return wiki;
};

describe('command', function() {

it('can toggle compression', function() {
	const wiki = exec(new $tw.Wiki(), 'javascript', 'no');
	expect(wiki.compressionEnabled()).toBe(false);
});

it('can set multiple properties', function() {
	const wiki = exec(new $tw.Wiki(), 'javascript', 'no', 'cache', 'yes');
	expect(wiki.compressionEnabled()).toBe(false);
	expect(wiki.getTiddler(prefix + 'cache').fields.text).toBe('yes');
});

it('reverts to default if no or empty value given', function() {
	const title = prefix+'cache';
	function testWiki() {
		const wiki = new $tw.Wiki();
		wiki.addTiddler({title: title, text: 'yes'});
		return wiki;
	};
	expect(exec(testWiki(), 'cache').getTiddler(title)).toBeUndefined();
	expect(exec(testWiki(), 'cache', '').getTiddler(title)).toBeUndefined();
});

it('recognizes nonexistent configuration', function() {
	var warnings = $tw.utils.test.collect(logger, 'alert', function() {
		const wiki = exec(new $tw.Wiki(), 'silly', 'yes');
	});
	expect(warnings[0]).toContain('uglify: Unrecognized configuration flag: silly');
});

it('prints out current settings with no arguments', function() {
	const wiki = new $tw.Wiki();
	const title = prefix+'cache';
	wiki.addTiddler({title: title, text: 'bananas'});
	const log = $tw.utils.test.collect(console, 'log', () => exec(wiki));
	expect(log).toEqual([
		'javascript:     yes',
		'stub:           yes',
		'cache:          bananas',
		'cacheDirectory: ./.cache',
	]);
});

});