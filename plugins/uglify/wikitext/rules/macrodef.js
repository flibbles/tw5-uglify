/*\

Uglify rule for <<macros and:params>>

\*/

var utils = require("../utils.js");
var PlaceholderList = require("../placeholderList.js");

exports.name = "macrodef";

exports.uglify = function() {
	var def = this.parseWithMarkers()[0];
	var uglifier = this.parser.wiki.getUglifier("text/vnd.tiddlywiki");
	var strings = ['\\define ', def.attributes.name.value, "("];
	var placeholders = new PlaceholderList(this.parser.placeholders);
	for (var index = 0; index < def.params.length; index++) {
		var param = def.params[index];
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
			if (this.parser.placeholders.present(param.default)) {
				strings.push(getOriginalQuoting(param, this.parser));
			} else {
				strings.push(utils.quotifyParam(param.default, true, this.parser));
			}
		}
		placeholders.add(param.name);
	};
	strings.push(")");
	var options = {wiki: this.parser.wiki, placeholders: placeholders};
	var text = uglifier.uglify(def.attributes.value.value, null, options);
	if (text.indexOf("\n") >= 0 || $tw.utils.skipWhiteSpace(text,0) > 0) {
		strings.push("\n", text, "\n\\end");
	} else if(text.length == 0) {
		strings.push("\n");
	} else {
		strings.push(text);
	}
	return strings.join("");
};

function getOriginalQuoting(param, parser) {
	var string = param.default;
	if (param.quote === "[[") {
		return "[[" + string + "]]";
	}
	return param.quote + string + param.quote;
};

// Same as the parse in the rule, but this records where attributes are
exports.parseWithMarkers = function() {
	// Move past the macro name and parameters
	this.parser.pos = this.matchRegExp.lastIndex;
	// Parse the parameters
	var paramString = this.match[2],
		params = [];
	if(paramString !== "") {
		var reParam = /\s*([A-Za-z0-9\-_]+)(?:\s*:\s*(?:"""([\s\S]*?)"""|"([^"]*)"|'([^']*)'|\[\[([^\]]*)\]\]|([^"'\s]+)))?/mg,
			paramMatch = reParam.exec(paramString);
		while(paramMatch) {
			// Save the parameter details
			var paramInfo = {name: paramMatch[1]},
				defaultValue = paramMatch[2] || paramMatch[3] || paramMatch[4] || paramMatch[5] || paramMatch[6];
			if(defaultValue) {
				paramInfo["default"] = defaultValue;
				// This is the part I added.
				paramInfo.quote =
					paramMatch[2] ? '"""' : (
						paramMatch[3] ? '"' : (
							paramMatch[4] ? "'" : (
								paramMatch[5] ? "[[" : "")));
			}
			params.push(paramInfo);
			// Look for the next parameter
			paramMatch = reParam.exec(paramString);
		}
	}
	// Is this a multiline definition?
	var reEnd;
	if(this.match[3]) {
		// If so, the end of the body is marked with \end
		reEnd = /(\r?\n\\end[^\S\n\r]*(?:$|\r?\n))/mg;
	} else {
		// Otherwise, the end of the definition is marked by the end of the line
		reEnd = /($|\r?\n)/mg;
		// Move past any whitespace
		this.parser.pos = $tw.utils.skipWhiteSpace(this.parser.source,this.parser.pos);
	}
	// Find the end of the definition
	reEnd.lastIndex = this.parser.pos;
	var text,
		endMatch = reEnd.exec(this.parser.source);
	if(endMatch) {
		text = this.parser.source.substring(this.parser.pos,endMatch.index);
		this.parser.pos = endMatch.index + endMatch[0].length;
	} else {
		// We didn't find the end of the definition, so we'll make it blank
		text = "";
	}
	// Save the macro definition
	return [{
		type: "set",
		attributes: {
			name: {type: "string", value: this.match[1]},
			value: {type: "string", value: text}
		},
		children: [],
		params: params,
		isMacroDefinition: true
	}];
};
