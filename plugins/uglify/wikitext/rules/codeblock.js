/*\

Uglify rule for

```
	code blocks
```

\*/

exports.name = "codeblock";

exports.uglify = function() {
	var attrs = this.parse()[0].attributes;
	this.parser.trailingJunkLength += 4;
	return "```" + attrs.language.value + "\n" + attrs.code.value + "\n```";
};
