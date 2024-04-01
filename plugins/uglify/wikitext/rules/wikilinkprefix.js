/*\

Uglify rule for

WikiLinkprefix

This is a workaround that came about after CamelCase was disabled by default.
We don't really need to differentiate between the rules, so we just copy
all of the exports.
\*/

exports.uglify = require('./wikilink.js').uglify;

exports.name = 'wikilinkprefix';
