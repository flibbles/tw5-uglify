/*\

Uglify rule for &entities;

\*/

var utils = require("../utils.js");

exports.name = "entity";

exports.uglify = function() {
	var startsLine = this.parser.pos === 0 || this.parser.source[this.parser.pos-1] === "\n";
	var entity = this.parse()[0].entity;
	if (entity === "&#32;") {
		if (!startsLine) {
			return [{text: " ", textWithTrim: "&#32;"}];
		}
	}
	return entity;
};
