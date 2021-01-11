/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

exports.compress = function(text) {
	var output = '';
	var index = 0;
	var start = 0;
	var memory = -1;
	try {
	while (index < text.length) {
		if (index < memory) {
			throw "What the fuck?"
		}
		memory = index;
		var c = text[index];
		switch(c) {
			case '/':
				var cn = text[index+1];
				if (cn === '*') {
					output += text.substring(start, index);
					var end = text.indexOf('*/', index+2);
					if (end < 0) {
						console.log("premature end to block comment");
						return output;
					}
					start = index = end+2;
					break;
				} else if (cn === '/') {
					output += text.substring(start, index);
					var end = text.indexOf('\n', index+2);
					if (end < 0) {
						end = text.length;
					}
					start = index = end;
				}
				index++;
				break;
			case '"':
				index = indexOfClose(text, index, '"') + 1;
				break;
			case "'":
				index = indexOfClose(text, index, "'") + 1;
				break;
			default:
				index++;
		}
	}
	output += text.substr(start);
	return output;
	} catch(e) {
		console.log(text.substr(index));
		throw e;
	}
};

function indexOfClose(text, index, type) {
	while (true) {
		index += 1;
		var close = text.indexOf(type, index);
		var slash = text.indexOf('\\', index);
		if (slash >= 0 && slash < close) {
			index = slash+1;
		} else if (close >= 0) {
			return close+1;
		} else {
			// Huh. Unclosed quote.
			return text.length;
		}
	}
};
