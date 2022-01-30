/*\

Uglify rule for

{{{ filtered transcludes }}}

\*/

exports.name = ["filteredtranscludeblock", "filteredtranscludeinline"];

exports.uglify = function() {
	var call = this.parse()[0],
		original = this.match[0],
		bits = ["{{{"],
		uglifier = this.parser.wiki.getUglifier('text/x-tiddler-filter');
	bits.push(uglifier.uglify(this.match[1], this.parser.title, this.parser));
	if (this.match[2]) { // tooltip
		// As far as I can tell, tooltips aren't used in any way, but I
		// guess if the rule specifies one, the user must want it.
		bits.push("|", this.match[2]);
	}
	if (this.match[3]) { // template
		bits.push("||", this.match[3].trim());
	}
	bits.push("}}");
	if (this.match[4]) { // style
		// Once again, this is never used anywhere,
		// but I guess we'll preserve it.
		bits.push(this.match[4]);
	}
	bits.push("}");
	if (this.match[5]) { // classes
		// Once again, not actually used
		bits.push(".", this.match[5]);
	}
	if (original[original.length-1] === "\n") { // newline at end
		bits.push('\n');
	}
	return [{text: bits.join('')}];
};
