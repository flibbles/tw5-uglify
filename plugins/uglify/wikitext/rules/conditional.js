/*\

Uglify rule for <% conditionals %>

\*/

var utils = require("../utils.js");

exports.name = "conditional";

exports.uglify = function() {
	var startOfBody = this.parser.source.indexOf("%>", this.parser.pos) + 2,
		node = this.parse()[0],
		filter, children,
		array = [{text: "<%if "}],
		isBlock = node.isBlock;
	//node.startOfBody = this.parser.startOfBody;
	while (true) {
		children = node.children,
		filter = utils.uglifyFilter(node.attributes.filter.value, this.parser);
		array.push({text: [filter, "%>"].join('')});
		if (this.parser.source[startOfBody] === "\n" && this.parser.source[startOfBody+1] === "\n") {
			array.push({text: "\n\n"});
		}
		array = array.concat(children[0].children);
		node = children[1];
		if (node.tag === "$list-empty" && node.children) {
			if (node.children[0].tag === "$list") {
				node = node.children[0];
				array.push({text: "<%elseif "});
				continue;
			} else {
				array.push({text: "<%else%>"});
				array = array.concat(node.children);
			}
		}
		break;
	}
	array.push({text: "<%endif%>", tail: true});
	if (isBlock) {
		this.parser.skipWhitespace();
	}
	return array;
};
