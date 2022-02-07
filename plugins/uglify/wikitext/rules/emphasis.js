/*\

Uglify rule for

''bold''
//italic//
~~strikethrough~~
,,subscript,,
^^superscript^^
__underscore__

\*/

exports.name = ["bold", "italic", "strikethrough", "subscript", "superscript", "underscore"];

exports.uglify = function() {
	var bits = [{text: this.match[0]}];
	bits.push.apply(bits, this.parse()[0].children);
	bits.push({text: this.match[0], tail: true});
	return bits;
};
