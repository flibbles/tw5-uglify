/*\
title: $:/temp/library/flibbles/uglify.js
module-type: library
library: no
type: application/javascript

Introduces the new evalGlobal to the core utilities so that sourceMapURL
is added to the end of all javascript files.

This is done as a library so that it can sneak in before any modules get loaded.

\*/

'use strict';

var library = {};
var yes = "yes";

/*
This is a copy of the evalGlobal in the boot.js file. The only change is
the sourceMappingURL that's put at the end of files.

This has been simplified because it will only ever run on the browser.
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
	code = "(function(" + contextNames.join(",") + ") {(function(){\n" + code + "\n;})();\nreturn exports;\n})";
	// Compile the code into a function
	var fn = window["eval"](code + library.getEpilogue($tw.wiki, filename));
	// Call the function and return the exports
	return fn.apply(null,contextValues);
};

library.getEpilogue = function(wiki, filename) {
	var source = wiki.getShadowSource(filename);
	if (source && !wiki.tiddlerExists(filename)) {
		return library.getDirective(wiki, filename);
	}
	return "\n\n//# sourceURL=" + filename;
};

library.getDirective = function(wiki, filename) {
	filename = encodeURIComponent(filename).replace(/%(?:2|3)(?:F|4|A)/g, function(code) {
		switch (code) {
			case "%2F": return '/';
			case "%24": return '$';
			case "%3A": return ':';
			default: return code;
		}
	});
	return "\n\n//# sourceMappingURL=source/" + filename + ".map";
};

if (typeof window !== "undefined") {
	window.$tw = window.$tw || Object.create(null);
	var hooks = $tw.hooks = $tw.hooks || {names: {}};
	var hook = "th-boot-tiddlers-loaded";

	if (!Object.hasOwnProperty(hooks.names, hook)) {
		hooks.names[hook] = [];
	}

	hooks.names[hook].push(function() {
		$tw.utils.evalSandboxed = evalGlobal;
	});
}

if ((typeof module !== "undefined") && module.exports) {
	module.exports = library;
}