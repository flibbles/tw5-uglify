/*\

Uglify html rule for uglifying wikitext attributes of various widgets.

\*/

var filterList = {
	"$count": ["filter"],
	"$draggable": ["filter"],
	"$encrypt": ["filter"],
	"$importvariables": ["filter"],
	"$list": ["filter"]
	//"$setvariable": ["filter"], // handled in its own module
	//"$set": ["filter"] // handled in its own module
};

var wikitextList = {
	"$button": ["actions"],
	"$checkbox": ["actions", "uncheckactions", "checkactions"],
	"$droppable": ["actions"],
	"$dropzone": ["actions"],
	"$keyboard": ["actions"],
	//"$link": ["tooltip"], // handled in its own module
	"$linkcatcher": ["actions"],
	"$list": ["emptyMessage"],
	"$messagecatcher": ["actions"],
	"$radio": ["actions"],
	"$range": ["actions", "actionsStart", "actionsStop"],
	"$select": ["actions"],
	"$wikify": ["text"]
};

//eventcatcher: "all attributes that start with $, or something like that

var masterList = $tw.utils.extend({}, filterList, wikitextList);

$tw.utils.each(Object.keys(masterList), function(widget) {
	exports[widget] = function(tag, parser) {
		uglifyAttributes(tag, wikitextList[widget], "text/vnd.tiddlywiki", parser);
		uglifyAttributes(tag, filterList[widget], "application/x-tiddler-filter", parser);
	};
});

function uglifyAttributes(tag, attributeArray, type, parser) {
	if (attributeArray) {
		for (var i = 0; i < attributeArray.length; i++) {
			var attr = tag.attributes[attributeArray[i]];
			if (attr && attr.type === "string") {
				var uglifier = parser.wiki.getUglifier(type);
				try {
					attr.value = uglifier.uglify(attr.value, parser).text;
				} catch (e) {
					// do nothing. Just move on.
				}
			}
		}
	}
};
