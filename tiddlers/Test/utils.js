/*\
title: Test/utils.js
type: application/javascript
module-type: utils

Utilities for testing. This makes them all accessable from $tw.utils.test.
Maybe this is an anti-pattern, but today it seems preferable to 'require'ing
this file in all the test suites.

\*/

var test = exports.test = Object.create(null);

test.collect = function(container, logMethod, block) {
	var oldLog = container[logMethod];
	var messages = [];
	container[logMethod] = function(/* args */) {
		messages.push(Array.prototype.join.call(arguments, ' '));
	};
	try {
		block();
	} finally {
		container[logMethod] = oldLog;
	}
	return messages;
};
