/*\

Uglify html rule for improving $setvariable to set.

\*/

exports["$setvariable"] = function(tag, parser) {
	tag.tag = "$set";
	tag.type = "set";
};
