/*\
title: Demo/wc.js
caption: Javascript
type: application/javascript
tags: Demo
module-type: filteroperator

This simple filter returns a wordcount for each tiddler passed in as a source.

The operand specifies which field whose text to count (defaults to text).

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

exports.wc = function(source, operator, options) {
	var results = [];
	var field = operator.operand || "text";
	if (field == "title") {
		source(function(tiddler, title) {
			results.push(count(title).toString());
		});
	} else {
		source(function(tiddler, title) {
			if (tiddler) {
				var c = count(tiddler.fields[field]);
				results.push(c.toString());
			} else {
				results.push("0");
			}
		});
	}
	return results
};

function count(str) {
	if (!str) {
		return 0;
	} else {
		var array = str.split(/[^\w\.'\u2019]+/);
		var count = 0;
		for (var i = 0; i < array.length; i++) {
			if (array[i].length > 0) {
				count++;
			}
		}
		return count;
	}
}

})();
