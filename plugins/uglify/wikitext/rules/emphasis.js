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
	var notation = this.match[0];
	var bits = [{text: notation}];
	bits.push.apply(bits, this.parse()[0].children);
	bits.push({text: notation, tail: true});
	return bits;
};
