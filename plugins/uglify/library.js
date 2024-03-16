/*\
title: $:/temp/library/flibbles/uglify.js
module-type: library
library: no
type: application/javascript

Introduces the new evalGlobal to the core utilities so that sourceMapURL
is added to the end of all javascript files.

This is done as a library so that it can sneak in before any modules get loaded.

\*/

// We wrap this library in an anonymous function because it helps uglify
// trim down the top-level property names
// Also, depending on the TiddlyWiki, this module may have global scope.
(function() {

'use strict';

var library = {};

if (typeof window !== "undefined") {
	var tw = window.$tw = window.$tw || Object.create(null);
	var hooks = tw.hooks = tw.hooks || {names: {}};
	var hook = "th-boot-tiddlers-loaded";

	if (!Object.hasOwnProperty(hooks.names, hook)) {
		hooks.names[hook] = [];
	}

	hooks.names[hook].push(function() {
		tw.utils.evalSandboxed = evalGlobal;
	});
}

if ((typeof module !== "undefined") && module.exports) {
	module.exports = library;
}

/*
This is a copy of the evalGlobal in the boot.js file. The only change is
the sourceMappingURL that's put at the end of files.

This has been simplified because it will only ever run on the browser.
*/
function evalGlobal(code,context,filename) {
	// Get the context variables as a pair of arrays of names and values
	var contextNames = [], contextValues = [];
	for (var name in context) {
		contextNames.push(name);
		contextValues.push(context[name]);
	}
	// Add the code prologue and epilogue
	// It's important that the prologue take up exactly one line. The map for
	// the code is offset by one ";", or one line to account for this.
	code = "(function(" + contextNames.join(",") + ") {(function(){\n" + code + "\n;})();\nreturn exports;\n})";
	// Compile the code into a function
	var fn = window["eval"](code + getEpilogue(tw.wiki, filename));
	// Call the function and return the exports
	return fn.apply(null,contextValues);
};

function getEpilogue(wiki, filename) {
	var source = wiki.getShadowSource(filename);
	if (source
	&& !wiki.tiddlerExists(filename)
	&& wiki.isSystemTiddler(filename)) {
		var info = wiki.getPluginInfo(source);
		// We only want to use sourceMap directives for uglified plugins
		if (info.ugly) {
			return library.getDirective(wiki, filename);
		}
	}
	return "\n\n//# sourceURL=" + filename;
};

library.getDirective = function(wiki, filename) {
	filename = encodeURIComponent(filename).replaceAll(/%(?:2|3)(?:F|4|A)/g, function(code) {
		switch (code) {
			case "%2F": return '/';
			case "%24": return '$';
			case "%3A": return ':';
			default: return code;
		}
	});
	// We cut off and re-attach the $:/ because it will soon be different.
	return "\n\n//# sourceMappingURL=$:/" + filename.substr(3) + ".map";
};

})();

//# sourceURL=$:/temp/library/flibbles/uglify.js
