/*\

Uglify rule for \function pragma

\*/

var utils = require("../utils.js");
var PlaceholderList = require("../placeholderList.js");

exports.name = "fnprocdef";

exports.uglify = function() {
	var pragma = this.parse()[0];
	//var uglifier = this.parser.wiki.getUglifier("text/vnd.tiddlywiki");
	var uglifier = this.parser.wiki.getUglifier("text/x-tiddler-filter");
	var strings = ['\\', 'function ', pragma.attributes.name.value];
	strings.push(this.uglifyPragmaParams(pragma.params));
	var text = uglifier.uglify(pragma.attributes.value.value, this.parser).text;
	if (text.indexOf("\n") >= 0 || $tw.utils.skipWhiteSpace(text,0) > 0) {
		strings.push("\n", text, "\n\\end");
	} else if(text.length == 0) {
		strings.push("\n");
	} else {
		strings.push(text);
	}
	return strings.join("");
};

exports.uglifyPragmaParams = function(params) {
	var strings = ['('];
	for (var index = 0; index < params.length; index++) {
		var param = params[index];
		if (index > 0) {
			// Before we put that separating space in, there's a chance
			// we may not need it if the last default param had quoting
			var lastString = strings[strings.length-1];
			if (lastString[0] !== '"'
			&& lastString[0] !== "'"
			&& (lastString.substr(0,2) !== "[[" || lastString.substr(lastString.length-2) !== "]]")) {
				strings.push(" ");
			}
		}
		strings.push(param.name);
		if (param.default) {
			strings.push(":");
			var options = Object.create(this.parser);
			options.bracketsAllowed = false;
			if (this.parser.placeholders && this.parser.placeholders.present(param.default)) {
				strings.push(getOriginalQuoting(param, this.parser));
			} else {
				strings.push(utils.quotifyParam(param.default, false, options));
			}
		}
	};
	strings.push(")");
	return strings.join('');
};

function getOriginalQuoting(param, parser) {
	var string = param.default;
	if (param.quote === "[[") {
		return "[[" + string + "]]";
	}
	return param.quote + string + param.quote;
};
