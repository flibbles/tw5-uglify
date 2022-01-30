/*\

Uglify html rule for uglifying wikitext attributes of various widgets.

\*/

var widgetList = {
	"$button": ["actions"],
	"$checkbox": ["actions", "uncheckactions", "checkactions"],
	"$droppable": ["actions"],
	"$dropzone": ["actions"],
	"$keyboard": ["actions"],
	"$link": ["tooltip"],
	"$linkcatcher": ["actions"],
	"$list": ["emptyMessage"],
	"$messagecatcher": ["actions"],
	"$radio": ["actions"],
	"$range": ["actions", "actionsStart", "actionsStop"],
	"$select": ["actions"],
	"$wikify": ["text"]
};

//eventcatcher: "all attributes that start with $, or something like that

$tw.utils.each(widgetList, function(attributeArray, widget) {
	exports[widget] = function(tag, parser) {
		for (var i = 0; i < attributeArray.length; i++) {
			var attrName = attributeArray[i];
			var attr = tag.attributes[attrName];
			if (attr && attr.type === "string") {
				var uglifier = parser.wiki.getUglifier("text/vnd.tiddlywiki");
				var options = {wiki: parser.wiki, placeholders: parser.placeholders};
				attr.value = uglifier.uglify(attr.value, options);
			}
		}
	};
});
