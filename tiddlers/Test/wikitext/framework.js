/*\
title: Test/wikitext/framework.js
type: application/javascript
tags: $:/tags/test-spec

Tests the wikitext uglifier with inline and block comments.

\*/

describe('wikitext uglifier', function() {
describe('framework', function() {

const test = $tw.utils.test.wikitext.test;

const wikitextType = "text/vnd.tiddlywiki";

var ignores = [
	'$:/core/templates/css-tiddler',
	'$:/core/save/all-external-js',
	'$:/core/save/offline-external-js',
	'$:/core/save/all',
	'$:/core/save/empty',
	'$:/core/save/lazy-all',
	'$:/core/save/lazy-images',
	'$:/plugins/flibbles/uglify-wizard/save-tiddler-filter',
	'$:/core/templates/html-div-tiddler'
];

// This tests against all of the core as best it can to ensure no changes
// to output. It helps find basic problems, but it's not foolproof by any
// means. This passing doesn't mean uglify works.
/*

it('does an identity transform right now', function() {
	var tested = 0;
	function report(text, pretty, ugly) {
		console.log("FAILED");
		console.log("PRETTY");
		console.log(text);
		console.log();
		console.log("UGLY");
		console.log($tw.utils.test.wikitext.uglify(text));
		console.log();
		console.log("PRETTY-OUT");
		console.log(pretty);
		console.log();
		console.log("UGLY-OUT");
		console.log(ugly);
	};

	const targets = $tw.wiki.allShadowTitles();
	$tw.wiki.addTiddler({title: "test", text: "\\import [all[current]]\n<$list variable=__recurse__ filter='[[__recurse__]!is[variable]]' emptyMessage=recursing>\n\n<$list variable=v filter='[variables[]!match[currentTiddler]!match[targetTiddler]]'>\n\n<$macrocall $name=<<v>> />\n\n</$list>\n\n<$transclude tiddler=<<targetTiddler>> />\n"});
	//const targets = ["$:/core/ui/TiddlerInfo/List"];
	$tw.utils.each(targets, function(title) {
		if (ignores.indexOf(title) >= 0) {
			return true;
		}
		var tiddler = $tw.wiki.getTiddler(title);
		var type = tiddler.fields.type;
		var pretty, ugly;
		if (!type || type === wikitextType) {
			var text = tiddler.fields.text;
			if (text) {
				try {
					var options = {variables: {currentTiddler: 'test', targetTiddler: title}};
					$tw.wiki.addTiddler(new $tw.Tiddler(tiddler, {text: text}));
					pretty = $tw.wiki.renderTiddler("text/html", "test", options);
					var uglyText = $tw.utils.test.wikitext.uglify(text);
					if (uglyText === text) {
						// Ignore this one. It doesn't have any wikitext in it.
						return true;
					}
					tested++;
					$tw.wiki.addTiddler(new $tw.Tiddler(tiddler, {text: uglyText}));
					ugly = $tw.wiki.renderTiddler("text/html", "test", options);
					if (ugly === pretty) {
						return true;
					}
				} catch (err) {
					report(text, pretty, ugly);
					console.warn("ERROR ON:", title);
					throw err;
				}
				report(text, pretty, ugly);
				console.warn("MISMATCH ON:", title);
				return false;
			}
		}
	});
	console.log("Tested " + tested + " tiddlers");
});

/**/

});});
