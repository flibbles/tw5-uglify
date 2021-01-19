# Uglify

If you've ever wanted to compress your Tiddlywiki file or plugins, TW5-Uglify is for you. It can be used to automatically compress the core code and plugins served from a Node server. Or it can compress an existing standalone tiddlywiki file.

Check out the [demo site](https://flibbles.github.io/tw5-uglify/) for documentation and further explanation.

_Note_: Uglify cannot process plugins which use ECMAScript 2015 or above. This isn't a problem for core code because Tiddlywiki doesn't support it either, but some 3rd party plugins may not abide by this limitation.

## How to install

Uglify is primarily intended to be used on Node.js. But if you wish to utilize compression on a Tiddlywiki file, see the [documentation](https://flibbles.github.io/tw5-uglify/#Uglify%20on%20TiddlyWiki) for details.

### Node.js

_TW5-Uglify requires Node.js 12.0.0 or greater._

The contents of the `plugins` directory must be copied into the `plugins` directory in your tiddlywiki installation. This is likely in:

`/usr/local/lib/node_modules/tiddlywiki/plugins/flibbles`

You may need to make the `flibbles` directory. If you've installed it correctly, the path to the `plugin.info` file should look something like:

`/usr/local/lib/node_modules/tiddlywiki/plugins/flibbles/uglify/plugin.info`

Afterward, add the plugin inside your projects' `tiddlywiki.info` file.
The plugins section will look something like:
```
{
	...
	"plugins": [
		...
		"flibbles/uglify"
	],
	...
}
```

Alternatively, you can also copy the `plugins` directly into your projects'
root directory. Though this makes the install local only to those specific
projects.

Once installed, restart your server, and it will automatically begin serving compressed plugins and core code.

## How to test

Make sure you have `tiddlywiki` available on your PATH. Then from the project root directory, type:

`tiddlywiki --build test`
