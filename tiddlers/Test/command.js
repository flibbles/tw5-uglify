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
	const wiki = exec(new $tw.Wiki(), 'compress', 'no');
	expect(wiki.compressionEnabled()).toBe(false);
});

it('can set multiple properties', function() {
	const wiki = exec(new $tw.Wiki(), 'compress', 'no', 'cache', 'yes');
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
	var warnings = $tw.utils.test.collect(logger, 'warn', function() {
		const wiki = exec(new $tw.Wiki(), 'silly', 'yes');
	});
	expect(warnings[0]).toContain('Unrecognized configuration flag: silly');
});

it('can work with string arrays', function() {
	const wiki = exec(new $tw.Wiki(), 'blacklist', 'A B [[C D]]');
	expect(wiki.getTiddlerText(prefix + 'blacklist')).toBe('A B [[C D]]');
});

it('prints out current settings with no arguments', function() {
	const wiki = exec(new $tw.Wiki(), 'cache', 'bananas', 'blacklist', 'pluginA [[plugin B]]');
	const log = $tw.utils.test.collect(console, 'log', () => exec(wiki));
	expect(log).toEqual([
		'compress:       yes',
		'blacklist:      pluginA,plugin B',
		'stub:           yes',
		'cache:          bananas',
		'cacheDirectory: ./.cache',
	]);
});

});
