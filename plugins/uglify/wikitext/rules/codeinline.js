/*\

Uglify rule for

``code inline``

\*/

exports.name = "codeinline";

exports.uglify = function() {
	var text = this.parse()[0].children[0].text,
		marker = text.indexOf("`") >= 0 ? "``" : "`";
	return [
		{text: marker + text},
		{text: marker, tail: true}];
};
