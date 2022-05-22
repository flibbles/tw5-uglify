# Uglify

If you've ever wanted to compress your Tiddlywiki file or plugins, TW5-Uglify is for you. It compresses javascript, css, and even wikitext with zero effort. (Don't worry! It only compresses core code and plugins. It doesn't touch your own tiddlers.)

To compress your Tiddlywiki file, you can visit the [uglify wizard](https://flibbles.github.io/tw5-uglify/uglified.html) to compress it without even having to install the plugin.

You can also have your Node.JS TiddlyWiki server automatically compress all core code and plugins it serves. Check out the [demo site](https://flibbles.github.io/tw5-uglify/) for documentation and further explanation.

_Note_: Uglify cannot process plugins which use ECMAScript 2015 or above. This isn't a problem for core code because Tiddlywiki doesn't support it either, but some 3rd party plugins may not abide by this limitation.

## How to install

Installing Uglify is primarily intended for use on Node.js. If you have a standalone TiddlyWiki file, use the [uglify wizard](https://flibbles.github.io/tw5-uglify/uglified.html) instead, since you won't need to compress your file more than once.

### Node.js

_TW5-Uglify requires Node.js 12.0.0 or greater._

The following is an abridged version of the [instructions found here](https://tiddlywiki.com/#Installing%20custom%20plugins%20on%20Node.js).

First, check out the source code using git. Then copy the uglify directory out of the `plugins` directory into a "flibbles" directory in a path where you'd like it to be available. Then add that path to the TIDDLYWIKI_PLUGIN_PATH environment variable.

For instance, copy the contents of the plugin directory to "~/.tiddlywiki/flibbles" directory. Then run `echo "TIDDLYWIKI_PLUGIN_PATH=~/.tiddlywiki" >> .profile`

If you've installed it correctly, the path to the `plugin.info` file should look something like:

`~/.tiddlywiki/flibbles/uglify/plugin.info`

Afterward, add the plugin inside your projects' `tiddlywiki.info` file.
The plugins section will look something like:
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
