/*\
title: $:/plugins/flibbles/uglify/startup_eval.js
module-type: startup
tags: $:/tags/flibbles/uglify/Stub
type: application/javascript

Introduces the new evalGlobal to the core utilities so that sourceMapURL
is added to the end of all javascript files.

It's important that this file be named alphabetically before the other
uglify startup module. This must come first.

\*/

/*jslint node: true, browser: true */
/*global $tw: false */

'use strict';

exports.name = 'uglify_mapping';
exports.synchronous = true;
// Before commands, or else the server hook may get called before this does.
exports.before = ['commands'];

/*
This is a copy of the evalGlobal in the boot.js file. The only change is
the sourceMappingURL that's put at the end of files.
*/
function evalGlobal(code,context,filename) {
	var contextCopy = $tw.utils.extend(Object.create(null),context);
	// Get the context variables as a pair of arrays of names and values
	var contextNames = [], contextValues = [];
	$tw.utils.each(contextCopy,function(value,name) {
		contextNames.push(name);
		contextValues.push(value);
	});
	// Add the code prologue and epilogue
	code = "(function(" + contextNames.join(",") + ") {(function(){\n" + code + "\n;})();\nreturn exports;\n})\n";
	// Compile the code into a function
	var fn;
	if($tw.browser) {
		fn = window["eval"](exports.addDirectives($tw.wiki, code, filename));
	} else {
		fn = vm.runInThisContext(code,filename);
	}
	// Call the function and return the exports
	return fn.apply(null,contextValues);
};

// We need our own here, because getTiddlerText isn't loaded yet.
function getText(wiki, title, defaultValue) {
	var tiddler = wiki.getTiddler(title);
	return (tiddler && tiddler.fields.text) || defaultValue;
};

function getConfig(wiki, key, defaultValue) {
	return getText(wiki, "$:/config/flibbles/uglify/"+key, defaultValue);
};

// This is in exports so I can test it.
exports.addDirectives = function(wiki, code, filename) {
	if (getConfig(wiki, "compress", "yes") === "yes"
	&& getConfig(wiki, "sourcemap", "yes") === "yes"
	&& getConfig(wiki, "application/javascript", "yes") === "yes") {
		var blacklist = $tw.utils.parseStringArray(getConfig(wiki, "blacklist", ""));
		var source = wiki.getShadowSource(filename);
		if (source
		&& blacklist.indexOf(source) < 0
		&& !wiki.tiddlerExists(filename)) {
			return code + "\n\n//# sourceMappingURL=/uglify/map/" + filename;
		}
	}
	return code + "\n\n//# sourceURL=" + filename;
};

// TODO: Maybe test the state tiddler here instead of wit hevery dirrective
if ($tw.browser && getText($tw.wiki, "$:/state/flibbles/uglify/server") === "yes") {
	$tw.utils.evalSandboxed = evalGlobal;
}

// TODO: do I need to URL escape the filename?
