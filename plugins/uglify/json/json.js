/*\
title: $:/plugins/flibbles/uglify/json/json.js
module-type: uglifier
type: application/javascript

Uglifies json files, including all plugins.

\*/

var logger = require('../logger.js');
var utils = require('../utils.js');

exports.type = "application/json";

exports.uglify = function(text, options) {
	var wiki = options.wiki,
		pluginInfo = utils.getPluginInfo(wiki, options.title);
	if (pluginInfo) {
		return compressPlugin(wiki, pluginInfo);
	} else {
		return compressJSON(text);
	}
}

function compressJSON(text) {
	try {
		return {text: JSON.stringify(JSON.parse(text), null)};
	} catch (err) {
		var marker = "position ";
		var index = err.message.lastIndexOf(marker);
		if (index >= 0) {
			err.pos = parseInt(err.message.substr(index + marker.length));
		}
		throw err;
	}
};

function compressPlugin(wiki, pluginInfo) {
	var newTiddlers = Object.create(null),
		maps = Object.create(null),
		newInfo = $tw.utils.extend({}, pluginInfo),
		uglifier,
		pruneMap = wiki.getPruneMap();
	for (var title in pluginInfo.tiddlers) {
		var fields = pluginInfo.tiddlers[title];
		var blacklisted = utils.getSetting(wiki, 'blacklist').indexOf(title) >= 0;
		if (pruneMap[title] && !blacklisted) {
			continue;
		}
		var abridgedFields = cleanShadowFields(fields);
		uglifier = wiki.getUglifier(fields.type);
		// Non-system tiddlers are skipped.
		// They're probably meant to be public-facing.
		if (fields.text
		&& uglifier
		&& wiki.isSystemTiddler(title)
		// We don't use utils.shouldCompress because it uses the type that
		// wiki.getTiddler returns, which might be overridden and incorrect.
		&& !blacklisted
		&& utils.getSetting(wiki, fields.type || 'text/vnd.tiddlywiki')) {
			try {
				var results = uglifier.uglify(fields.text, {wiki: wiki, title: title});
				if (results.map) {
					var mapObj = JSON.parse(results.map);
					// Plugin javascript need a semicolon so they skip a line
					// Because boot.js will add this whole (function(...){ thing.
					mapObj.mappings = ";" + mapObj.mappings;
					//mapObj.sources[0] = title;
					maps[title] = mapObj;
				}
				abridgedFields.text = results.text;
			} catch (err) {
				// Log the failure and move on to the plugin's next tiddler
				utils.logFailure(title, err);
			}
		}
		newTiddlers[title] = abridgedFields;
	}
	newInfo.tiddlers = newTiddlers;
	newInfo.ugly = true;
	return {
		map: JSON.stringify(maps, null),
		text: JSON.stringify(newInfo, null) };
};

function cleanShadowFields(fields) {
	var cleanedFields = Object.create(null);
	for (var field in fields) {
		// We don't need to copy the title field. It's redundant
		// since the key to this object is the title.
		if (field === 'title') {
			continue;
		}
		// Also, empty tags fields are pointless, but easy for
		// plugin writers to accidentally make. Drop em.
		if (field === 'tags' && !fields.tags) {
			continue;
		}
		cleanedFields[field] = fields[field];
	}
	return cleanedFields;
};

