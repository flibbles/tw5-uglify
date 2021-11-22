/*\

Uglify rule for &entities;

\*/

var utils = require("../utils.js");

exports.name = "entity";

exports.uglify = function() {
	var entity = this.parse()[0].entity;
	if (entity === "&#32;") {
		return [{text: " ", textWithTrim: "&#32;"}];
	}
	return entity;
};
