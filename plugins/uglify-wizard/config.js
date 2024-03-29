/*\
title: $:/plugins/flibbles/uglify-wizard/config.js
type: application/javascript
module-type: startup

Startup module for configuring the upgrade plugin

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

// Export name and synchronous status
exports.name = "uglify-wizard-config";
exports.before = ["startup"];
exports.synchronous = true;

exports.startup = function() {
	// See $tw.utils.decryptStoreAreaInteractive() in $:/core/modules/utils/crypto.js
	$tw.config.usePasswordVault = true;
	$tw.config.disableAutoSave = true;
};

})();
