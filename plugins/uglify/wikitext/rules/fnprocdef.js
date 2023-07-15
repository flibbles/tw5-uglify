/*\

Uglify rule for \function pragma

\*/

var utils = require("../utils.js");

exports.name = "fnprocdef";

exports.uglify = function() {
	var pragma = this.parse()[0];
	var uglifierType, procdefType;
	var name = pragma.attributes.name.value;
	if (pragma.isFunctionDefinition) {
		uglifierType = "text/x-tiddler-filter";
		procdefType = "function";
	} else if (pragma.isProcedureDefinition) {
		uglifierType = "text/vnd.tiddlywiki";
		procdefType = "procedure";
	} else { // isWidgetDefinition
		uglifierType = "text/vnd.tiddlywiki";
		procdefType = "widget";
	}
	var uglifier = this.parser.wiki.getUglifier(uglifierType);
	var strings = ['\\', procdefType, ' ', name];
	strings.push(this.uglifyPragmaParams(pragma.params));
	var text = uglifier.uglify(pragma.attributes.value.value, this.parser).text;
	if (text.indexOf("\n") >= 0 || $tw.utils.skipWhiteSpace(text,0) > 0) {
		strings.push("\n", text, "\n\\end");
		// Now determine if this was a named pragma closer
		var startOfEnd = this.parser.source.lastIndexOf("\\end", this.parser.pos);
		var stringAfterEnd = this.parser.source.substring(startOfEnd+4, this.parser.pos);
		if (stringAfterEnd.indexOf(name) >= 0) {
			strings.push(" ", name);
		}
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
			&& lastString[0] !== "'") {
				strings.push(" ");
			}
		}
		strings.push(param.name);
		if (param.default) {
			strings.push(":");
			var options = Object.create(this.parser);
			options.bracketsAllowed = false;
			strings.push(utils.quotifyParam(param.default, false, options));
		}
	};
	strings.push(")");
	return strings.join('');
};
