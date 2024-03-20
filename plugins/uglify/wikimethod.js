/*\
title: $:/plugins/flibbles/uglify/wikimethod.js
module-type: wikimethod
type: application/javascript

\*/

/*jslint node: true, browser: true */
/*global $tw: false */
'use strict';

var cacher = require('./cache.js');
var logger = require('./logger.js');
var utils = require('./utils.js');
var uglifiers = $tw.modules.getModulesByTypeAsHashmap("uglifier", "type");

exports.getTiddlerSourceMap = function(title, options) {
	var wiki = this,
		uglifier,
		source = this.getShadowSource(title);
	// If it's a system target, it's either $:/boot/..., which has no source
	// or it's a library, like sjcl, which has no source,
	// or the uglify sourcemap lib, which needs to draw from itself, not a
	// source, because the Uglify plugin may be heavily pruned.
	if (!utils.isSystemTarget(wiki, title) && source) {
		var fields = compressTiddler(this, source, options);
		if (fields.map) {
			if (typeof fields.map === "string") {
				fields.map = JSON.parse(fields.map);
			}
			if (fields.map[title]) {
				return fields.map[title];
			}
		}
	} else if (this.tiddlerExists(title)) {
		var fields = compressTiddler(this, title, options);
		if (typeof fields.map === "string") {
			fields.map = JSON.parse(fields.map);
		}
		return fields.map;
	}
};

/**This returns the compressed tiddlers regardless of whether it would be
 * compressed during saving or serving.
 */
exports.getTiddlerUglifiedText = function(title, options) {
	return compressTiddler(this, title, options).text;
};

function compressTiddler(wiki, title, options) {
	var uglifier,
		options = options || {},
		signature = utils.getSignature(wiki);
	try {
		var cache = wiki.getCacheForTiddler(title, 'uglify', function() { return {}; });
		if (cache.signature !== signature) {
			cache.signature = signature;
			var tiddler = wiki.getTiddler(title);
			if (!tiddler) {
				return undefined;
			}
			var uglifier = wiki.getUglifier(tiddler.fields.type);
			if (uglifier) {
				// it will be up to getFileCache to call the callback now
				var onSave = options.onSave;
				options.onSave = undefined;
				var fields = cacher.getFileCacheForTiddler(wiki, title, tiddler.fields.text, function() {
					logger.log('Compressing:', title);
					try {
						return uglifier.uglify(tiddler.fields.text, {wiki: wiki, title: title});
					} catch (err) {
						utils.logFailure(title, err);
						return {text: tiddler.fields.text};
					}
				}, onSave);
				$tw.utils.extend(cache, fields);
			} else {
				cache.text = tiddler.fields.text || '';
			}
		}
		// We put on directives now, so their independent of the cache
		// This is because the $tw.boot.origin might change, which isn't
		// part of the signature, and if that changes, it may mean a different
		// directive is called for.
		cache = addDirectiveToBootFiles(wiki, cache, title);
	} finally {
		// If we're here, it means we never saved the file.
		// Either we're on browser, the cache was good, or an error occured.
		if (options.onSave) {
			options.onSave(null, false);
		}
	}
	return cache;
};

exports.compressionEnabled = function() {
	return utils.getSetting(this, 'compress');
};

// Returns the given uglifier, but only if it hasn't been deactivated.
// undefined otherwise.
exports.getUglifier = function(type) {
	type = type || "text/vnd.tiddlywiki";
	return uglifiers[type];
};

exports.getPruneMap = function() {
	// We do this strange cache juggling. If Import is changed, plugins
	// may have been imported. We need to re-register them, but we only
	// want to do this once. And the act of reregistering plugins will
	// wipe $:/Import's cache, so we re-initialize the cache afterward.
	var self = this;
	var state = this.getCacheForTiddler('$:/Import', 'uglify-prunemap-state', function() {
		return {};
	});
	if (!state.loaded) {
		// Let's install any plugins which might have been added since startup
		this.registerPluginTiddlers();
		this.readPluginInfo();
		this.unpackPluginTiddlers();
	}
	// And now we reinitialize it.
	this.getCacheForTiddler('$:/Import', 'uglify-prunemap-state', function() {
		return {loaded: true};
	});
	return this.getGlobalCache('uglify-prunemap', function() {
		var map = Object.create(null);
		var settings = utils.getSettings(self);
		for (var setting in settings) {
			if (setting.indexOf('prune/') === 0 && settings[setting]) {
				var filterString = self.getTiddlerText("$:/plugins/flibbles/uglify/" + setting);
				var output = self.filterTiddlers(filterString, null, self.eachShadowPlusTiddlers);
				for (var i = 0; i < output.length; i++) {
					map[output[i]] = true;
				}
			}
		}
		return map;
	});
};

// If this is a system target, we give a chance to add
// directives in case this is a server which needs to tweak
// boot.js and such.
// This occurs INDEPENDENTLY of file writing. We don't want
// these directives in the file cache.
function addDirectiveToBootFiles(wiki, fields, title) {
	var tiddler = wiki.getTiddler(title);
	if (utils.isSystemTarget(wiki, title)
	&& tiddler
	&& tiddler.fields.type === "application/javascript"
	&& fields.text
	// If it already has a directive, that means it wasn't compressed
	// Probably due to an error
	&& !fields.text.match(/\n\/\/# *sourceURL=[^\n]+\s*$/)) {
		fields = Object.create(fields);
		if (utils.sourceMappingEnabled(wiki)) {
			var prefix = wiki.getTiddler("$:/temp/library/flibbles/uglify.js").fields.directory;
			fields.text = fields.text + "\n//# sourceMappingURL=" + mapDirectory(wiki, title);
		} else {
			// We put simple directives back into boot files, even though
			// it will only show uglified code. Why not?
			fields.text = fields.text + "\n//# sourceURL=" + title;
		}
	}
	return fields;
};

function mapDirectory(wiki, title) {
	var prefix = wiki.getTiddler("$:/temp/library/flibbles/uglify.js").fields.directory;
	// 3 for the length of $:/
	var sanitizedPath = utils.sanitizePath(prefix + title.substr(3));
	return sanitizedPath + '.map';
};
