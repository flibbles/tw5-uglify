/*\

Uglify rule for \parameters trim.

\*/

exports.name = "parameters";

exports.uglify = function() {
	var params = this.parse()[0];
	return '\\parameters(' + this.match[1] + ")\n";
};
