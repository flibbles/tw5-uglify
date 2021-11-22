/*\

Uglify rule for

```
	code blocks
```

\*/

exports.name = "codeblock";

exports.uglify = function() {
	var attrs = this.parse()[0].attributes;
	return [
		{text: "```" + attrs.language.value + "\n" + attrs.code.value},
		{text: "\n```", junk: true}];
};
