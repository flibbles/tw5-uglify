/*\

Uglify rule for <<macros and:params>>

\*/

var utils = require("../utils.js");

exports.name = "table";

exports.uglify = function() {
	var bodies = this.parse()[0].children;
	var bits = [],
		delim = "",
		mergeDown = [];
	for (var i = 0; i < bodies.length; i++) {
		var tBody = bodies[i];
		var rows = tBody.children;
		for (var rowCount = 0; rowCount < rows.length; rowCount++) {
			var tr = rows[rowCount],
				colCount = 0;
			if (rowCount > 0) {
				delim += "\n";
			}
			delim += "|";
			if (tr.children.length == 0) {
				// Broken case where all cells in top row merge up.
				delim = delim + ">|";
			}
			for (var j= 0; j < tr.children.length; j++, colCount++) {
				var td = tr.children[j],
					align = getAttr(td, "align"),
					valign = getAttr(td, "valign"),
					colspan = getAttr(td, "colspan", 0),
					rowspan = getAttr(td, "rowspan", 1);
				if (mergeDown[colCount] && mergeDown[colCount] > 1) {
					// We need to add a row merge.
					delim = delim + "~|";
					mergeDown[colCount]--;
					// The column we're looking at now is actually one over.
					colCount++;
				}
				// We set the mergeDown so we can deal with that later
				if (rowspan) {
					mergeDown[colCount] = rowspan;
				}
				if (valign === "top") {
					delim = delim + "^";
				} else if (valign === "bottom") {
					delim = delim + ",";
				}
				if (align === "center" || align === "right") {
					delim = delim + " ";
				}
				bits.push({text: delim});
				delim = (align === "center" || align === "left") ? " |" : "|";
				if (colspan == 1) {
					// This is a special case to handle a broken table where
					// the right most cell merges right.
					delim = delim + ">|";
				}
				while (colspan > 1) {
					// We're now a column to the right.
					colCount++;
					if (mergeDown[colCount] && mergeDown[colCount] > 1) {
						// Broken case: an upper cell tried to merge down
						// into a merged row of cells
						delim = delim + "~|";
						mergeDown[colCount]--;
					} else {
						delim = delim + "<|";
						colspan--;
					}
				}
				bits.push.apply(bits, td.children);
			}
			for (; colCount < mergeDown.length; colCount++) {
				if (mergeDown[colCount] && mergeDown[colCount] > 1) {
					delim = delim + "~|";
					mergeDown[colCount]--;
				}
			}

		}
	}
	bits.push({text: delim});
	bits.push({text: "\n", tail: true});
	// Tables are always blocks, so we can be sure that the whitespace after
	// them will always be trimmed regardless of whitespace status
	this.parser.skipWhitespace();
	return bits;
};

function getAttr(elem, name, default_val) {
	return (elem.attributes && elem.attributes[name] && elem.attributes[name].value) || default_val;
};

