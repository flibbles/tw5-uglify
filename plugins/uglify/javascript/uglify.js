/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

function characters(str) {
    return str.split("");
}

function member(name, array) {
    return array.indexOf(name) >= 0;
}

function find_if(func, array) {
    for (var i = array.length; --i >= 0;) if (func(array[i])) return array[i];
}

function repeat_string(str, i) {
    if (i <= 0) return "";
    if (i == 1) return str;
    var d = repeat_string(str, i >> 1);
    d += d;
    return i & 1 ? d + str : d;
}

function configure_error_stack(fn) {
    Object.defineProperty(fn.prototype, "stack", {
        get: function() {
            var err = new Error(this.message);
            err.name = this.name;
            try {
                throw err;
            } catch (e) {
                return e.stack;
            }
        }
    });
}

function DefaultsError(msg, defs) {
    this.message = msg;
    this.defs = defs;
}
DefaultsError.prototype = Object.create(Error.prototype);
DefaultsError.prototype.constructor = DefaultsError;
DefaultsError.prototype.name = "DefaultsError";
configure_error_stack(DefaultsError);

function defaults(args, defs, croak) {
    if (croak) for (var i in args) {
        if (HOP(args, i) && !HOP(defs, i)) throw new DefaultsError("`" + i + "` is not a supported option", defs);
    }
    for (var i in args) {
        if (HOP(args, i)) defs[i] = args[i];
    }
    return defs;
}

function merge(obj, ext) {
    var count = 0;
    for (var i in ext) if (HOP(ext, i)) {
        obj[i] = ext[i];
        count++;
    }
    return count;
}

function noop() {}
function return_false() { return false; }
function return_true() { return true; }
function return_this() { return this; }
function return_null() { return null; }

var List = (function() {
    function List(a, f) {
        var ret = [];
        for (var i = 0; i < a.length; i++) {
            var val = f(a[i], i);
            if (val === skip) continue;
            if (val instanceof Splice) {
                ret.push.apply(ret, val.v);
            } else {
                ret.push(val);
            }
        }
        return ret;
    }
    List.is_op = function(val) {
        return val === skip || val instanceof Splice;
    };
    List.splice = function(val) {
        return new Splice(val);
    };
    var skip = List.skip = {};
    function Splice(val) {
        this.v = val;
    }
    return List;
})();

function push_uniq(array, el) {
    if (array.indexOf(el) < 0) return array.push(el);
}

function string_template(text, props) {
    return text.replace(/\{([^}]+)\}/g, function(str, p) {
        var value = props[p];
        return value instanceof AST_Node ? value.print_to_string() : value;
    });
}

function remove(array, el) {
    var index = array.indexOf(el);
    if (index >= 0) array.splice(index, 1);
}

function makePredicate(words) {
    if (!Array.isArray(words)) words = words.split(" ");
    var map = Object.create(null);
    words.forEach(function(word) {
        map[word] = true;
    });
    return map;
}

function all(array, predicate) {
    for (var i = array.length; --i >= 0;)
        if (!predicate(array[i], i))
            return false;
    return true;
}

function Dictionary() {
    this._values = Object.create(null);
    this._size = 0;
}
Dictionary.prototype = {
    set: function(key, val) {
        if (!this.has(key)) ++this._size;
        this._values["$" + key] = val;
        return this;
    },
    add: function(key, val) {
        if (this.has(key)) {
            this.get(key).push(val);
        } else {
            this.set(key, [ val ]);
        }
        return this;
    },
    get: function(key) { return this._values["$" + key] },
    del: function(key) {
        if (this.has(key)) {
            --this._size;
            delete this._values["$" + key];
        }
        return this;
    },
    has: function(key) { return ("$" + key) in this._values },
    all: function(predicate) {
        for (var i in this._values)
            if (!predicate(this._values[i], i.substr(1)))
                return false;
        return true;
    },
    each: function(f) {
        for (var i in this._values)
            f(this._values[i], i.substr(1));
    },
    size: function() {
        return this._size;
    },
    map: function(f) {
        var ret = [];
        for (var i in this._values)
            ret.push(f(this._values[i], i.substr(1)));
        return ret;
    },
    clone: function() {
        var ret = new Dictionary();
        for (var i in this._values)
            ret._values[i] = this._values[i];
        ret._size = this._size;
        return ret;
    },
    toObject: function() { return this._values }
};
Dictionary.fromObject = function(obj) {
    var dict = new Dictionary();
    dict._size = merge(dict._values, obj);
    return dict;
};

function HOP(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}

// return true if the node at the top of the stack (that means the
// innermost node in the current output) is lexically the first in
// a statement.
function first_in_statement(stack, arrow) {
    var node = stack.parent(-1);
    for (var i = 0, p; p = stack.parent(i++); node = p) {
        if (p instanceof AST_Arrow) {
            return arrow && p.value === node;
        } else if (p instanceof AST_Binary) {
            if (p.left === node) continue;
        } else if (p.TYPE == "Call") {
            if (p.expression === node) continue;
        } else if (p instanceof AST_Conditional) {
            if (p.condition === node) continue;
        } else if (p instanceof AST_PropAccess) {
            if (p.expression === node) continue;
        } else if (p instanceof AST_Sequence) {
            if (p.expressions[0] === node) continue;
        } else if (p instanceof AST_Statement) {
            return p.body === node;
        } else if (p instanceof AST_UnaryPostfix) {
            if (p.expression === node) continue;
        }
        return false;
    }
}
/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

function DEFNODE(type, props, methods, base) {
    if (typeof base === "undefined") base = AST_Node;
    props = props ? props.split(/\s+/) : [];
    var self_props = props;
    if (base && base.PROPS) props = props.concat(base.PROPS);
    var code = [
        "return function AST_", type, "(props){",
        "if(props){",
    ];
    props.forEach(function(prop) {
        code.push("this.", prop, "=props.", prop, ";");
    });
    var proto = base && new base;
    if (proto && proto.initialize || methods && methods.initialize) code.push("this.initialize();");
    code.push("}}");
    var ctor = new Function(code.join(""))();
    if (proto) {
        ctor.prototype = proto;
        ctor.BASE = base;
    }
    if (base) base.SUBCLASSES.push(ctor);
    ctor.prototype.CTOR = ctor;
    ctor.PROPS = props || null;
    ctor.SELF_PROPS = self_props;
    ctor.SUBCLASSES = [];
    if (type) {
        ctor.prototype.TYPE = ctor.TYPE = type;
    }
    if (methods) for (var name in methods) if (HOP(methods, name)) {
        if (/^\$/.test(name)) {
            ctor[name.substr(1)] = methods[name];
        } else {
            ctor.prototype[name] = methods[name];
        }
    }
    ctor.DEFMETHOD = function(name, method) {
        this.prototype[name] = method;
    };
    if (typeof exports !== "undefined") {
        exports["AST_" + type] = ctor;
    }
    return ctor;
}

var AST_Token = DEFNODE("Token", "type value line col pos endline endcol endpos nlb comments_before comments_after file raw", {
}, null);

var AST_Node = DEFNODE("Node", "start end", {
    _clone: function(deep) {
        if (deep) {
            var self = this.clone();
            return self.transform(new TreeTransformer(function(node) {
                if (node !== self) {
                    return node.clone(true);
                }
            }));
        }
        return new this.CTOR(this);
    },
    clone: function(deep) {
        return this._clone(deep);
    },
    $documentation: "Base class of all AST nodes",
    $propdoc: {
        start: "[AST_Token] The first token of this node",
        end: "[AST_Token] The last token of this node"
    },
    walk: function(visitor) {
        visitor.visit(this);
    },
    _validate: noop,
    validate: function() {
        var ctor = this.CTOR;
        do {
            ctor.prototype._validate.call(this);
        } while (ctor = ctor.BASE);
    },
    validate_ast: function() {
        var marker = {};
        this.walk(new TreeWalker(function(node) {
            if (node.validate_visited === marker) {
                throw new Error(string_template("cannot reuse {type} from [{file}:{line},{col}]", {
                    type: "AST_" + node.TYPE,
                    file: node.start.file,
                    line: node.start.line,
                    col: node.start.col,
                }));
            }
            node.validate_visited = marker;
        }));
    },
}, null);

(AST_Node.log_function = function(fn, verbose) {
    if (!fn) {
        AST_Node.info = AST_Node.warn = noop;
        return;
    }
    var printed = Object.create(null);
    AST_Node.info = verbose ? function(text, props) {
        log("INFO: " + string_template(text, props));
    } : noop;
    AST_Node.warn = function(text, props) {
        log("WARN: " + string_template(text, props));
    };

    function log(msg) {
        if (printed[msg]) return;
        printed[msg] = true;
        fn(msg);
    }
})();

var restore_transforms = [];
AST_Node.enable_validation = function() {
    AST_Node.disable_validation();
    (function validate_transform(ctor) {
        var transform = ctor.prototype.transform;
        ctor.prototype.transform = function(tw, in_list) {
            var node = transform.call(this, tw, in_list);
            if (node instanceof AST_Node) {
                node.validate();
            } else if (!(node === null || in_list && List.is_op(node))) {
                throw new Error("invalid transformed value: " + node);
            }
            return node;
        };
        restore_transforms.push(function() {
            ctor.prototype.transform = transform;
        });
        ctor.SUBCLASSES.forEach(validate_transform);
    })(this);
};

AST_Node.disable_validation = function() {
    var restore;
    while (restore = restore_transforms.pop()) restore();
};

/* -----[ statements ]----- */

var AST_Statement = DEFNODE("Statement", null, {
    $documentation: "Base class of all statements",
});

var AST_Debugger = DEFNODE("Debugger", null, {
    $documentation: "Represents a debugger statement",
}, AST_Statement);

var AST_Directive = DEFNODE("Directive", "value quote", {
    $documentation: "Represents a directive, like \"use strict\";",
    $propdoc: {
        value: "[string] The value of this directive as a plain string (it's not an AST_String!)",
        quote: "[string] the original quote character"
    },
    _validate: function() {
        if (typeof this.value != "string") throw new Error("value must be string");
    },
}, AST_Statement);

var AST_EmptyStatement = DEFNODE("EmptyStatement", null, {
    $documentation: "The empty statement (empty block or simply a semicolon)"
}, AST_Statement);

function validate_expression(value, prop, multiple, allow_spread, allow_hole) {
    multiple = multiple ? "contain" : "be";
    if (!(value instanceof AST_Node)) throw new Error(prop + " must " + multiple + " AST_Node");
    if (value instanceof AST_DefaultValue) throw new Error(prop + " cannot " + multiple + " AST_DefaultValue");
    if (value instanceof AST_Destructured) throw new Error(prop + " cannot " + multiple + " AST_Destructured");
    if (value instanceof AST_Hole && !allow_hole) throw new Error(prop + " cannot " + multiple + " AST_Hole");
    if (value instanceof AST_Spread && !allow_spread) throw new Error(prop + " cannot " + multiple + " AST_Spread");
    if (value instanceof AST_Statement && !is_function(value)) {
        throw new Error(prop + " cannot " + multiple + " AST_Statement");
    }
    if (value instanceof AST_SymbolDeclaration) {
        throw new Error(prop + " cannot " + multiple + " AST_SymbolDeclaration");
    }
}

function must_be_expression(node, prop) {
    validate_expression(node[prop], prop);
}

var AST_SimpleStatement = DEFNODE("SimpleStatement", "body", {
    $documentation: "A statement consisting of an expression, i.e. a = 1 + 2",
    $propdoc: {
        body: "[AST_Node] an expression node (should not be instanceof AST_Statement)"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.body.walk(visitor);
        });
    },
    _validate: function() {
        must_be_expression(this, "body");
    },
}, AST_Statement);

var AST_BlockScope = DEFNODE("BlockScope", "enclosed functions make_def parent_scope variables", {
    $documentation: "Base class for all statements introducing a lexical scope",
    $propdoc: {
        enclosed: "[SymbolDef*/S] a list of all symbol definitions that are accessed from this scope or any subscopes",
        functions: "[Object/S] like `variables`, but only lists function declarations",
        parent_scope: "[AST_Scope?/S] link to the parent scope",
        variables: "[Object/S] a map of name -> SymbolDef for all variables/functions defined in this scope",
    },
    clone: function(deep) {
        var node = this._clone(deep);
        if (this.enclosed) node.enclosed = this.enclosed.slice();
        if (this.functions) node.functions = this.functions.clone();
        if (this.variables) node.variables = this.variables.clone();
        return node;
    },
    pinned: function() {
        return this.resolve().pinned();
    },
    resolve: function() {
        return this.parent_scope.resolve();
    },
    _validate: function() {
        if (this.parent_scope == null) return;
        if (!(this.parent_scope instanceof AST_BlockScope)) throw new Error("parent_scope must be AST_BlockScope");
        if (!(this.resolve() instanceof AST_Scope)) throw new Error("must be contained within AST_Scope");
    },
}, AST_Statement);

function walk_body(node, visitor) {
    node.body.forEach(function(node) {
        node.walk(visitor);
    });
}

var AST_Block = DEFNODE("Block", "body", {
    $documentation: "A body of statements (usually braced)",
    $propdoc: {
        body: "[AST_Statement*] an array of statements"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            walk_body(node, visitor);
        });
    },
    _validate: function() {
        this.body.forEach(function(node) {
            if (!(node instanceof AST_Statement)) throw new Error("body must be AST_Statement[]");
            if (is_function(node)) throw new Error("body cannot contain AST_Function");
        });
    },
}, AST_BlockScope);

var AST_BlockStatement = DEFNODE("BlockStatement", null, {
    $documentation: "A block statement",
}, AST_Block);

var AST_StatementWithBody = DEFNODE("StatementWithBody", "body", {
    $documentation: "Base class for all statements that contain one nested body: `For`, `ForIn`, `Do`, `While`, `With`",
    $propdoc: {
        body: "[AST_Statement] the body; this should always be present, even if it's an AST_EmptyStatement"
    },
    _validate: function() {
        if (!(this.body instanceof AST_Statement)) throw new Error("body must be AST_Statement");
        if (is_function(this.body)) throw new Error("body cannot be AST_Function");
    },
}, AST_BlockScope);

var AST_LabeledStatement = DEFNODE("LabeledStatement", "label", {
    $documentation: "Statement with a label",
    $propdoc: {
        label: "[AST_Label] a label definition"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.label.walk(visitor);
            node.body.walk(visitor);
        });
    },
    clone: function(deep) {
        var node = this._clone(deep);
        if (deep) {
            var label = node.label;
            var def = this.label;
            node.walk(new TreeWalker(function(node) {
                if (node instanceof AST_LoopControl) {
                    if (!node.label || node.label.thedef !== def) return;
                    node.label.thedef = label;
                    label.references.push(node);
                    return true;
                }
                if (node instanceof AST_Scope) return true;
            }));
        }
        return node;
    },
    _validate: function() {
        if (!(this.label instanceof AST_Label)) throw new Error("label must be AST_Label");
    },
}, AST_StatementWithBody);

var AST_IterationStatement = DEFNODE("IterationStatement", null, {
    $documentation: "Internal class.  All loops inherit from it."
}, AST_StatementWithBody);

var AST_DWLoop = DEFNODE("DWLoop", "condition", {
    $documentation: "Base class for do/while statements",
    $propdoc: {
        condition: "[AST_Node] the loop condition.  Should not be instanceof AST_Statement"
    },
    _validate: function() {
        must_be_expression(this, "condition");
    },
}, AST_IterationStatement);

var AST_Do = DEFNODE("Do", null, {
    $documentation: "A `do` statement",
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.body.walk(visitor);
            node.condition.walk(visitor);
        });
    }
}, AST_DWLoop);

var AST_While = DEFNODE("While", null, {
    $documentation: "A `while` statement",
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.condition.walk(visitor);
            node.body.walk(visitor);
        });
    }
}, AST_DWLoop);

var AST_For = DEFNODE("For", "init condition step", {
    $documentation: "A `for` statement",
    $propdoc: {
        init: "[AST_Node?] the `for` initialization code, or null if empty",
        condition: "[AST_Node?] the `for` termination clause, or null if empty",
        step: "[AST_Node?] the `for` update clause, or null if empty"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            if (node.init) node.init.walk(visitor);
            if (node.condition) node.condition.walk(visitor);
            if (node.step) node.step.walk(visitor);
            node.body.walk(visitor);
        });
    },
    _validate: function() {
        if (this.init != null) {
            if (!(this.init instanceof AST_Node)) throw new Error("init must be AST_Node");
            if (this.init instanceof AST_Statement
                && !(this.init instanceof AST_Definitions || is_function(this.init))) {
                throw new Error("init cannot be AST_Statement");
            }
        }
        if (this.condition != null) must_be_expression(this, "condition");
        if (this.step != null) must_be_expression(this, "step");
    },
}, AST_IterationStatement);

var AST_ForIn = DEFNODE("ForIn", "init object", {
    $documentation: "A `for ... in` statement",
    $propdoc: {
        init: "[AST_Node] the `for/in` initialization code",
        object: "[AST_Node] the object that we're looping through"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.init.walk(visitor);
            node.object.walk(visitor);
            node.body.walk(visitor);
        });
    },
    _validate: function() {
        if (this.init instanceof AST_Definitions) {
            if (this.init.definitions.length != 1) throw new Error("init must have single declaration");
        } else {
            validate_destructured(this.init, function(node) {
                if (!(node instanceof AST_PropAccess || node instanceof AST_SymbolRef)) {
                    throw new Error("init must be assignable: " + node.TYPE);
                }
            });
        }
        must_be_expression(this, "object");
    },
}, AST_IterationStatement);

var AST_With = DEFNODE("With", "expression", {
    $documentation: "A `with` statement",
    $propdoc: {
        expression: "[AST_Node] the `with` expression"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.expression.walk(visitor);
            node.body.walk(visitor);
        });
    },
    _validate: function() {
        must_be_expression(this, "expression");
    },
}, AST_StatementWithBody);

/* -----[ scope and functions ]----- */

var AST_Scope = DEFNODE("Scope", "uses_eval uses_with", {
    $documentation: "Base class for all statements introducing a lexical scope",
    $propdoc: {
        uses_eval: "[boolean/S] tells whether this scope contains a direct call to the global `eval`",
        uses_with: "[boolean/S] tells whether this scope uses the `with` statement",
    },
    pinned: function() {
        return this.uses_eval || this.uses_with;
    },
    resolve: return_this,
}, AST_Block);

var AST_Toplevel = DEFNODE("Toplevel", "globals", {
    $documentation: "The toplevel scope",
    $propdoc: {
        globals: "[Object/S] a map of name -> SymbolDef for all undeclared names",
    },
    wrap: function(name) {
        var body = this.body;
        return parse([
            "(function(exports){'$ORIG';})(typeof ",
            name,
            "=='undefined'?(",
            name,
            "={}):",
            name,
            ");"
        ].join(""), {
            filename: "wrap=" + JSON.stringify(name)
        }).transform(new TreeTransformer(function(node) {
            if (node instanceof AST_Directive && node.value == "$ORIG") {
                return List.splice(body);
            }
        }));
    },
    enclose: function(args_values) {
        if (typeof args_values != "string") args_values = "";
        var index = args_values.indexOf(":");
        if (index < 0) index = args_values.length;
        var body = this.body;
        return parse([
            "(function(",
            args_values.slice(0, index),
            '){"$ORIG"})(',
            args_values.slice(index + 1),
            ")"
        ].join(""), {
            filename: "enclose=" + JSON.stringify(args_values)
        }).transform(new TreeTransformer(function(node) {
            if (node instanceof AST_Directive && node.value == "$ORIG") {
                return List.splice(body);
            }
        }));
    }
}, AST_Scope);

var AST_Lambda = DEFNODE("Lambda", "argnames length_read uses_arguments", {
    $documentation: "Base class for functions",
    $propdoc: {
        argnames: "[(AST_Destructured|AST_SymbolFunarg)*] array of function arguments and/or destructured literals",
        uses_arguments: "[boolean/S] tells whether this function accesses the arguments array",
    },
    each_argname: function(visit) {
        var tw = new TreeWalker(function(node) {
            if (node instanceof AST_DestructuredKeyVal) {
                node.value.walk(tw);
                return true;
            }
            if (node instanceof AST_SymbolFunarg) visit(node);
        });
        this.argnames.forEach(function(argname) {
            argname.walk(tw);
        });
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            if (node.name) node.name.walk(visitor);
            node.argnames.forEach(function(argname) {
                argname.walk(visitor);
            });
            walk_body(node, visitor);
        });
    },
    _validate: function() {
        this.argnames.forEach(function(node) {
            validate_destructured(node, function(node) {
                if (!(node instanceof AST_SymbolFunarg)) throw new Error("argnames must be AST_SymbolFunarg[]");
            }, true);
        });
    },
}, AST_Scope);

var AST_Accessor = DEFNODE("Accessor", null, {
    $documentation: "A getter/setter function",
    _validate: function() {
        if (this.name != null) throw new Error("name must be null");
    },
}, AST_Lambda);

function is_function(node) {
    return node instanceof AST_Arrow || node instanceof AST_AsyncFunction || node instanceof AST_Function;
}

var AST_Arrow = DEFNODE("Arrow", "inlined value", {
    $documentation: "An arrow function expression",
    $propdoc: {
        value: "[AST_Node?] simple return expression, or null if using function body.",
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.argnames.forEach(function(argname) {
                argname.walk(visitor);
            });
            if (node.value) {
                node.value.walk(visitor);
            } else {
                walk_body(node, visitor);
            }
        });
    },
    _validate: function() {
        if (this.name != null) throw new Error("name must be null");
        if (this.uses_arguments) throw new Error("uses_arguments must be false");
        if (this.value != null) {
            must_be_expression(this, "value");
            if (this.body.length) throw new Error("body must be empty if value exists");
        }
    },
}, AST_Lambda);

function is_async(node) {
    return node instanceof AST_AsyncDefun || node instanceof AST_AsyncFunction;
}

var AST_AsyncFunction = DEFNODE("AsyncFunction", "inlined name", {
    $documentation: "An asynchronous function expression",
    $propdoc: {
        name: "[AST_SymbolLambda?] the name of this function",
    },
    _validate: function() {
        if (this.name != null) {
            if (!(this.name instanceof AST_SymbolLambda)) throw new Error("name must be AST_SymbolLambda");
        }
    },
}, AST_Lambda);

var AST_Function = DEFNODE("Function", "inlined name", {
    $documentation: "A function expression",
    $propdoc: {
        name: "[AST_SymbolLambda?] the name of this function",
    },
    _validate: function() {
        if (this.name != null) {
            if (!(this.name instanceof AST_SymbolLambda)) throw new Error("name must be AST_SymbolLambda");
        }
    },
}, AST_Lambda);

function is_defun(node) {
    return node instanceof AST_AsyncDefun || node instanceof AST_Defun;
}

var AST_AsyncDefun = DEFNODE("AsyncDefun", "inlined name", {
    $documentation: "An asynchronous function definition",
    $propdoc: {
        name: "[AST_SymbolDefun] the name of this function",
    },
    _validate: function() {
        if (!(this.name instanceof AST_SymbolDefun)) throw new Error("name must be AST_SymbolDefun");
    },
}, AST_Lambda);

var AST_Defun = DEFNODE("Defun", "inlined name", {
    $documentation: "A function definition",
    $propdoc: {
        name: "[AST_SymbolDefun] the name of this function",
    },
    _validate: function() {
        if (!(this.name instanceof AST_SymbolDefun)) throw new Error("name must be AST_SymbolDefun");
    },
}, AST_Lambda);

/* -----[ JUMPS ]----- */

var AST_Jump = DEFNODE("Jump", null, {
    $documentation: "Base class for “jumps” (for now that's `return`, `throw`, `break` and `continue`)"
}, AST_Statement);

var AST_Exit = DEFNODE("Exit", "value", {
    $documentation: "Base class for “exits” (`return` and `throw`)",
    $propdoc: {
        value: "[AST_Node?] the value returned or thrown by this statement; could be null for AST_Return"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            if (node.value) node.value.walk(visitor);
        });
    }
}, AST_Jump);

var AST_Return = DEFNODE("Return", null, {
    $documentation: "A `return` statement",
    _validate: function() {
        if (this.value != null) must_be_expression(this, "value");
    },
}, AST_Exit);

var AST_Throw = DEFNODE("Throw", null, {
    $documentation: "A `throw` statement",
    _validate: function() {
        must_be_expression(this, "value");
    },
}, AST_Exit);

var AST_LoopControl = DEFNODE("LoopControl", "label", {
    $documentation: "Base class for loop control statements (`break` and `continue`)",
    $propdoc: {
        label: "[AST_LabelRef?] the label, or null if none",
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            if (node.label) node.label.walk(visitor);
        });
    },
    _validate: function() {
        if (this.label != null) {
            if (!(this.label instanceof AST_LabelRef)) throw new Error("label must be AST_LabelRef");
        }
    },
}, AST_Jump);

var AST_Break = DEFNODE("Break", null, {
    $documentation: "A `break` statement"
}, AST_LoopControl);

var AST_Continue = DEFNODE("Continue", null, {
    $documentation: "A `continue` statement"
}, AST_LoopControl);

/* -----[ IF ]----- */

var AST_If = DEFNODE("If", "condition alternative", {
    $documentation: "A `if` statement",
    $propdoc: {
        condition: "[AST_Node] the `if` condition",
        alternative: "[AST_Statement?] the `else` part, or null if not present"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.condition.walk(visitor);
            node.body.walk(visitor);
            if (node.alternative) node.alternative.walk(visitor);
        });
    },
    _validate: function() {
        must_be_expression(this, "condition");
        if (this.alternative != null) {
            if (!(this.alternative instanceof AST_Statement)) throw new Error("alternative must be AST_Statement");
            if (is_function(this.alternative)) throw new error("alternative cannot be AST_Function");
        }
    },
}, AST_StatementWithBody);

/* -----[ SWITCH ]----- */

var AST_Switch = DEFNODE("Switch", "expression", {
    $documentation: "A `switch` statement",
    $propdoc: {
        expression: "[AST_Node] the `switch` “discriminant”"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.expression.walk(visitor);
            walk_body(node, visitor);
        });
    },
    _validate: function() {
        must_be_expression(this, "expression");
        this.body.forEach(function(node) {
            if (!(node instanceof AST_SwitchBranch)) throw new Error("body must be AST_SwitchBranch[]");
        });
    },
}, AST_Block);

var AST_SwitchBranch = DEFNODE("SwitchBranch", null, {
    $documentation: "Base class for `switch` branches",
}, AST_Block);

var AST_Default = DEFNODE("Default", null, {
    $documentation: "A `default` switch branch",
}, AST_SwitchBranch);

var AST_Case = DEFNODE("Case", "expression", {
    $documentation: "A `case` switch branch",
    $propdoc: {
        expression: "[AST_Node] the `case` expression"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.expression.walk(visitor);
            walk_body(node, visitor);
        });
    },
    _validate: function() {
        must_be_expression(this, "expression");
    },
}, AST_SwitchBranch);

/* -----[ EXCEPTIONS ]----- */

var AST_Try = DEFNODE("Try", "bcatch bfinally", {
    $documentation: "A `try` statement",
    $propdoc: {
        bcatch: "[AST_Catch?] the catch block, or null if not present",
        bfinally: "[AST_Finally?] the finally block, or null if not present"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            walk_body(node, visitor);
            if (node.bcatch) node.bcatch.walk(visitor);
            if (node.bfinally) node.bfinally.walk(visitor);
        });
    },
    _validate: function() {
        if (this.bcatch != null) {
            if (!(this.bcatch instanceof AST_Catch)) throw new Error("bcatch must be AST_Catch");
        }
        if (this.bfinally != null) {
            if (!(this.bfinally instanceof AST_Finally)) throw new Error("bfinally must be AST_Finally");
        }
    },
}, AST_Block);

var AST_Catch = DEFNODE("Catch", "argname", {
    $documentation: "A `catch` node; only makes sense as part of a `try` statement",
    $propdoc: {
        argname: "[(AST_Destructured|AST_SymbolCatch)?] symbol for the exception, or null if not present",
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            if (node.argname) node.argname.walk(visitor);
            walk_body(node, visitor);
        });
    },
    _validate: function() {
        if (this.argname != null) validate_destructured(this.argname, function(node) {
            if (!(node instanceof AST_SymbolCatch)) throw new Error("argname must be AST_SymbolCatch");
        });
    },
}, AST_Block);

var AST_Finally = DEFNODE("Finally", null, {
    $documentation: "A `finally` node; only makes sense as part of a `try` statement"
}, AST_Block);

/* -----[ VAR ]----- */

var AST_Definitions = DEFNODE("Definitions", "definitions", {
    $documentation: "Base class for `var` nodes (variable declarations/initializations)",
    $propdoc: {
        definitions: "[AST_VarDef*] array of variable definitions"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.definitions.forEach(function(defn) {
                defn.walk(visitor);
            });
        });
    },
    _validate: function() {
        if (this.definitions.length < 1) throw new Error("must have at least one definition");
    },
}, AST_Statement);

var AST_Const = DEFNODE("Const", null, {
    $documentation: "A `const` statement",
    _validate: function() {
        this.definitions.forEach(function(node) {
            if (!(node instanceof AST_VarDef)) throw new Error("definitions must be AST_VarDef[]");
            validate_destructured(node.name, function(node) {
                if (!(node instanceof AST_SymbolConst)) throw new Error("name must be AST_SymbolConst");
            });
        });
    },
}, AST_Definitions);

var AST_Let = DEFNODE("Let", null, {
    $documentation: "A `let` statement",
    _validate: function() {
        this.definitions.forEach(function(node) {
            if (!(node instanceof AST_VarDef)) throw new Error("definitions must be AST_VarDef[]");
            validate_destructured(node.name, function(node) {
                if (!(node instanceof AST_SymbolLet)) throw new Error("name must be AST_SymbolLet");
            });
        });
    },
}, AST_Definitions);

var AST_Var = DEFNODE("Var", null, {
    $documentation: "A `var` statement",
    _validate: function() {
        this.definitions.forEach(function(node) {
            if (!(node instanceof AST_VarDef)) throw new Error("definitions must be AST_VarDef[]");
            validate_destructured(node.name, function(node) {
                if (!(node instanceof AST_SymbolVar)) throw new Error("name must be AST_SymbolVar");
            });
        });
    },
}, AST_Definitions);

var AST_VarDef = DEFNODE("VarDef", "name value", {
    $documentation: "A variable declaration; only appears in a AST_Definitions node",
    $propdoc: {
        name: "[AST_Destructured|AST_SymbolVar] name of the variable",
        value: "[AST_Node?] initializer, or null of there's no initializer",
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.name.walk(visitor);
            if (node.value) node.value.walk(visitor);
        });
    },
    _validate: function() {
        if (this.value != null) must_be_expression(this, "value");
    },
});

/* -----[ OTHER ]----- */

var AST_DefaultValue = DEFNODE("DefaultValue", "name value", {
    $documentation: "A default value declaration",
    $propdoc: {
        name: "[AST_Destructured|AST_SymbolDeclaration] name of the variable",
        value: "[AST_Node] value to assign if variable is `undefined`",
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.name.walk(visitor);
            node.value.walk(visitor);
        });
    },
    _validate: function() {
        must_be_expression(this, "value");
    },
});

function must_be_expressions(node, prop, allow_spread, allow_hole) {
    node[prop].forEach(function(node) {
        validate_expression(node, prop, true, allow_spread, allow_hole);
    });
}

var AST_Call = DEFNODE("Call", "expression args pure", {
    $documentation: "A function call expression",
    $propdoc: {
        expression: "[AST_Node] expression to invoke as function",
        args: "[AST_Node*] array of arguments"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.expression.walk(visitor);
            node.args.forEach(function(arg) {
                arg.walk(visitor);
            });
        });
    },
    _validate: function() {
        must_be_expression(this, "expression");
        must_be_expressions(this, "args", true);
    },
});

var AST_New = DEFNODE("New", null, {
    $documentation: "An object instantiation.  Derives from a function call since it has exactly the same properties"
}, AST_Call);

var AST_Sequence = DEFNODE("Sequence", "expressions", {
    $documentation: "A sequence expression (comma-separated expressions)",
    $propdoc: {
        expressions: "[AST_Node*] array of expressions (at least two)"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.expressions.forEach(function(expr) {
                expr.walk(visitor);
            });
        });
    },
    _validate: function() {
        if (this.expressions.length < 2) throw new Error("expressions must contain multiple elements");
        must_be_expressions(this, "expressions");
    },
});

var AST_PropAccess = DEFNODE("PropAccess", "expression property", {
    $documentation: "Base class for property access expressions, i.e. `a.foo` or `a[\"foo\"]`",
    $propdoc: {
        expression: "[AST_Node] the “container” expression",
        property: "[AST_Node|string] the property to access.  For AST_Dot this is always a plain string, while for AST_Sub it's an arbitrary AST_Node"
    },
    getProperty: function() {
        var p = this.property;
        if (p instanceof AST_Constant) {
            return p.value;
        }
        if (p instanceof AST_UnaryPrefix
            && p.operator == "void"
            && p.expression instanceof AST_Constant) {
            return;
        }
        return p;
    },
    _validate: function() {
        must_be_expression(this, "expression");
    },
});

var AST_Dot = DEFNODE("Dot", null, {
    $documentation: "A dotted property access expression",
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.expression.walk(visitor);
        });
    },
    _validate: function() {
        if (typeof this.property != "string") throw new Error("property must be string");
    },
}, AST_PropAccess);

var AST_Sub = DEFNODE("Sub", null, {
    $documentation: "Index-style property access, i.e. `a[\"foo\"]`",
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.expression.walk(visitor);
            node.property.walk(visitor);
        });
    },
    _validate: function() {
        must_be_expression(this, "property");
    },
}, AST_PropAccess);

var AST_Spread = DEFNODE("Spread", "expression", {
    $documentation: "Spread expression in array/object literals or function calls",
    $propdoc: {
        expression: "[AST_Node] expression to be expanded",
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.expression.walk(visitor);
        });
    },
    _validate: function() {
        must_be_expression(this, "expression");
    },
});

var AST_Unary = DEFNODE("Unary", "operator expression", {
    $documentation: "Base class for unary expressions",
    $propdoc: {
        operator: "[string] the operator",
        expression: "[AST_Node] expression that this unary operator applies to"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.expression.walk(visitor);
        });
    },
    _validate: function() {
        if (typeof this.operator != "string") throw new Error("operator must be string");
        must_be_expression(this, "expression");
    },
});

var AST_UnaryPrefix = DEFNODE("UnaryPrefix", null, {
    $documentation: "Unary prefix expression, i.e. `typeof i` or `++i`"
}, AST_Unary);

var AST_UnaryPostfix = DEFNODE("UnaryPostfix", null, {
    $documentation: "Unary postfix expression, i.e. `i++`"
}, AST_Unary);

var AST_Binary = DEFNODE("Binary", "operator left right", {
    $documentation: "Binary expression, i.e. `a + b`",
    $propdoc: {
        left: "[AST_Node] left-hand side expression",
        operator: "[string] the operator",
        right: "[AST_Node] right-hand side expression"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.left.walk(visitor);
            node.right.walk(visitor);
        });
    },
    _validate: function() {
        if (!(this instanceof AST_Assign)) must_be_expression(this, "left");
        if (typeof this.operator != "string") throw new Error("operator must be string");
        must_be_expression(this, "right");
    },
});

var AST_Conditional = DEFNODE("Conditional", "condition consequent alternative", {
    $documentation: "Conditional expression using the ternary operator, i.e. `a ? b : c`",
    $propdoc: {
        condition: "[AST_Node]",
        consequent: "[AST_Node]",
        alternative: "[AST_Node]"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.condition.walk(visitor);
            node.consequent.walk(visitor);
            node.alternative.walk(visitor);
        });
    },
    _validate: function() {
        must_be_expression(this, "condition");
        must_be_expression(this, "consequent");
        must_be_expression(this, "alternative");
    },
});

var AST_Assign = DEFNODE("Assign", null, {
    $documentation: "An assignment expression — `a = b + 5`",
    _validate: function() {
        if (this.operator.indexOf("=") < 0) throw new Error('operator must contain "="');
        if (this.left instanceof AST_Destructured) {
            if (this.operator != "=") throw new Error("invalid destructuring operator: " + this.operator);
            validate_destructured(this.left, function(node) {
                if (!(node instanceof AST_PropAccess || node instanceof AST_SymbolRef)) {
                    throw new Error("left must be assignable: " + node.TYPE);
                }
            });
        }
    },
}, AST_Binary);

var AST_Await = DEFNODE("Await", "expression", {
    $documentation: "An await expression",
    $propdoc: {
        expression: "[AST_Node] expression with Promise to resolve on",
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.expression.walk(visitor);
        });
    },
    _validate: function() {
        must_be_expression(this, "expression");
    },
});

/* -----[ LITERALS ]----- */

var AST_Array = DEFNODE("Array", "elements", {
    $documentation: "An array literal",
    $propdoc: {
        elements: "[AST_Node*] array of elements"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.elements.forEach(function(element) {
                element.walk(visitor);
            });
        });
    },
    _validate: function() {
        must_be_expressions(this, "elements", true, true);
    },
});

var AST_Destructured = DEFNODE("Destructured", null, {
    $documentation: "Base class for destructured literal",
});

function validate_destructured(node, check, allow_default) {
    if (node instanceof AST_DefaultValue && allow_default) return validate_destructured(node.name, check);
    if (node instanceof AST_DestructuredArray) return node.elements.forEach(function(node) {
        if (!(node instanceof AST_Hole)) validate_destructured(node, check, true);
    });
    if (node instanceof AST_DestructuredObject) return node.properties.forEach(function(prop) {
        validate_destructured(prop.value, check, true);
    });
    check(node);
}

var AST_DestructuredArray = DEFNODE("DestructuredArray", "elements", {
    $documentation: "A destructured array literal",
    $propdoc: {
        elements: "[AST_Node*] array of elements",
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.elements.forEach(function(element) {
                element.walk(visitor);
            });
        });
    },
}, AST_Destructured);

var AST_DestructuredKeyVal = DEFNODE("DestructuredKeyVal", "key value", {
    $documentation: "A key: value destructured property",
    $propdoc: {
        key: "[string|AST_Node] property name.  For computed property this is an AST_Node.",
        value: "[AST_Node] property value",
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            if (node.key instanceof AST_Node) node.key.walk(visitor);
            node.value.walk(visitor);
        });
    },
    _validate: function() {
        if (typeof this.key != "string") {
            if (!(this.key instanceof AST_Node)) throw new Error("key must be string or AST_Node");
            must_be_expression(this, "key");
        }
        if (!(this.value instanceof AST_Node)) throw new Error("value must be AST_Node");
    },
});

var AST_DestructuredObject = DEFNODE("DestructuredObject", "properties", {
    $documentation: "A destructured object literal",
    $propdoc: {
        properties: "[AST_DestructuredKeyVal*] array of properties",
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.properties.forEach(function(prop) {
                prop.walk(visitor);
            });
        });
    },
    _validate: function() {
        this.properties.forEach(function(node) {
            if (!(node instanceof AST_DestructuredKeyVal)) throw new Error("properties must be AST_DestructuredKeyVal[]");
        });
    },
}, AST_Destructured);

var AST_Object = DEFNODE("Object", "properties", {
    $documentation: "An object literal",
    $propdoc: {
        properties: "[(AST_ObjectProperty|AST_Spread)*] array of properties"
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            node.properties.forEach(function(prop) {
                prop.walk(visitor);
            });
        });
    },
    _validate: function() {
        this.properties.forEach(function(node) {
            if (!(node instanceof AST_ObjectProperty || node instanceof AST_Spread)) {
                throw new Error("properties must contain AST_ObjectProperty and/or AST_Spread only");
            }
        });
    },
});

var AST_ObjectProperty = DEFNODE("ObjectProperty", "key value", {
    $documentation: "Base class for literal object properties",
    $propdoc: {
        key: "[string|AST_Node] property name.  For computed property this is an AST_Node.",
        value: "[AST_Node] property value.  For getters and setters this is an AST_Accessor.",
    },
    walk: function(visitor) {
        var node = this;
        visitor.visit(node, function() {
            if (node.key instanceof AST_Node) node.key.walk(visitor);
            node.value.walk(visitor);
        });
    },
    _validate: function() {
        if (typeof this.key != "string") {
            if (!(this.key instanceof AST_Node)) throw new Error("key must be string or AST_Node");
            must_be_expression(this, "key");
        }
        if (!(this.value instanceof AST_Node)) throw new Error("value must be AST_Node");
    },
});

var AST_ObjectKeyVal = DEFNODE("ObjectKeyVal", null, {
    $documentation: "A key: value object property",
    _validate: function() {
        must_be_expression(this, "value");
    },
}, AST_ObjectProperty);

var AST_ObjectSetter = DEFNODE("ObjectSetter", null, {
    $documentation: "An object setter property",
    _validate: function() {
        if (!(this.value instanceof AST_Accessor)) throw new Error("value must be AST_Accessor");
    },
}, AST_ObjectProperty);

var AST_ObjectGetter = DEFNODE("ObjectGetter", null, {
    $documentation: "An object getter property",
    _validate: function() {
        if (!(this.value instanceof AST_Accessor)) throw new Error("value must be AST_Accessor");
    },
}, AST_ObjectProperty);

var AST_Symbol = DEFNODE("Symbol", "scope name thedef", {
    $documentation: "Base class for all symbols",
    $propdoc: {
        name: "[string] name of this symbol",
        scope: "[AST_Scope/S] the current scope (not necessarily the definition scope)",
        thedef: "[SymbolDef/S] the definition of this symbol"
    },
    _validate: function() {
        if (typeof this.name != "string") throw new Error("name must be string");
    },
});

var AST_SymbolDeclaration = DEFNODE("SymbolDeclaration", "init", {
    $documentation: "A declaration symbol (symbol in var, function name or argument, symbol in catch)",
}, AST_Symbol);

var AST_SymbolConst = DEFNODE("SymbolConst", null, {
    $documentation: "Symbol defining a constant",
}, AST_SymbolDeclaration);

var AST_SymbolLet = DEFNODE("SymbolLet", null, {
    $documentation: "Symbol defining a lexical-scoped variable",
}, AST_SymbolDeclaration);

var AST_SymbolVar = DEFNODE("SymbolVar", null, {
    $documentation: "Symbol defining a variable",
}, AST_SymbolDeclaration);

var AST_SymbolFunarg = DEFNODE("SymbolFunarg", null, {
    $documentation: "Symbol naming a function argument",
}, AST_SymbolVar);

var AST_SymbolDefun = DEFNODE("SymbolDefun", null, {
    $documentation: "Symbol defining a function",
}, AST_SymbolDeclaration);

var AST_SymbolLambda = DEFNODE("SymbolLambda", null, {
    $documentation: "Symbol naming a function expression",
}, AST_SymbolDeclaration);

var AST_SymbolCatch = DEFNODE("SymbolCatch", null, {
    $documentation: "Symbol naming the exception in catch",
}, AST_SymbolDeclaration);

var AST_Label = DEFNODE("Label", "references", {
    $documentation: "Symbol naming a label (declaration)",
    $propdoc: {
        references: "[AST_LoopControl*] a list of nodes referring to this label"
    },
    initialize: function() {
        this.references = [];
        this.thedef = this;
    }
}, AST_Symbol);

var AST_SymbolRef = DEFNODE("SymbolRef", "fixed in_arg", {
    $documentation: "Reference to some symbol (not definition/declaration)",
}, AST_Symbol);

var AST_LabelRef = DEFNODE("LabelRef", null, {
    $documentation: "Reference to a label symbol",
}, AST_Symbol);

var AST_This = DEFNODE("This", null, {
    $documentation: "The `this` symbol",
    _validate: function() {
        if (this.name !== "this") throw new Error('name must be "this"');
    },
}, AST_Symbol);

var AST_Constant = DEFNODE("Constant", null, {
    $documentation: "Base class for all constants",
});

var AST_String = DEFNODE("String", "value quote", {
    $documentation: "A string literal",
    $propdoc: {
        value: "[string] the contents of this string",
        quote: "[string] the original quote character"
    },
    _validate: function() {
        if (typeof this.value != "string") throw new Error("value must be string");
    },
}, AST_Constant);

var AST_Number = DEFNODE("Number", "value", {
    $documentation: "A number literal",
    $propdoc: {
        value: "[number] the numeric value",
    },
    _validate: function() {
        if (typeof this.value != "number") throw new Error("value must be number");
    },
}, AST_Constant);

var AST_RegExp = DEFNODE("RegExp", "value", {
    $documentation: "A regexp literal",
    $propdoc: {
        value: "[RegExp] the actual regexp"
    },
    _validate: function() {
        if (!(this.value instanceof RegExp)) throw new Error("value must be RegExp");
    },
}, AST_Constant);

var AST_Atom = DEFNODE("Atom", null, {
    $documentation: "Base class for atoms",
}, AST_Constant);

var AST_Null = DEFNODE("Null", null, {
    $documentation: "The `null` atom",
    value: null
}, AST_Atom);

var AST_NaN = DEFNODE("NaN", null, {
    $documentation: "The impossible value",
    value: 0/0
}, AST_Atom);

var AST_Undefined = DEFNODE("Undefined", null, {
    $documentation: "The `undefined` value",
    value: function(){}()
}, AST_Atom);

var AST_Hole = DEFNODE("Hole", null, {
    $documentation: "A hole in an array",
    value: function(){}()
}, AST_Atom);

var AST_Infinity = DEFNODE("Infinity", null, {
    $documentation: "The `Infinity` value",
    value: 1/0
}, AST_Atom);

var AST_Boolean = DEFNODE("Boolean", null, {
    $documentation: "Base class for booleans",
}, AST_Atom);

var AST_False = DEFNODE("False", null, {
    $documentation: "The `false` atom",
    value: false
}, AST_Boolean);

var AST_True = DEFNODE("True", null, {
    $documentation: "The `true` atom",
    value: true
}, AST_Boolean);

/* -----[ TreeWalker ]----- */

function TreeWalker(callback) {
    this.callback = callback;
    this.directives = Object.create(null);
    this.stack = [];
}
TreeWalker.prototype = {
    visit: function(node, descend) {
        this.push(node);
        var done = this.callback(node, descend || noop);
        if (!done && descend) descend();
        this.pop();
    },
    parent: function(n) {
        return this.stack[this.stack.length - 2 - (n || 0)];
    },
    push: function(node) {
        if (node instanceof AST_Lambda) {
            this.directives = Object.create(this.directives);
        } else if (node instanceof AST_Directive && !this.directives[node.value]) {
            this.directives[node.value] = node;
        }
        this.stack.push(node);
    },
    pop: function() {
        if (this.stack.pop() instanceof AST_Lambda) {
            this.directives = Object.getPrototypeOf(this.directives);
        }
    },
    self: function() {
        return this.stack[this.stack.length - 1];
    },
    find_parent: function(type) {
        var stack = this.stack;
        for (var i = stack.length; --i >= 0;) {
            var x = stack[i];
            if (x instanceof type) return x;
        }
    },
    has_directive: function(type) {
        var dir = this.directives[type];
        if (dir) return dir;
        var node = this.stack[this.stack.length - 1];
        if (node instanceof AST_Scope) {
            for (var i = 0; i < node.body.length; ++i) {
                var st = node.body[i];
                if (!(st instanceof AST_Directive)) break;
                if (st.value == type) return st;
            }
        }
    },
    loopcontrol_target: function(node) {
        var stack = this.stack;
        if (node.label) for (var i = stack.length; --i >= 0;) {
            var x = stack[i];
            if (x instanceof AST_LabeledStatement && x.label.name == node.label.name)
                return x.body;
        } else for (var i = stack.length; --i >= 0;) {
            var x = stack[i];
            if (x instanceof AST_IterationStatement
                || node instanceof AST_Break && x instanceof AST_Switch)
                return x;
        }
    },
    in_boolean_context: function() {
        var self = this.self();
        for (var i = 0, p; p = this.parent(i); i++) {
            if (p instanceof AST_Conditional && p.condition === self
                || p instanceof AST_DWLoop && p.condition === self
                || p instanceof AST_For && p.condition === self
                || p instanceof AST_If && p.condition === self
                || p instanceof AST_Return && p.in_bool
                || p instanceof AST_Sequence && p.tail_node() !== self
                || p instanceof AST_SimpleStatement
                || p instanceof AST_UnaryPrefix && p.operator == "!" && p.expression === self) {
                return true;
            }
            if (p instanceof AST_Binary && (p.operator == "&&" || p.operator == "||")
                || p instanceof AST_Conditional
                || p.tail_node() === self) {
                self = p;
            } else if (p instanceof AST_Return) {
                for (var call, fn = p; call = this.parent(++i); fn = call) {
                    if (call.TYPE == "Call") {
                        if (!(fn instanceof AST_Lambda) || fn.name) return false;
                    } else if (fn instanceof AST_Lambda) {
                        return false;
                    }
                }
            } else {
                return false;
            }
        }
    }
};
/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>
    Parser based on parse-js (http://marijn.haverbeke.nl/parse-js/).

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

var KEYWORDS = "break case catch const continue debugger default delete do else finally for function if in instanceof let new return switch throw try typeof var void while with";
var KEYWORDS_ATOM = "false null true";
var RESERVED_WORDS = [
    "await abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized this throws transient volatile yield",
    KEYWORDS_ATOM,
    KEYWORDS,
].join(" ");
var KEYWORDS_BEFORE_EXPRESSION = "return new delete throw else case";

KEYWORDS = makePredicate(KEYWORDS);
RESERVED_WORDS = makePredicate(RESERVED_WORDS);
KEYWORDS_BEFORE_EXPRESSION = makePredicate(KEYWORDS_BEFORE_EXPRESSION);
KEYWORDS_ATOM = makePredicate(KEYWORDS_ATOM);

var RE_BIN_NUMBER = /^0b([01]+)$/i;
var RE_HEX_NUMBER = /^0x([0-9a-f]+)$/i;
var RE_OCT_NUMBER = /^0o?([0-7]+)$/i;

var OPERATORS = makePredicate([
    "in",
    "instanceof",
    "typeof",
    "new",
    "void",
    "delete",
    "++",
    "--",
    "+",
    "-",
    "!",
    "~",
    "&",
    "|",
    "^",
    "*",
    "/",
    "%",
    ">>",
    "<<",
    ">>>",
    "<",
    ">",
    "<=",
    ">=",
    "==",
    "===",
    "!=",
    "!==",
    "?",
    "=",
    "+=",
    "-=",
    "/=",
    "*=",
    "%=",
    ">>=",
    "<<=",
    ">>>=",
    "|=",
    "^=",
    "&=",
    "&&",
    "||"
]);

var NEWLINE_CHARS = "\n\r\u2028\u2029";
var OPERATOR_CHARS = "+-*&%=<>!?|~^";
var PUNC_BEFORE_EXPRESSION = "[{(,;:";
var PUNC_CHARS = PUNC_BEFORE_EXPRESSION + ")}]";
var WHITESPACE_CHARS = NEWLINE_CHARS + " \u00a0\t\f\u000b\u200b\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\uFEFF";
var NON_IDENTIFIER_CHARS = makePredicate(characters("./'\"" + OPERATOR_CHARS + PUNC_CHARS + WHITESPACE_CHARS));

NEWLINE_CHARS = makePredicate(characters(NEWLINE_CHARS));
OPERATOR_CHARS = makePredicate(characters(OPERATOR_CHARS));
PUNC_BEFORE_EXPRESSION = makePredicate(characters(PUNC_BEFORE_EXPRESSION));
PUNC_CHARS = makePredicate(characters(PUNC_CHARS));
WHITESPACE_CHARS = makePredicate(characters(WHITESPACE_CHARS));

/* -----[ Tokenizer ]----- */

function is_surrogate_pair_head(code) {
    return code >= 0xd800 && code <= 0xdbff;
}

function is_surrogate_pair_tail(code) {
    return code >= 0xdc00 && code <= 0xdfff;
}

function is_digit(code) {
    return code >= 48 && code <= 57;
}

function is_identifier_char(ch) {
    return !NON_IDENTIFIER_CHARS[ch];
}

function is_identifier_string(str) {
    return /^[a-z_$][a-z0-9_$]*$/i.test(str);
}

function parse_js_number(num) {
    var match;
    if (match = RE_BIN_NUMBER.exec(num)) return parseInt(match[1], 2);
    if (match = RE_HEX_NUMBER.exec(num)) return parseInt(match[1], 16);
    if (match = RE_OCT_NUMBER.exec(num)) return parseInt(match[1], 8);
    var val = parseFloat(num);
    if (val == num) return val;
}

function JS_Parse_Error(message, filename, line, col, pos) {
    this.message = message;
    this.filename = filename;
    this.line = line;
    this.col = col;
    this.pos = pos;
}
JS_Parse_Error.prototype = Object.create(Error.prototype);
JS_Parse_Error.prototype.constructor = JS_Parse_Error;
JS_Parse_Error.prototype.name = "SyntaxError";
configure_error_stack(JS_Parse_Error);

function js_error(message, filename, line, col, pos) {
    throw new JS_Parse_Error(message, filename, line, col, pos);
}

function is_token(token, type, val) {
    return token.type == type && (val == null || token.value == val);
}

var EX_EOF = {};

function tokenizer($TEXT, filename, html5_comments, shebang) {

    var S = {
        text            : $TEXT,
        filename        : filename,
        pos             : 0,
        tokpos          : 0,
        line            : 1,
        tokline         : 0,
        col             : 0,
        tokcol          : 0,
        newline_before  : false,
        regex_allowed   : false,
        comments_before : [],
        directives      : {},
        directive_stack : []
    };
    var prev_was_dot = false;

    function peek() {
        return S.text.charAt(S.pos);
    }

    function next(signal_eof, in_string) {
        var ch = S.text.charAt(S.pos++);
        if (signal_eof && !ch)
            throw EX_EOF;
        if (NEWLINE_CHARS[ch]) {
            S.col = 0;
            S.line++;
            if (!in_string) S.newline_before = true;
            if (ch == "\r" && peek() == "\n") {
                // treat `\r\n` as `\n`
                S.pos++;
                ch = "\n";
            }
        } else {
            S.col++;
        }
        return ch;
    }

    function forward(i) {
        while (i-- > 0) next();
    }

    function looking_at(str) {
        return S.text.substr(S.pos, str.length) == str;
    }

    function find_eol() {
        var text = S.text;
        for (var i = S.pos; i < S.text.length; ++i) {
            if (NEWLINE_CHARS[text[i]]) return i;
        }
        return -1;
    }

    function find(what, signal_eof) {
        var pos = S.text.indexOf(what, S.pos);
        if (signal_eof && pos == -1) throw EX_EOF;
        return pos;
    }

    function start_token() {
        S.tokline = S.line;
        S.tokcol = S.col;
        S.tokpos = S.pos;
    }

    function token(type, value, is_comment) {
        S.regex_allowed = type == "operator" && !UNARY_POSTFIX[value]
            || type == "keyword" && KEYWORDS_BEFORE_EXPRESSION[value]
            || type == "punc" && PUNC_BEFORE_EXPRESSION[value];
        if (type == "punc" && value == ".") prev_was_dot = true;
        else if (!is_comment) prev_was_dot = false;
        var ret = {
            type    : type,
            value   : value,
            line    : S.tokline,
            col     : S.tokcol,
            pos     : S.tokpos,
            endline : S.line,
            endcol  : S.col,
            endpos  : S.pos,
            nlb     : S.newline_before,
            file    : filename
        };
        if (/^(?:num|string|regexp)$/i.test(type)) {
            ret.raw = $TEXT.substring(ret.pos, ret.endpos);
        }
        if (!is_comment) {
            ret.comments_before = S.comments_before;
            ret.comments_after = S.comments_before = [];
        }
        S.newline_before = false;
        return new AST_Token(ret);
    }

    function skip_whitespace() {
        while (WHITESPACE_CHARS[peek()])
            next();
    }

    function read_while(pred) {
        var ret = "", ch, i = 0;
        while ((ch = peek()) && pred(ch, i++))
            ret += next();
        return ret;
    }

    function parse_error(err) {
        js_error(err, filename, S.tokline, S.tokcol, S.tokpos);
    }

    function read_num(prefix) {
        var has_e = false, after_e = false, has_x = false, has_dot = prefix == ".";
        var num = read_while(function(ch, i) {
            var code = ch.charCodeAt(0);
            switch (code) {
              case 120: case 88: // xX
                return has_x ? false : (has_x = true);
              case 101: case 69: // eE
                return has_x ? true : has_e ? false : (has_e = after_e = true);
              case 45: // -
                return after_e || (i == 0 && !prefix);
              case 43: // +
                return after_e;
              case (after_e = false, 46): // .
                return (!has_dot && !has_x && !has_e) ? (has_dot = true) : false;
            }
            return is_digit(code) || /[_0-9a-fo]/i.test(ch);
        });
        if (prefix) num = prefix + num;
        if (/^0[0-7_]+$/.test(num)) {
            if (next_token.has_directive("use strict")) parse_error("Legacy octal literals are not allowed in strict mode");
        } else {
            num = num.replace(has_x ? /([1-9a-f]|.0)_(?=[0-9a-f])/gi : /([1-9]|.0)_(?=[0-9])/gi, "$1");
        }
        var valid = parse_js_number(num);
        if (!isNaN(valid)) return token("num", valid);
        parse_error("Invalid syntax: " + num);
    }

    function read_escaped_char(in_string) {
        var ch = next(true, in_string);
        switch (ch.charCodeAt(0)) {
          case 110: return "\n";
          case 114: return "\r";
          case 116: return "\t";
          case 98:  return "\b";
          case 118: return "\u000b";                            // \v
          case 102: return "\f";
          case 120: return String.fromCharCode(hex_bytes(2));   // \x
          case 117:                                             // \u
            if (peek() != "{") return String.fromCharCode(hex_bytes(4));
            next();
            var num = 0;
            do {
                var digit = parseInt(next(true), 16);
                if (isNaN(digit)) parse_error("Invalid hex-character pattern in string");
                num = num * 16 + digit;
            } while (peek() != "}");
            next();
            if (num < 0x10000) return String.fromCharCode(num);
            if (num > 0x10ffff) parse_error("Invalid character code: " + num);
            return String.fromCharCode((num >> 10) + 0xd7c0) + String.fromCharCode((num & 0x03ff) + 0xdc00);
          case 13:                                              // \r
            // DOS newline
            if (peek() == "\n") next(true, in_string);
          case 10:  return "";                                  // \n
        }
        if (ch >= "0" && ch <= "7")
            return read_octal_escape_sequence(ch);
        return ch;
    }

    function read_octal_escape_sequence(ch) {
        // Read
        var p = peek();
        if (p >= "0" && p <= "7") {
            ch += next(true);
            if (ch[0] <= "3" && (p = peek()) >= "0" && p <= "7")
                ch += next(true);
        }

        // Parse
        if (ch === "0") return "\0";
        if (ch.length > 0 && next_token.has_directive("use strict"))
            parse_error("Legacy octal escape sequences are not allowed in strict mode");
        return String.fromCharCode(parseInt(ch, 8));
    }

    function hex_bytes(n) {
        var num = 0;
        for (; n > 0; --n) {
            var digit = parseInt(next(true), 16);
            if (isNaN(digit))
                parse_error("Invalid hex-character pattern in string");
            num = (num << 4) | digit;
        }
        return num;
    }

    var read_string = with_eof_error("Unterminated string constant", function(quote_char) {
        var quote = next(), ret = "";
        for (;;) {
            var ch = next(true, true);
            if (ch == "\\") ch = read_escaped_char(true);
            else if (NEWLINE_CHARS[ch]) parse_error("Unterminated string constant");
            else if (ch == quote) break;
            ret += ch;
        }
        var tok = token("string", ret);
        tok.quote = quote_char;
        return tok;
    });

    function skip_line_comment(type) {
        var regex_allowed = S.regex_allowed;
        var i = find_eol(), ret;
        if (i == -1) {
            ret = S.text.substr(S.pos);
            S.pos = S.text.length;
        } else {
            ret = S.text.substring(S.pos, i);
            S.pos = i;
        }
        S.col = S.tokcol + (S.pos - S.tokpos);
        S.comments_before.push(token(type, ret, true));
        S.regex_allowed = regex_allowed;
        return next_token;
    }

    var skip_multiline_comment = with_eof_error("Unterminated multiline comment", function() {
        var regex_allowed = S.regex_allowed;
        var i = find("*/", true);
        var text = S.text.substring(S.pos, i).replace(/\r\n|\r|\u2028|\u2029/g, "\n");
        // update stream position
        forward(text.length /* doesn't count \r\n as 2 char while S.pos - i does */ + 2);
        S.comments_before.push(token("comment2", text, true));
        S.regex_allowed = regex_allowed;
        return next_token;
    });

    function read_name() {
        var backslash = false, name = "", ch, escaped = false, hex;
        while (ch = peek()) {
            if (!backslash) {
                if (ch == "\\") escaped = backslash = true, next();
                else if (is_identifier_char(ch)) name += next();
                else break;
            } else {
                if (ch != "u") parse_error("Expecting UnicodeEscapeSequence -- uXXXX");
                ch = read_escaped_char();
                if (!is_identifier_char(ch)) parse_error("Unicode char: " + ch.charCodeAt(0) + " is not valid in identifier");
                name += ch;
                backslash = false;
            }
        }
        if (KEYWORDS[name] && escaped) {
            hex = name.charCodeAt(0).toString(16).toUpperCase();
            name = "\\u" + "0000".substr(hex.length) + hex + name.slice(1);
        }
        return name;
    }

    var read_regexp = with_eof_error("Unterminated regular expression", function(source) {
        var prev_backslash = false, ch, in_class = false;
        while ((ch = next(true))) if (NEWLINE_CHARS[ch]) {
            parse_error("Unexpected line terminator");
        } else if (prev_backslash) {
            source += "\\" + ch;
            prev_backslash = false;
        } else if (ch == "[") {
            in_class = true;
            source += ch;
        } else if (ch == "]" && in_class) {
            in_class = false;
            source += ch;
        } else if (ch == "/" && !in_class) {
            break;
        } else if (ch == "\\") {
            prev_backslash = true;
        } else {
            source += ch;
        }
        var mods = read_name();
        try {
            var regexp = new RegExp(source, mods);
            regexp.raw_source = source;
            return token("regexp", regexp);
        } catch (e) {
            parse_error(e.message);
        }
    });

    function read_operator(prefix) {
        function grow(op) {
            if (!peek()) return op;
            var bigger = op + peek();
            if (OPERATORS[bigger]) {
                next();
                return grow(bigger);
            } else {
                return op;
            }
        }
        return token("operator", grow(prefix || next()));
    }

    function handle_slash() {
        next();
        switch (peek()) {
          case "/":
            next();
            return skip_line_comment("comment1");
          case "*":
            next();
            return skip_multiline_comment();
        }
        return S.regex_allowed ? read_regexp("") : read_operator("/");
    }

    function handle_dot() {
        next();
        var ch = peek();
        if (ch == ".") {
            var op = ".";
            do {
                op += ".";
                next();
            } while (peek() == ".");
            return token("operator", op);
        }
        return is_digit(ch.charCodeAt(0)) ? read_num(".") : token("punc", ".");
    }

    function read_word() {
        var word = read_name();
        if (prev_was_dot) return token("name", word);
        return KEYWORDS_ATOM[word] ? token("atom", word)
            : !KEYWORDS[word] ? token("name", word)
            : OPERATORS[word] ? token("operator", word)
            : token("keyword", word);
    }

    function with_eof_error(eof_error, cont) {
        return function(x) {
            try {
                return cont(x);
            } catch (ex) {
                if (ex === EX_EOF) parse_error(eof_error);
                else throw ex;
            }
        };
    }

    function next_token(force_regexp) {
        if (force_regexp != null)
            return read_regexp(force_regexp);
        if (shebang && S.pos == 0 && looking_at("#!")) {
            start_token();
            forward(2);
            skip_line_comment("comment5");
        }
        for (;;) {
            skip_whitespace();
            start_token();
            if (html5_comments) {
                if (looking_at("<!--")) {
                    forward(4);
                    skip_line_comment("comment3");
                    continue;
                }
                if (looking_at("-->") && S.newline_before) {
                    forward(3);
                    skip_line_comment("comment4");
                    continue;
                }
            }
            var ch = peek();
            if (!ch) return token("eof");
            var code = ch.charCodeAt(0);
            switch (code) {
              case 34: case 39: return read_string(ch);
              case 46: return handle_dot();
              case 47:
                var tok = handle_slash();
                if (tok === next_token) continue;
                return tok;
            }
            if (is_digit(code)) return read_num();
            if (PUNC_CHARS[ch]) return token("punc", next());
            if (looking_at("=>")) return token("punc", next() + next());
            if (OPERATOR_CHARS[ch]) return read_operator();
            if (code == 92 || !NON_IDENTIFIER_CHARS[ch]) return read_word();
            break;
        }
        parse_error("Unexpected character '" + ch + "'");
    }

    next_token.context = function(nc) {
        if (nc) S = nc;
        return S;
    };

    next_token.add_directive = function(directive) {
        S.directive_stack[S.directive_stack.length - 1].push(directive);
        if (S.directives[directive]) S.directives[directive]++;
        else S.directives[directive] = 1;
    }

    next_token.push_directives_stack = function() {
        S.directive_stack.push([]);
    }

    next_token.pop_directives_stack = function() {
        var directives = S.directive_stack.pop();
        for (var i = directives.length; --i >= 0;) {
            S.directives[directives[i]]--;
        }
    }

    next_token.has_directive = function(directive) {
        return S.directives[directive] > 0;
    }

    return next_token;
}

/* -----[ Parser (constants) ]----- */

var UNARY_PREFIX = makePredicate("typeof void delete -- ++ ! ~ - +");

var UNARY_POSTFIX = makePredicate("-- ++");

var ASSIGNMENT = makePredicate("= += -= /= *= %= >>= <<= >>>= |= ^= &=");

var PRECEDENCE = function(a, ret) {
    for (var i = 0; i < a.length;) {
        var b = a[i++];
        for (var j = 0; j < b.length; j++) {
            ret[b[j]] = i;
        }
    }
    return ret;
}([
    ["||"],
    ["&&"],
    ["|"],
    ["^"],
    ["&"],
    ["==", "===", "!=", "!=="],
    ["<", ">", "<=", ">=", "in", "instanceof"],
    [">>", "<<", ">>>"],
    ["+", "-"],
    ["*", "/", "%"]
], {});

var ATOMIC_START_TOKEN = makePredicate("atom num regexp string");

/* -----[ Parser ]----- */

function parse($TEXT, options) {
    options = defaults(options, {
        bare_returns   : false,
        expression     : false,
        filename       : null,
        html5_comments : true,
        shebang        : true,
        strict         : false,
        toplevel       : null,
    }, true);

    var S = {
        input         : typeof $TEXT == "string"
                        ? tokenizer($TEXT, options.filename, options.html5_comments, options.shebang)
                        : $TEXT,
        in_async      : false,
        in_directives : true,
        in_funarg     : -1,
        in_function   : 0,
        in_loop       : 0,
        labels        : [],
        peeked        : null,
        prev          : null,
        token         : null,
    };

    S.token = next();

    function is(type, value) {
        return is_token(S.token, type, value);
    }

    function peek() {
        return S.peeked || (S.peeked = S.input());
    }

    function next() {
        S.prev = S.token;
        if (S.peeked) {
            S.token = S.peeked;
            S.peeked = null;
        } else {
            S.token = S.input();
        }
        S.in_directives = S.in_directives && (
            S.token.type == "string" || is("punc", ";")
        );
        return S.token;
    }

    function prev() {
        return S.prev;
    }

    function croak(msg, line, col, pos) {
        var ctx = S.input.context();
        js_error(msg,
                 ctx.filename,
                 line != null ? line : ctx.tokline,
                 col != null ? col : ctx.tokcol,
                 pos != null ? pos : ctx.tokpos);
    }

    function token_error(token, msg) {
        croak(msg, token.line, token.col);
    }

    function token_to_string(type, value) {
        return type + (value === undefined ? "" : " «" + value + "»");
    }

    function unexpected(token) {
        if (token == null) token = S.token;
        token_error(token, "Unexpected token: " + token_to_string(token.type, token.value));
    }

    function expect_token(type, val) {
        if (is(type, val)) return next();
        token_error(S.token, "Unexpected token: " + token_to_string(S.token.type, S.token.value) + ", expected: " + token_to_string(type, val));
    }

    function expect(punc) {
        return expect_token("punc", punc);
    }

    function has_newline_before(token) {
        return token.nlb || !all(token.comments_before, function(comment) {
            return !comment.nlb;
        });
    }

    function can_insert_semicolon() {
        return !options.strict
            && (is("eof") || is("punc", "}") || has_newline_before(S.token));
    }

    function semicolon(optional) {
        if (is("punc", ";")) next();
        else if (!optional && !can_insert_semicolon()) expect(";");
    }

    function parenthesised() {
        expect("(");
        var exp = expression();
        expect(")");
        return exp;
    }

    function embed_tokens(parser) {
        return function() {
            var start = S.token;
            var expr = parser.apply(null, arguments);
            var end = prev();
            expr.start = start;
            expr.end = end;
            return expr;
        };
    }

    function handle_regexp() {
        if (is("operator", "/") || is("operator", "/=")) {
            S.peeked = null;
            S.token = S.input(S.token.value.substr(1)); // force regexp
        }
    }

    var statement = embed_tokens(function() {
        handle_regexp();
        switch (S.token.type) {
          case "string":
            var dir = S.in_directives;
            var body = expression();
            if (dir) {
                if (body instanceof AST_String) {
                    var value = body.start.raw.slice(1, -1);
                    S.input.add_directive(value);
                    body.value = value;
                } else {
                    S.in_directives = dir = false;
                }
            }
            semicolon();
            return dir ? new AST_Directive(body) : new AST_SimpleStatement({ body: body });
          case "num":
          case "regexp":
          case "operator":
          case "atom":
            return simple_statement();

          case "name":
            switch (S.token.value) {
              case "async":
                if (is_token(peek(), "keyword", "function")) {
                    next();
                    next();
                    return function_(AST_AsyncDefun);
                }
              case "await":
                if (S.in_async) return simple_statement();
              default:
                return is_token(peek(), "punc", ":")
                    ? labeled_statement()
                    : simple_statement();
            }

          case "punc":
            switch (S.token.value) {
              case "{":
                return new AST_BlockStatement({
                    start : S.token,
                    body  : block_(),
                    end   : prev()
                });
              case "[":
              case "(":
                return simple_statement();
              case ";":
                S.in_directives = false;
                next();
                return new AST_EmptyStatement();
              default:
                unexpected();
            }

          case "keyword":
            switch (S.token.value) {
              case "break":
                next();
                return break_cont(AST_Break);

              case "const":
                next();
                var node = const_();
                semicolon();
                return node;

              case "continue":
                next();
                return break_cont(AST_Continue);

              case "debugger":
                next();
                semicolon();
                return new AST_Debugger();

              case "do":
                next();
                var body = in_loop(statement);
                expect_token("keyword", "while");
                var condition = parenthesised();
                semicolon(true);
                return new AST_Do({
                    body      : body,
                    condition : condition
                });

              case "while":
                next();
                return new AST_While({
                    condition : parenthesised(),
                    body      : in_loop(statement)
                });

              case "for":
                next();
                return for_();

              case "function":
                next();
                return function_(AST_Defun);

              case "if":
                next();
                return if_();

              case "let":
                next();
                var node = let_();
                semicolon();
                return node;

              case "return":
                if (S.in_function == 0 && !options.bare_returns)
                    croak("'return' outside of function");
                next();
                var value = null;
                if (is("punc", ";")) {
                    next();
                } else if (!can_insert_semicolon()) {
                    value = expression();
                    semicolon();
                }
                return new AST_Return({
                    value: value
                });

              case "switch":
                next();
                return new AST_Switch({
                    expression : parenthesised(),
                    body       : in_loop(switch_body_)
                });

              case "throw":
                next();
                if (has_newline_before(S.token))
                    croak("Illegal newline after 'throw'");
                var value = expression();
                semicolon();
                return new AST_Throw({
                    value: value
                });

              case "try":
                next();
                return try_();

              case "var":
                next();
                var node = var_();
                semicolon();
                return node;

              case "with":
                if (S.input.has_directive("use strict")) {
                    croak("Strict mode may not include a with statement");
                }
                next();
                return new AST_With({
                    expression : parenthesised(),
                    body       : statement()
                });
            }
        }
        unexpected();
    });

    function labeled_statement() {
        var label = as_symbol(AST_Label);
        if (!all(S.labels, function(l) {
            return l.name != label.name;
        })) {
            // ECMA-262, 12.12: An ECMAScript program is considered
            // syntactically incorrect if it contains a
            // LabelledStatement that is enclosed by a
            // LabelledStatement with the same Identifier as label.
            croak("Label " + label.name + " defined twice");
        }
        expect(":");
        S.labels.push(label);
        var stat = statement();
        S.labels.pop();
        if (!(stat instanceof AST_IterationStatement)) {
            // check for `continue` that refers to this label.
            // those should be reported as syntax errors.
            // https://github.com/mishoo/UglifyJS/issues/287
            label.references.forEach(function(ref) {
                if (ref instanceof AST_Continue) {
                    token_error(ref.label.start, "Continue label `" + label.name + "` must refer to IterationStatement");
                }
            });
        }
        return new AST_LabeledStatement({ body: stat, label: label });
    }

    function simple_statement() {
        var body = expression();
        semicolon();
        return new AST_SimpleStatement({ body: body });
    }

    function break_cont(type) {
        var label = null, ldef;
        if (!can_insert_semicolon()) {
            label = as_symbol(AST_LabelRef, true);
        }
        if (label != null) {
            ldef = find_if(function(l) {
                return l.name == label.name;
            }, S.labels);
            if (!ldef) token_error(label.start, "Undefined label " + label.name);
            label.thedef = ldef;
        } else if (S.in_loop == 0) croak(type.TYPE + " not inside a loop or switch");
        semicolon();
        var stat = new type({ label: label });
        if (ldef) ldef.references.push(stat);
        return stat;
    }

    function for_() {
        expect("(");
        var init = null;
        if (!is("punc", ";")) {
            init = is("keyword", "const")
                ? (next(), const_(true))
                : is("keyword", "let")
                ? (next(), let_(true))
                : is("keyword", "var")
                ? (next(), var_(true))
                : expression(true);
            if (is("operator", "in")) {
                if (init instanceof AST_Definitions) {
                    if (init.definitions.length > 1) {
                        token_error(init.start, "Only one variable declaration allowed in for..in loop");
                    }
                } else if (!(is_assignable(init) || (init = to_destructured(init)) instanceof AST_Destructured)) {
                    token_error(init.start, "Invalid left-hand side in for..in loop");
                }
                next();
                return for_in(init);
            }
        }
        return regular_for(init);
    }

    function regular_for(init) {
        expect(";");
        var test = is("punc", ";") ? null : expression();
        expect(";");
        var step = is("punc", ")") ? null : expression();
        expect(")");
        return new AST_For({
            init      : init,
            condition : test,
            step      : step,
            body      : in_loop(statement)
        });
    }

    function for_in(init) {
        var obj = expression();
        expect(")");
        return new AST_ForIn({
            init   : init,
            object : obj,
            body   : in_loop(statement)
        });
    }

    function to_funarg(node) {
        if (node instanceof AST_Array) return new AST_DestructuredArray({
            start: node.start,
            elements: node.elements.map(to_funarg),
            end: node.end,
        });
        if (node instanceof AST_Assign) return new AST_DefaultValue({
            start: node.start,
            name: to_funarg(node.left),
            value: node.right,
            end: node.end,
        });
        if (node instanceof AST_DefaultValue) {
            node.name = to_funarg(node.name);
            return node;
        }
        if (node instanceof AST_DestructuredArray) {
            node.elements = node.elements.map(to_funarg);
            return node;
        }
        if (node instanceof AST_DestructuredObject) {
            node.properties.forEach(function(prop) {
                prop.value = to_funarg(prop.value);
            });
            return node;
        }
        if (node instanceof AST_Hole) return node;
        if (node instanceof AST_Object) return new AST_DestructuredObject({
            start: node.start,
            properties: node.properties.map(function(prop) {
                if (!(prop instanceof AST_ObjectKeyVal)) token_error(prop.start, "Invalid destructuring assignment");
                return new AST_DestructuredKeyVal({
                    start: prop.start,
                    key: prop.key,
                    value: to_funarg(prop.value),
                    end: prop.end,
                });
            }),
            end: node.end,
        });
        if (node instanceof AST_SymbolRef) return new AST_SymbolFunarg(node);
        token_error(node.start, "Invalid arrow parameter");
    }

    function arrow(exprs, start) {
        var was_async = S.in_async;
        S.in_async = false;
        var was_funarg = S.in_funarg;
        S.in_funarg = S.in_function;
        var argnames = exprs.map(to_funarg);
        S.in_funarg = was_funarg;
        expect("=>");
        var body, value;
        var loop = S.in_loop;
        var labels = S.labels;
        ++S.in_function;
        S.in_directives = true;
        S.input.push_directives_stack();
        S.in_loop = 0;
        S.labels = [];
        if (is("punc", "{")) {
            body = block_();
            value = null;
            if (S.input.has_directive("use strict")) {
                argnames.forEach(strict_verify_symbol);
            }
        } else {
            body = [];
            value = maybe_assign();
        }
        S.input.pop_directives_stack();
        --S.in_function;
        S.in_loop = loop;
        S.labels = labels;
        S.in_async = was_async;
        return new AST_Arrow({
            start: start,
            argnames: argnames,
            body: body,
            value: value,
            end: prev(),
        });
    }

    var function_ = function(ctor) {
        var was_async = S.in_async;
        var name;
        if (ctor === AST_AsyncDefun) {
            name = as_symbol(AST_SymbolDefun);
            S.in_async = true;
        } else if (ctor === AST_Defun) {
            name = as_symbol(AST_SymbolDefun);
            S.in_async = false;
        } else {
            S.in_async = ctor === AST_AsyncFunction;
            name = as_symbol(AST_SymbolLambda, true);
        }
        if (name && ctor !== AST_Accessor && !(name instanceof AST_SymbolDeclaration))
            unexpected(prev());
        expect("(");
        var was_funarg = S.in_funarg;
        S.in_funarg = S.in_function;
        var argnames = expr_list(")", !options.strict, false, function() {
            return maybe_default(AST_SymbolFunarg);
        });
        S.in_funarg = was_funarg;
        var loop = S.in_loop;
        var labels = S.labels;
        ++S.in_function;
        S.in_directives = true;
        S.input.push_directives_stack();
        S.in_loop = 0;
        S.labels = [];
        var body = block_();
        if (S.input.has_directive("use strict")) {
            if (name) strict_verify_symbol(name);
            argnames.forEach(strict_verify_symbol);
        }
        S.input.pop_directives_stack();
        --S.in_function;
        S.in_loop = loop;
        S.labels = labels;
        S.in_async = was_async;
        return new ctor({
            name: name,
            argnames: argnames,
            body: body
        });
    };

    function if_() {
        var cond = parenthesised(), body = statement(), belse = null;
        if (is("keyword", "else")) {
            next();
            belse = statement();
        }
        return new AST_If({
            condition   : cond,
            body        : body,
            alternative : belse
        });
    }

    function block_() {
        expect("{");
        var a = [];
        while (!is("punc", "}")) {
            if (is("eof")) expect("}");
            a.push(statement());
        }
        next();
        return a;
    }

    function switch_body_() {
        expect("{");
        var a = [], branch, cur, default_branch, tmp;
        while (!is("punc", "}")) {
            if (is("eof")) expect("}");
            if (is("keyword", "case")) {
                if (branch) branch.end = prev();
                cur = [];
                branch = new AST_Case({
                    start      : (tmp = S.token, next(), tmp),
                    expression : expression(),
                    body       : cur
                });
                a.push(branch);
                expect(":");
            } else if (is("keyword", "default")) {
                if (branch) branch.end = prev();
                if (default_branch) croak("More than one default clause in switch statement");
                cur = [];
                branch = new AST_Default({
                    start : (tmp = S.token, next(), expect(":"), tmp),
                    body  : cur
                });
                a.push(branch);
                default_branch = branch;
            } else {
                if (!cur) unexpected();
                cur.push(statement());
            }
        }
        if (branch) branch.end = prev();
        next();
        return a;
    }

    function try_() {
        var body = block_(), bcatch = null, bfinally = null;
        if (is("keyword", "catch")) {
            var start = S.token;
            next();
            var name = null;
            if (is("punc", "(")) {
                next();
                name = maybe_destructured(AST_SymbolCatch);
                expect(")");
            }
            bcatch = new AST_Catch({
                start   : start,
                argname : name,
                body    : block_(),
                end     : prev()
            });
        }
        if (is("keyword", "finally")) {
            var start = S.token;
            next();
            bfinally = new AST_Finally({
                start : start,
                body  : block_(),
                end   : prev()
            });
        }
        if (!bcatch && !bfinally)
            croak("Missing catch/finally blocks");
        return new AST_Try({
            body     : body,
            bcatch   : bcatch,
            bfinally : bfinally
        });
    }

    function vardefs(type, no_in) {
        var a = [];
        for (;;) {
            var start = S.token;
            var name = maybe_destructured(type);
            var value = null;
            if (is("operator", "=")) {
                next();
                value = maybe_assign(no_in);
            } else if (!no_in && (type === AST_SymbolConst || name instanceof AST_Destructured)) {
                croak("Missing initializer in declaration");
            }
            a.push(new AST_VarDef({
                start : start,
                name  : name,
                value : value,
                end   : prev()
            }));
            if (!is("punc", ","))
                break;
            next();
        }
        return a;
    }

    var const_ = function(no_in) {
        return new AST_Const({
            start       : prev(),
            definitions : vardefs(AST_SymbolConst, no_in),
            end         : prev()
        });
    };

    var let_ = function(no_in) {
        return new AST_Let({
            start       : prev(),
            definitions : vardefs(AST_SymbolLet, no_in),
            end         : prev()
        });
    };

    var var_ = function(no_in) {
        return new AST_Var({
            start       : prev(),
            definitions : vardefs(AST_SymbolVar, no_in),
            end         : prev()
        });
    };

    var new_ = function(allow_calls) {
        var start = S.token;
        expect_token("operator", "new");
        var newexp = expr_atom(false), args;
        if (is("punc", "(")) {
            next();
            args = expr_list(")", !options.strict);
        } else {
            args = [];
        }
        var call = new AST_New({
            start      : start,
            expression : newexp,
            args       : args,
            end        : prev()
        });
        mark_pure(call);
        return subscripts(call, allow_calls);
    };

    function as_atom_node() {
        var tok = S.token, ret;
        switch (tok.type) {
          case "num":
            ret = new AST_Number({ start: tok, end: tok, value: tok.value });
            break;
          case "string":
            ret = new AST_String({
                start : tok,
                end   : tok,
                value : tok.value,
                quote : tok.quote
            });
            break;
          case "regexp":
            ret = new AST_RegExp({ start: tok, end: tok, value: tok.value });
            break;
          case "atom":
            switch (tok.value) {
              case "false":
                ret = new AST_False({ start: tok, end: tok });
                break;
              case "true":
                ret = new AST_True({ start: tok, end: tok });
                break;
              case "null":
                ret = new AST_Null({ start: tok, end: tok });
                break;
            }
            break;
        }
        next();
        return ret;
    }

    var expr_atom = function(allow_calls) {
        if (is("operator", "new")) {
            return new_(allow_calls);
        }
        var start = S.token;
        if (is("punc")) {
            switch (start.value) {
              case "(":
                next();
                if (is("punc", ")")) {
                    next();
                    return arrow([], start);
                }
                var ex = expression(false, true);
                var len = start.comments_before.length;
                [].unshift.apply(ex.start.comments_before, start.comments_before);
                start.comments_before.length = 0;
                start.comments_before = ex.start.comments_before;
                start.comments_before_length = len;
                if (len == 0 && start.comments_before.length > 0) {
                    var comment = start.comments_before[0];
                    if (!comment.nlb) {
                        comment.nlb = start.nlb;
                        start.nlb = false;
                    }
                }
                start.comments_after = ex.start.comments_after;
                ex.start = start;
                expect(")");
                var end = prev();
                end.comments_before = ex.end.comments_before;
                [].push.apply(ex.end.comments_after, end.comments_after);
                end.comments_after.length = 0;
                end.comments_after = ex.end.comments_after;
                ex.end = end;
                if (ex instanceof AST_Call) mark_pure(ex);
                if (is("punc", "=>")) return arrow(ex instanceof AST_Sequence ? ex.expressions : [ ex ], start);
                return subscripts(ex, allow_calls);
              case "[":
                return subscripts(array_(), allow_calls);
              case "{":
                return subscripts(object_(), allow_calls);
            }
            unexpected();
        }
        var ctor;
        if (is("name", "async") && is_token(peek(), "keyword", "function")) {
            next();
            ctor = AST_AsyncFunction;
        } else if (is("keyword", "function")) {
            ctor = AST_Function;
        }
        if (ctor) {
            next();
            var func = function_(ctor);
            func.start = start;
            func.end = prev();
            return subscripts(func, allow_calls);
        }
        if (is("name")) {
            var sym = _make_symbol(AST_SymbolRef, start);
            next();
            return is("punc", "=>") ? arrow([ sym ], start) : subscripts(sym, allow_calls);
        }
        if (ATOMIC_START_TOKEN[S.token.type]) {
            return subscripts(as_atom_node(), allow_calls);
        }
        unexpected();
    };

    function expr_list(closing, allow_trailing_comma, allow_empty, parser) {
        if (!parser) parser = maybe_assign;
        var first = true, a = [];
        while (!is("punc", closing)) {
            if (first) first = false; else expect(",");
            if (allow_trailing_comma && is("punc", closing)) break;
            if (allow_empty && is("punc", ",")) {
                a.push(new AST_Hole({ start: S.token, end: S.token }));
            } else if (parser === maybe_assign && is("operator", "...")) {
                a.push(new AST_Spread({
                    start: S.token,
                    expression: (next(), parser()),
                    end: prev(),
                }));
            } else {
                a.push(parser());
            }
        }
        next();
        return a;
    }

    var array_ = embed_tokens(function() {
        expect("[");
        return new AST_Array({
            elements: expr_list("]", !options.strict, true)
        });
    });

    var create_accessor = embed_tokens(function() {
        return function_(AST_Accessor);
    });

    var object_ = embed_tokens(function() {
        expect("{");
        var first = true, a = [];
        while (!is("punc", "}")) {
            if (first) first = false; else expect(",");
            // allow trailing comma
            if (!options.strict && is("punc", "}")) break;
            var start = S.token;
            if (is("operator", "...")) {
                next();
                a.push(new AST_Spread({
                    start: start,
                    expression: maybe_assign(),
                    end: prev(),
                }));
                continue;
            }
            if (is_token(peek(), "operator", "=")) {
                var name = as_symbol(AST_SymbolRef);
                next();
                a.push(new AST_ObjectKeyVal({
                    start: start,
                    key: start.value,
                    value: new AST_Assign({
                        start: start,
                        left: name,
                        operator: "=",
                        right: maybe_assign(),
                        end: prev(),
                    }),
                    end: prev(),
                }));
                continue;
            }
            if (is_token(peek(), "punc", ",") || is_token(peek(), "punc", "}")) {
                a.push(new AST_ObjectKeyVal({
                    start: start,
                    key: start.value,
                    value: as_symbol(AST_SymbolRef),
                    end: prev(),
                }));
                continue;
            }
            var key = as_property_key();
            if (is("punc", "(")) {
                var func_start = S.token;
                var func = function_(AST_Function);
                func.start = func_start;
                func.end = prev();
                a.push(new AST_ObjectKeyVal({
                    start: start,
                    key: key,
                    value: func,
                    end: prev(),
                }));
                continue;
            }
            if (is("punc", ":")) {
                next();
                a.push(new AST_ObjectKeyVal({
                    start: start,
                    key: key,
                    value: maybe_assign(),
                    end: prev(),
                }));
                continue;
            }
            if (start.type == "name") switch (key) {
              case "async":
                key = as_property_key();
                var func_start = S.token;
                var func = function_(AST_AsyncFunction);
                func.start = func_start;
                func.end = prev();
                a.push(new AST_ObjectKeyVal({
                    start: start,
                    key: key,
                    value: func,
                    end: prev(),
                }));
                continue;
              case "get":
                a.push(new AST_ObjectGetter({
                    start: start,
                    key: as_property_key(),
                    value: create_accessor(),
                    end: prev(),
                }));
                continue;
              case "set":
                a.push(new AST_ObjectSetter({
                    start: start,
                    key: as_property_key(),
                    value: create_accessor(),
                    end: prev(),
                }));
                continue;
            }
            unexpected();
        }
        next();
        return new AST_Object({ properties: a });
    });

    function as_property_key() {
        var tmp = S.token;
        switch (tmp.type) {
          case "operator":
            if (!KEYWORDS[tmp.value]) unexpected();
          case "num":
          case "string":
          case "name":
          case "keyword":
          case "atom":
            next();
            return "" + tmp.value;
          case "punc":
            expect("[");
            var key = maybe_assign();
            expect("]");
            return key;
          default:
            unexpected();
        }
    }

    function as_name() {
        var name = S.token.value;
        expect_token("name");
        return name;
    }

    function _make_symbol(type, token) {
        var name = token.value;
        if (name === "await" && S.in_async) unexpected(token);
        return new (name === "this" ? AST_This : type)({
            name: "" + name,
            start: token,
            end: token,
        });
    }

    function strict_verify_symbol(sym) {
        if (sym.name == "arguments" || sym.name == "eval")
            token_error(sym.start, "Unexpected " + sym.name + " in strict mode");
    }

    function as_symbol(type, noerror) {
        if (!is("name")) {
            if (!noerror) croak("Name expected");
            return null;
        }
        var sym = _make_symbol(type, S.token);
        if (S.input.has_directive("use strict") && sym instanceof AST_SymbolDeclaration) {
            strict_verify_symbol(sym);
        }
        next();
        return sym;
    }

    function maybe_destructured(type) {
        var start = S.token;
        if (is("punc", "[")) {
            next();
            return new AST_DestructuredArray({
                start: start,
                elements: expr_list("]", !options.strict, true, function() {
                    return maybe_default(type);
                }),
                end: prev(),
            });
        }
        if (is("punc", "{")) {
            next();
            var first = true, a = [];
            while (!is("punc", "}")) {
                if (first) first = false; else expect(",");
                // allow trailing comma
                if (!options.strict && is("punc", "}")) break;
                var key_start = S.token;
                if (is("punc", "[") || is_token(peek(), "punc", ":")) {
                    var key = as_property_key();
                    expect(":");
                    a.push(new AST_DestructuredKeyVal({
                        start: key_start,
                        key: key,
                        value: maybe_default(type),
                        end: prev(),
                    }));
                    continue;
                }
                var name = as_symbol(type);
                if (is("operator", "=")) {
                    next();
                    name = new AST_DefaultValue({
                        start: name.start,
                        name: name,
                        value: maybe_assign(),
                        end: prev(),
                    });
                }
                a.push(new AST_DestructuredKeyVal({
                    start: key_start,
                    key: key_start.value,
                    value: name,
                    end: prev(),
                }));
            }
            next();
            return new AST_DestructuredObject({
                start: start,
                properties: a,
                end: prev(),
            });
        }
        return as_symbol(type);
    }

    function maybe_default(type) {
        var start = S.token;
        var name = maybe_destructured(type);
        if (!is("operator", "=")) return name;
        next();
        return new AST_DefaultValue({
            start: start,
            name: name,
            value: maybe_assign(),
            end: prev(),
        });
    }

    function mark_pure(call) {
        var start = call.start;
        var comments = start.comments_before;
        var i = HOP(start, "comments_before_length") ? start.comments_before_length : comments.length;
        while (--i >= 0) {
            var comment = comments[i];
            if (/[@#]__PURE__/.test(comment.value)) {
                call.pure = comment;
                break;
            }
        }
    }

    var subscripts = function(expr, allow_calls) {
        var start = expr.start;
        if (is("punc", ".")) {
            next();
            return subscripts(new AST_Dot({
                start      : start,
                expression : expr,
                property   : as_name(),
                end        : prev()
            }), allow_calls);
        }
        if (is("punc", "[")) {
            next();
            var prop = expression();
            expect("]");
            return subscripts(new AST_Sub({
                start      : start,
                expression : expr,
                property   : prop,
                end        : prev()
            }), allow_calls);
        }
        if (allow_calls && is("punc", "(")) {
            next();
            var call = new AST_Call({
                start      : start,
                expression : expr,
                args       : expr_list(")", !options.strict),
                end        : prev()
            });
            mark_pure(call);
            return subscripts(call, true);
        }
        return expr;
    };

    function maybe_unary() {
        var start = S.token;
        if (is("operator") && UNARY_PREFIX[start.value]) {
            next();
            handle_regexp();
            var ex = make_unary(AST_UnaryPrefix, start, maybe_await());
            ex.start = start;
            ex.end = prev();
            return ex;
        }
        var val = expr_atom(true);
        while (is("operator") && UNARY_POSTFIX[S.token.value] && !has_newline_before(S.token)) {
            val = make_unary(AST_UnaryPostfix, S.token, val);
            val.start = start;
            val.end = S.token;
            next();
        }
        return val;
    }

    function make_unary(ctor, token, expr) {
        var op = token.value;
        switch (op) {
          case "++":
          case "--":
            if (!is_assignable(expr))
                token_error(token, "Invalid use of " + op + " operator");
            break;
          case "delete":
            if (expr instanceof AST_SymbolRef && S.input.has_directive("use strict"))
                token_error(expr.start, "Calling delete on expression not allowed in strict mode");
            break;
        }
        return new ctor({ operator: op, expression: expr });
    }

    function maybe_await() {
        var start = S.token;
        if (!(S.in_async && is("name", "await"))) return maybe_unary();
        if (S.in_funarg === S.in_function) croak("Invalid use of await in function argument");
        S.input.context().regex_allowed = true;
        next();
        return new AST_Await({
            start: start,
            expression: maybe_await(),
            end: prev(),
        });
    }

    var expr_op = function(left, min_prec, no_in) {
        var op = is("operator") ? S.token.value : null;
        if (op == "in" && no_in) op = null;
        var prec = op != null ? PRECEDENCE[op] : null;
        if (prec != null && prec > min_prec) {
            next();
            var right = expr_op(maybe_await(), prec, no_in);
            return expr_op(new AST_Binary({
                start    : left.start,
                left     : left,
                operator : op,
                right    : right,
                end      : right.end
            }), min_prec, no_in);
        }
        return left;
    };

    function expr_ops(no_in) {
        return expr_op(maybe_await(), 0, no_in);
    }

    var maybe_conditional = function(no_in) {
        var start = S.token;
        var expr = expr_ops(no_in);
        if (is("operator", "?")) {
            next();
            var yes = maybe_assign();
            expect(":");
            return new AST_Conditional({
                start       : start,
                condition   : expr,
                consequent  : yes,
                alternative : maybe_assign(no_in),
                end         : prev()
            });
        }
        return expr;
    };

    function is_assignable(expr) {
        return expr instanceof AST_PropAccess || expr instanceof AST_SymbolRef;
    }

    function to_destructured(node) {
        if (node instanceof AST_Array) {
            var elements = node.elements.map(to_destructured);
            return all(elements, function(node) {
                return node instanceof AST_DefaultValue
                    || node instanceof AST_Destructured
                    || node instanceof AST_Hole
                    || is_assignable(node);
            }) ? new AST_DestructuredArray({
                start: node.start,
                elements: elements,
                end: node.end,
            }) : node;
        }
        if (node instanceof AST_Assign) {
            var name = to_destructured(node.left);
            return name instanceof AST_Destructured || is_assignable(name) ? new AST_DefaultValue({
                start: node.start,
                name: name,
                value: node.right,
                end: node.end,
            }) : node;
        }
        if (!(node instanceof AST_Object)) return node;
        var props = [];
        for (var i = 0; i < node.properties.length; i++) {
            var prop = node.properties[i];
            if (!(prop instanceof AST_ObjectKeyVal)) return node;
            var value = to_destructured(prop.value);
            if (!(value instanceof AST_DefaultValue || value instanceof AST_Destructured || is_assignable(value))) {
                return node;
            }
            props.push(new AST_DestructuredKeyVal({
                start: prop.start,
                key: prop.key,
                value: value,
                end: prop.end,
            }));
        }
        return new AST_DestructuredObject({
            start: node.start,
            properties: props,
            end: node.end,
        });
    }

    function maybe_assign(no_in) {
        var start = S.token;
        var left = maybe_conditional(no_in), val = S.token.value;
        if (is("operator") && ASSIGNMENT[val]) {
            if (is_assignable(left) || val == "=" && (left = to_destructured(left)) instanceof AST_Destructured) {
                next();
                return new AST_Assign({
                    start    : start,
                    left     : left,
                    operator : val,
                    right    : maybe_assign(no_in),
                    end      : prev()
                });
            }
            croak("Invalid assignment");
        }
        return left;
    }

    function expression(no_in, maybe_arrow) {
        var start = S.token;
        var exprs = [];
        while (true) {
            exprs.push(maybe_assign(no_in));
            if (!is("punc", ",")) break;
            next();
            if (maybe_arrow && is("punc", ")") && is_token(peek(), "punc", "=>")) break;
        }
        return exprs.length == 1 ? exprs[0] : new AST_Sequence({
            start       : start,
            expressions : exprs,
            end         : prev()
        });
    }

    function in_loop(cont) {
        ++S.in_loop;
        var ret = cont();
        --S.in_loop;
        return ret;
    }

    if (options.expression) {
        handle_regexp();
        var exp = expression();
        expect_token("eof");
        return exp;
    }

    return function() {
        var start = S.token;
        var body = [];
        S.input.push_directives_stack();
        while (!is("eof"))
            body.push(statement());
        S.input.pop_directives_stack();
        var end = prev();
        var toplevel = options.toplevel;
        if (toplevel) {
            toplevel.body = toplevel.body.concat(body);
            toplevel.end = end;
        } else {
            toplevel = new AST_Toplevel({ start: start, body: body, end: end });
        }
        return toplevel;
    }();
}
/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

function TreeTransformer(before, after) {
    TreeWalker.call(this);
    this.before = before;
    this.after = after;
}
TreeTransformer.prototype = new TreeWalker;

(function(DEF) {
    function do_list(list, tw) {
        return List(list, function(node) {
            return node.transform(tw, true);
        });
    }

    DEF(AST_Node, noop);
    DEF(AST_LabeledStatement, function(self, tw) {
        self.label = self.label.transform(tw);
        self.body = self.body.transform(tw);
    });
    DEF(AST_SimpleStatement, function(self, tw) {
        self.body = self.body.transform(tw);
    });
    DEF(AST_Block, function(self, tw) {
        self.body = do_list(self.body, tw);
    });
    DEF(AST_Do, function(self, tw) {
        self.body = self.body.transform(tw);
        self.condition = self.condition.transform(tw);
    });
    DEF(AST_While, function(self, tw) {
        self.condition = self.condition.transform(tw);
        self.body = self.body.transform(tw);
    });
    DEF(AST_For, function(self, tw) {
        if (self.init) self.init = self.init.transform(tw);
        if (self.condition) self.condition = self.condition.transform(tw);
        if (self.step) self.step = self.step.transform(tw);
        self.body = self.body.transform(tw);
    });
    DEF(AST_ForIn, function(self, tw) {
        self.init = self.init.transform(tw);
        self.object = self.object.transform(tw);
        self.body = self.body.transform(tw);
    });
    DEF(AST_With, function(self, tw) {
        self.expression = self.expression.transform(tw);
        self.body = self.body.transform(tw);
    });
    DEF(AST_Exit, function(self, tw) {
        if (self.value) self.value = self.value.transform(tw);
    });
    DEF(AST_LoopControl, function(self, tw) {
        if (self.label) self.label = self.label.transform(tw);
    });
    DEF(AST_If, function(self, tw) {
        self.condition = self.condition.transform(tw);
        self.body = self.body.transform(tw);
        if (self.alternative) self.alternative = self.alternative.transform(tw);
    });
    DEF(AST_Switch, function(self, tw) {
        self.expression = self.expression.transform(tw);
        self.body = do_list(self.body, tw);
    });
    DEF(AST_Case, function(self, tw) {
        self.expression = self.expression.transform(tw);
        self.body = do_list(self.body, tw);
    });
    DEF(AST_Try, function(self, tw) {
        self.body = do_list(self.body, tw);
        if (self.bcatch) self.bcatch = self.bcatch.transform(tw);
        if (self.bfinally) self.bfinally = self.bfinally.transform(tw);
    });
    DEF(AST_Catch, function(self, tw) {
        if (self.argname) self.argname = self.argname.transform(tw);
        self.body = do_list(self.body, tw);
    });
    DEF(AST_Definitions, function(self, tw) {
        self.definitions = do_list(self.definitions, tw);
    });
    DEF(AST_VarDef, function(self, tw) {
        self.name = self.name.transform(tw);
        if (self.value) self.value = self.value.transform(tw);
    });
    DEF(AST_DefaultValue, function(self, tw) {
        self.name = self.name.transform(tw);
        self.value = self.value.transform(tw);
    });
    DEF(AST_Lambda, function(self, tw) {
        if (self.name) self.name = self.name.transform(tw);
        self.argnames = do_list(self.argnames, tw);
        self.body = do_list(self.body, tw);
    });
    DEF(AST_Arrow, function(self, tw) {
        self.argnames = do_list(self.argnames, tw);
        if (self.value) {
            self.value = self.value.transform(tw);
        } else {
            self.body = do_list(self.body, tw);
        }
    });
    DEF(AST_Call, function(self, tw) {
        self.expression = self.expression.transform(tw);
        self.args = do_list(self.args, tw);
    });
    DEF(AST_Sequence, function(self, tw) {
        self.expressions = do_list(self.expressions, tw);
    });
    DEF(AST_Await, function(self, tw) {
        self.expression = self.expression.transform(tw);
    });
    DEF(AST_Dot, function(self, tw) {
        self.expression = self.expression.transform(tw);
    });
    DEF(AST_Sub, function(self, tw) {
        self.expression = self.expression.transform(tw);
        self.property = self.property.transform(tw);
    });
    DEF(AST_Spread, function(self, tw) {
        self.expression = self.expression.transform(tw);
    });
    DEF(AST_Unary, function(self, tw) {
        self.expression = self.expression.transform(tw);
    });
    DEF(AST_Binary, function(self, tw) {
        self.left = self.left.transform(tw);
        self.right = self.right.transform(tw);
    });
    DEF(AST_Conditional, function(self, tw) {
        self.condition = self.condition.transform(tw);
        self.consequent = self.consequent.transform(tw);
        self.alternative = self.alternative.transform(tw);
    });
    DEF(AST_Array, function(self, tw) {
        self.elements = do_list(self.elements, tw);
    });
    DEF(AST_DestructuredArray, function(self, tw) {
        self.elements = do_list(self.elements, tw);
    });
    DEF(AST_DestructuredKeyVal, function(self, tw) {
        if (self.key instanceof AST_Node) self.key = self.key.transform(tw);
        self.value = self.value.transform(tw);
    });
    DEF(AST_DestructuredObject, function(self, tw) {
        self.properties = do_list(self.properties, tw);
    });
    DEF(AST_Object, function(self, tw) {
        self.properties = do_list(self.properties, tw);
    });
    DEF(AST_ObjectProperty, function(self, tw) {
        if (self.key instanceof AST_Node) self.key = self.key.transform(tw);
        self.value = self.value.transform(tw);
    });
})(function(node, descend) {
    node.DEFMETHOD("transform", function(tw, in_list) {
        var x, y;
        tw.push(this);
        if (tw.before) x = tw.before(this, descend, in_list);
        if (typeof x === "undefined") {
            x = this;
            descend(x, tw);
            if (tw.after) {
                y = tw.after(x, in_list);
                if (typeof y !== "undefined") x = y;
            }
        }
        tw.pop();
        return x;
    });
});
/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

function SymbolDef(id, scope, orig, init) {
    this.eliminated = 0;
    this.global = false;
    this.id = id;
    this.init = init;
    this.lambda = orig instanceof AST_SymbolLambda;
    this.mangled_name = null;
    this.name = orig.name;
    this.orig = [ orig ];
    this.references = [];
    this.replaced = 0;
    this.scope = scope;
    this.undeclared = false;
}

SymbolDef.prototype = {
    forEach: function(fn) {
        this.orig.forEach(fn);
        this.references.forEach(fn);
    },
    mangle: function(options) {
        var cache = options.cache && options.cache.props;
        if (this.global && cache && cache.has(this.name)) {
            this.mangled_name = cache.get(this.name);
        } else if (!this.mangled_name && !this.unmangleable(options)) {
            var def = this.redefined();
            if (def) {
                this.mangled_name = def.mangled_name || def.name;
            } else {
                this.mangled_name = next_mangled_name(this, options);
            }
            if (this.global && cache) {
                cache.set(this.name, this.mangled_name);
            }
        }
    },
    redefined: function() {
        var scope = this.defun;
        if (!scope) return;
        var name = this.name;
        var def = scope.variables.get(name)
            || scope instanceof AST_Toplevel && scope.globals.get(name)
            || this.orig[0] instanceof AST_SymbolConst && find_if(function(def) {
                return def.name == name;
            }, scope.enclosed);
        if (def && def !== this) return def.redefined() || def;
    },
    unmangleable: function(options) {
        return this.global && !options.toplevel
            || this.undeclared
            || !options.eval && this.scope.pinned()
            || options.keep_fnames
                && (this.orig[0] instanceof AST_SymbolLambda
                    || this.orig[0] instanceof AST_SymbolDefun);
    },
};

var unary_side_effects = makePredicate("delete ++ --");

AST_Toplevel.DEFMETHOD("figure_out_scope", function(options) {
    options = defaults(options, {
        cache: null,
        ie8: false,
    });

    // pass 1: setup scope chaining and handle definitions
    var self = this;
    var defun = null;
    var next_def_id = 0;
    var scope = self.parent_scope = null;
    var tw = new TreeWalker(function(node, descend) {
        if (is_defun(node)) {
            node.name.walk(tw);
            walk_scope(function() {
                node.argnames.forEach(function(argname) {
                    argname.walk(tw);
                });
                walk_body(node, tw);
            });
            return true;
        }
        if (node instanceof AST_SwitchBranch) {
            node.init_vars(scope);
            descend();
            return true;
        }
        if (node instanceof AST_Try) {
            walk_scope(function() {
                walk_body(node, tw);
            });
            if (node.bcatch) node.bcatch.walk(tw);
            if (node.bfinally) node.bfinally.walk(tw);
            return true;
        }
        if (node instanceof AST_With) {
            var s = scope;
            do {
                s = s.resolve();
                if (s.uses_with) break;
                s.uses_with = true;
            } while (s = s.parent_scope);
            walk_scope(descend);
            return true;
        }
        if (node instanceof AST_BlockScope) {
            walk_scope(descend);
            return true;
        }
        if (node instanceof AST_Symbol) {
            node.scope = scope;
        }
        if (node instanceof AST_Label) {
            node.thedef = node;
            node.references = [];
        }
        if (node instanceof AST_SymbolCatch) {
            scope.def_variable(node).defun = defun;
        } else if (node instanceof AST_SymbolConst) {
            scope.def_variable(node).defun = defun;
        } else if (node instanceof AST_SymbolDefun) {
            defun.def_function(node, tw.parent());
            entangle(defun, scope);
        } else if (node instanceof AST_SymbolFunarg) {
            defun.def_variable(node);
            entangle(defun, scope);
        } else if (node instanceof AST_SymbolLambda) {
            var def = defun.def_function(node, node.name == "arguments" ? undefined : defun);
            if (options.ie8) def.defun = defun.parent_scope.resolve();
        } else if (node instanceof AST_SymbolLet) {
            scope.def_variable(node);
        } else if (node instanceof AST_SymbolVar) {
            defun.def_variable(node, null);
            entangle(defun, scope);
        }

        function walk_scope(descend) {
            node.init_vars(scope);
            var save_defun = defun;
            var save_scope = scope;
            if (node instanceof AST_Scope) defun = node;
            scope = node;
            descend();
            scope = save_scope;
            defun = save_defun;
        }

        function entangle(defun, scope) {
            if (defun === scope) return;
            node.mark_enclosed(options);
            var def = scope.find_variable(node.name);
            if (node.thedef === def) return;
            node.thedef = def;
            def.orig.push(node);
            node.mark_enclosed(options);
        }
    });
    self.make_def = function(orig, init) {
        return new SymbolDef(++next_def_id, this, orig, init);
    };
    self.walk(tw);

    // pass 2: find back references and eval
    self.globals = new Dictionary();
    var in_arg = [];
    var tw = new TreeWalker(function(node) {
        if (node instanceof AST_Catch) {
            if (!(node.argname instanceof AST_Destructured)) return;
            in_arg.push(node);
            node.argname.walk(tw);
            in_arg.pop();
            walk_body(node, tw);
            return true;
        }
        if (node instanceof AST_Lambda) {
            in_arg.push(node);
            node.argnames.forEach(function(argname) {
                argname.walk(tw);
            });
            in_arg.pop();
            if (node instanceof AST_Arrow && node.value) {
                node.value.walk(tw);
            } else {
                walk_body(node, tw);
            }
            return true;
        }
        if (node instanceof AST_LoopControl) {
            if (node.label) node.label.thedef.references.push(node);
            return true;
        }
        // ensure mangling works if `catch` reuses a scope variable
        if (node instanceof AST_SymbolCatch) {
            var def = node.definition().redefined();
            if (def) for (var s = node.scope; s; s = s.parent_scope) {
                push_uniq(s.enclosed, def);
                if (s === def.scope) break;
            }
            return true;
        }
        // ensure compression works if `const` reuses a scope variable
        if (node instanceof AST_SymbolConst) {
            var redef = node.definition().redefined();
            if (redef) redef.const_redefs = true;
            return true;
        }
        if (node instanceof AST_SymbolRef) {
            var name = node.name;
            var sym = node.scope.find_variable(name);
            for (var i = in_arg.length; i > 0 && sym;) {
                i = in_arg.lastIndexOf(sym.scope, i - 1);
                if (i < 0) break;
                var decl = sym.orig[0];
                if (decl instanceof AST_SymbolCatch
                    || decl instanceof AST_SymbolFunarg
                    || decl instanceof AST_SymbolLambda) {
                    node.in_arg = true;
                    break;
                }
                sym = sym.scope.parent_scope.find_variable(name);
            }
            if (!sym) {
                sym = self.def_global(node);
            } else if (name == "arguments" && is_arguments(sym)) {
                var parent = tw.parent();
                if (parent instanceof AST_Assign && parent.left === node
                    || parent instanceof AST_Unary && unary_side_effects[parent.operator]) {
                    sym.scope.uses_arguments = 3;
                } else if (sym.scope.uses_arguments < 2
                    && !(parent instanceof AST_PropAccess && parent.expression === node)) {
                    sym.scope.uses_arguments = 2;
                } else if (!sym.scope.uses_arguments) {
                    sym.scope.uses_arguments = true;
                }
            }
            if (name == "eval") {
                var parent = tw.parent();
                if (parent.TYPE == "Call" && parent.expression === node) {
                    var s = node.scope;
                    do {
                        s = s.resolve();
                        if (s.uses_eval) break;
                        s.uses_eval = true;
                    } while (s = s.parent_scope);
                } else if (sym.undeclared) {
                    self.uses_eval = true;
                }
            }
            node.thedef = sym;
            node.reference(options);
            return true;
        }
        if (node instanceof AST_VarDef) {
            if (node.value && node.name.name == "arguments") {
                var sym = node.name.scope.resolve().find_variable("arguments");
                if (sym && is_arguments(sym)) sym.scope.uses_arguments = 3;
            }
            return;
        }
    });
    self.walk(tw);

    // pass 3: fix up any scoping issue with IE8
    if (options.ie8) self.walk(new TreeWalker(function(node) {
        if (node instanceof AST_SymbolCatch) {
            var scope = node.thedef.defun;
            if (scope.name instanceof AST_SymbolLambda && scope.name.name == node.name) {
                scope = scope.parent_scope.resolve();
            }
            redefine(node, scope);
            return true;
        }
        if (node instanceof AST_SymbolLambda) {
            var def = node.thedef;
            redefine(node, node.scope.parent_scope.resolve());
            if (typeof node.thedef.init !== "undefined") {
                node.thedef.init = false;
            } else if (def.init) {
                node.thedef.init = def.init;
            }
            return true;
        }
    }));

    function is_arguments(sym) {
        return sym.orig[0] instanceof AST_SymbolFunarg
            && !(sym.orig[1] instanceof AST_SymbolFunarg || sym.orig[2] instanceof AST_SymbolFunarg)
            && !(sym.scope instanceof AST_Arrow);
    }

    function redefine(node, scope) {
        var name = node.name;
        var old_def = node.thedef;
        if (!all(old_def.orig, function(sym) {
            return !(sym instanceof AST_SymbolConst || sym instanceof AST_SymbolLet);
        })) return;
        var new_def = scope.find_variable(name);
        if (new_def) {
            var redef = new_def.redefined();
            if (redef) new_def = redef;
        } else {
            new_def = self.globals.get(name);
        }
        if (new_def) {
            new_def.orig.push(node);
        } else {
            new_def = scope.def_variable(node);
        }
        old_def.defun = new_def.scope;
        old_def.forEach(function(node) {
            node.redef = true;
            node.thedef = new_def;
            node.reference(options);
        });
        if (old_def.lambda) new_def.lambda = true;
        if (new_def.undeclared) self.variables.set(name, new_def);
    }
});

AST_Toplevel.DEFMETHOD("def_global", function(node) {
    var globals = this.globals, name = node.name;
    if (globals.has(name)) {
        return globals.get(name);
    } else {
        var g = this.make_def(node);
        g.undeclared = true;
        g.global = true;
        globals.set(name, g);
        return g;
    }
});

function init_block_vars(scope, parent) {
    scope.enclosed = [];                            // variables from this or outer scope(s) that are referenced from this or inner scopes
    scope.parent_scope = parent;                    // the parent scope (null if this is the top level)
    scope.functions = new Dictionary();             // map name to AST_SymbolDefun (functions defined in this scope)
    scope.variables = new Dictionary();             // map name to AST_SymbolVar (variables defined in this scope; includes functions)
    if (parent) scope.make_def = parent.make_def;   // top-level tracking of SymbolDef instances
}

function init_scope_vars(scope, parent) {
    init_block_vars(scope, parent);
    scope.uses_eval = false;                        // will be set to true if this or nested scope uses the global `eval`
    scope.uses_with = false;                        // will be set to true if this or some nested scope uses the `with` statement
}

AST_BlockScope.DEFMETHOD("init_vars", function(parent_scope) {
    init_block_vars(this, parent_scope);
});
AST_Scope.DEFMETHOD("init_vars", function(parent_scope) {
    init_scope_vars(this, parent_scope);
});
AST_Arrow.DEFMETHOD("init_vars", function(parent_scope) {
    init_scope_vars(this, parent_scope);
});
AST_Lambda.DEFMETHOD("init_vars", function(parent_scope) {
    init_scope_vars(this, parent_scope);
    this.uses_arguments = false;
    this.def_variable(new AST_SymbolFunarg({
        name: "arguments",
        start: this.start,
        end: this.end,
    }));
    return this;
});

AST_Symbol.DEFMETHOD("mark_enclosed", function(options) {
    var def = this.definition();
    for (var s = this.scope; s; s = s.parent_scope) {
        push_uniq(s.enclosed, def);
        if (options.keep_fnames) {
            s.functions.each(function(d) {
                push_uniq(def.scope.enclosed, d);
            });
        }
        if (s === def.scope) break;
    }
});

AST_Symbol.DEFMETHOD("reference", function(options) {
    this.definition().references.push(this);
    this.mark_enclosed(options);
});

AST_BlockScope.DEFMETHOD("find_variable", function(name) {
    return this.variables.get(name)
        || this.parent_scope && this.parent_scope.find_variable(name);
});

AST_BlockScope.DEFMETHOD("def_function", function(symbol, init) {
    var def = this.def_variable(symbol, init);
    if (!def.init || is_defun(def.init)) def.init = init;
    this.functions.set(symbol.name, def);
    return def;
});

AST_BlockScope.DEFMETHOD("def_variable", function(symbol, init) {
    var def = this.variables.get(symbol.name);
    if (def) {
        def.orig.push(symbol);
        if (is_function(def.init)) def.init = init;
    } else {
        def = this.make_def(symbol, init);
        this.variables.set(symbol.name, def);
        def.global = !this.parent_scope;
    }
    return symbol.thedef = def;
});

function names_in_use(scope, options) {
    var names = scope.names_in_use;
    if (!names) {
        scope.cname = -1;
        scope.cname_holes = [];
        scope.names_in_use = names = Object.create(null);
        var cache = options.cache && options.cache.props;
        scope.enclosed.forEach(function(def) {
            if (def.unmangleable(options)) names[def.name] = true;
            if (def.global && cache && cache.has(def.name)) {
                names[cache.get(def.name)] = true;
            }
        });
    }
    return names;
}

function next_mangled_name(def, options) {
    var scope = def.scope;
    var in_use = names_in_use(scope, options);
    var holes = scope.cname_holes;
    var names = Object.create(null);
    var scopes = [ scope ];
    def.forEach(function(sym) {
        var scope = sym.scope;
        do {
            if (scopes.indexOf(scope) < 0) {
                for (var name in names_in_use(scope, options)) {
                    names[name] = true;
                }
                scopes.push(scope);
            } else break;
        } while (scope = scope.parent_scope);
    });
    var name;
    for (var i = 0; i < holes.length; i++) {
        name = base54(holes[i]);
        if (names[name]) continue;
        holes.splice(i, 1);
        in_use[name] = true;
        return name;
    }
    while (true) {
        name = base54(++scope.cname);
        if (in_use[name] || RESERVED_WORDS[name] || options.reserved.has[name]) continue;
        if (!names[name]) break;
        holes.push(scope.cname);
    }
    in_use[name] = true;
    return name;
}

AST_Symbol.DEFMETHOD("unmangleable", function(options) {
    var def = this.definition();
    return !def || def.unmangleable(options);
});

// labels are always mangleable
AST_Label.DEFMETHOD("unmangleable", return_false);

AST_Symbol.DEFMETHOD("definition", function() {
    return this.thedef;
});

function _default_mangler_options(options) {
    options = defaults(options, {
        eval        : false,
        ie8         : false,
        keep_fnames : false,
        reserved    : [],
        toplevel    : false,
        v8          : false,
        webkit      : false,
    });
    if (!Array.isArray(options.reserved)) options.reserved = [];
    // Never mangle arguments
    push_uniq(options.reserved, "arguments");
    options.reserved.has = makePredicate(options.reserved);
    return options;
}

AST_Toplevel.DEFMETHOD("mangle_names", function(options) {
    options = _default_mangler_options(options);

    // We only need to mangle declaration nodes.  Special logic wired
    // into the code generator will display the mangled name if it's
    // present (and for AST_SymbolRef-s it'll use the mangled name of
    // the AST_SymbolDeclaration that it points to).
    var lname = -1;

    if (options.cache && options.cache.props) {
        var mangled_names = names_in_use(this, options);
        options.cache.props.each(function(mangled_name) {
            mangled_names[mangled_name] = true;
        });
    }

    var redefined = [];
    var tw = new TreeWalker(function(node, descend) {
        if (node instanceof AST_LabeledStatement) {
            // lname is incremented when we get to the AST_Label
            var save_nesting = lname;
            descend();
            if (!options.v8 || !in_label(tw)) lname = save_nesting;
            return true;
        }
        if (node instanceof AST_BlockScope) {
            if (options.webkit && node instanceof AST_IterationStatement && node.init instanceof AST_Let) {
                node.init.definitions.forEach(function(defn) {
                    defn.name.match_symbol(function(sym) {
                        if (!(sym instanceof AST_SymbolLet)) return;
                        var def = sym.definition();
                        var scope = sym.scope.parent_scope;
                        var redef = scope.def_variable(sym);
                        sym.thedef = def;
                        scope.to_mangle.push(redef);
                        def.redefined = function() {
                            return redef;
                        };
                    });
                }, true);
            }
            node.to_mangle = [];
            node.variables.each(function(def) {
                if (!defer_redef(def)) node.to_mangle.push(def);
            });
            descend();
            if (options.cache && node instanceof AST_Toplevel) {
                node.globals.each(mangle);
            }
            if (node instanceof AST_Defun && tw.has_directive("use asm")) {
                var sym = new AST_SymbolRef(node.name);
                sym.scope = node;
                sym.reference(options);
            }
            node.to_mangle.forEach(mangle);
            return true;
        }
        if (node instanceof AST_Label) {
            var name;
            do {
                name = base54(++lname);
            } while (RESERVED_WORDS[name]);
            node.mangled_name = name;
            return true;
        }
    });
    this.walk(tw);
    redefined.forEach(mangle);

    function mangle(def) {
        if (options.reserved.has[def.name]) return;
        def.mangle(options);
    }

    function defer_redef(def) {
        var sym = def.orig[0];
        var redef = def.redefined();
        if (!redef) {
            if (!(sym instanceof AST_SymbolConst)) return false;
            var scope = def.scope.resolve();
            if (def.scope === scope) return false;
            redef = scope.def_variable(sym);
            scope.to_mangle.push(redef);
        }
        redefined.push(def);
        def.references.forEach(reference);
        if (sym instanceof AST_SymbolCatch || sym instanceof AST_SymbolConst) reference(sym);
        return true;

        function reference(sym) {
            sym.thedef = redef;
            sym.reference(options);
            sym.thedef = def;
        }
    }

    function in_label(tw) {
        var level = 0, parent;
        while (parent = tw.parent(level++)) {
            if (parent instanceof AST_Block) return parent instanceof AST_Toplevel && !options.toplevel;
            if (parent instanceof AST_LabeledStatement) return true;
        }
    }
});

AST_Toplevel.DEFMETHOD("find_colliding_names", function(options) {
    var cache = options.cache && options.cache.props;
    var avoid = Object.create(RESERVED_WORDS);
    options.reserved.forEach(to_avoid);
    this.globals.each(add_def);
    this.walk(new TreeWalker(function(node) {
        if (node instanceof AST_BlockScope) node.variables.each(add_def);
    }));
    return avoid;

    function to_avoid(name) {
        avoid[name] = true;
    }

    function add_def(def) {
        var name = def.name;
        if (def.global && cache && cache.has(name)) name = cache.get(name);
        else if (!def.unmangleable(options)) return;
        to_avoid(name);
    }
});

AST_Toplevel.DEFMETHOD("expand_names", function(options) {
    base54.reset();
    base54.sort();
    options = _default_mangler_options(options);
    var avoid = this.find_colliding_names(options);
    var cname = 0;
    this.globals.each(rename);
    this.walk(new TreeWalker(function(node) {
        if (node instanceof AST_BlockScope) node.variables.each(rename);
    }));

    function next_name() {
        var name;
        do {
            name = base54(cname++);
        } while (avoid[name]);
        return name;
    }

    function rename(def) {
        if (def.global && options.cache) return;
        if (def.unmangleable(options)) return;
        if (options.reserved.has[def.name]) return;
        var redef = def.redefined();
        var name = redef ? redef.rename || redef.name : next_name();
        def.rename = name;
        def.forEach(function(sym) {
            if (sym.definition() === def) sym.name = name;
        });
    }
});

AST_Node.DEFMETHOD("tail_node", return_this);
AST_Sequence.DEFMETHOD("tail_node", function() {
    return this.expressions[this.expressions.length - 1];
});

AST_Toplevel.DEFMETHOD("compute_char_frequency", function(options) {
    options = _default_mangler_options(options);
    base54.reset();
    var fn = AST_Symbol.prototype.add_source_map;
    try {
        AST_Symbol.prototype.add_source_map = function() {
            if (!this.unmangleable(options)) base54.consider(this.name, -1);
        };
        if (options.properties) {
            AST_Dot.prototype.add_source_map = function() {
                base54.consider(this.property, -1);
            };
            AST_Sub.prototype.add_source_map = function() {
                skip_string(this.property);
            };
        }
        base54.consider(this.print_to_string(), 1);
    } finally {
        AST_Symbol.prototype.add_source_map = fn;
        delete AST_Dot.prototype.add_source_map;
        delete AST_Sub.prototype.add_source_map;
    }
    base54.sort();

    function skip_string(node) {
        if (node instanceof AST_String) {
            base54.consider(node.value, -1);
        } else if (node instanceof AST_Conditional) {
            skip_string(node.consequent);
            skip_string(node.alternative);
        } else if (node instanceof AST_Sequence) {
            skip_string(node.tail_node());
        }
    }
});

var base54 = (function() {
    var freq = Object.create(null);
    function init(chars) {
        var array = [];
        for (var i = 0; i < chars.length; i++) {
            var ch = chars[i];
            array.push(ch);
            freq[ch] = -1e-2 * i;
        }
        return array;
    }
    var digits = init("0123456789");
    var leading = init("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_");
    var chars, frequency;
    function reset() {
        frequency = Object.create(freq);
    }
    base54.consider = function(str, delta) {
        for (var i = str.length; --i >= 0;) {
            frequency[str[i]] += delta;
        }
    };
    function compare(a, b) {
        return frequency[b] - frequency[a];
    }
    base54.sort = function() {
        chars = leading.sort(compare).concat(digits.sort(compare));
    };
    base54.reset = reset;
    reset();
    function base54(num) {
        var ret = "", base = 54;
        num++;
        do {
            num--;
            ret += chars[num % base];
            num = Math.floor(num / base);
            base = 64;
        } while (num > 0);
        return ret;
    }
    return base54;
})();
/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

function is_some_comments(comment) {
    // multiline comment
    return comment.type == "comment2" && /@preserve|@license|@cc_on/i.test(comment.value);
}

function OutputStream(options) {

    var readonly = !options;
    options = defaults(options, {
        ascii_only       : false,
        beautify         : false,
        braces           : false,
        comments         : false,
        galio            : false,
        ie8              : false,
        indent_level     : 4,
        indent_start     : 0,
        inline_script    : true,
        keep_quoted_props: false,
        max_line_len     : false,
        preamble         : null,
        preserve_line    : false,
        quote_keys       : false,
        quote_style      : 0,
        semicolons       : true,
        shebang          : true,
        source_map       : null,
        v8               : false,
        webkit           : false,
        width            : 80,
        wrap_iife        : false,
    }, true);

    // Convert comment option to RegExp if neccessary and set up comments filter
    var comment_filter = return_false; // Default case, throw all comments away
    if (options.comments) {
        var comments = options.comments;
        if (typeof options.comments === "string" && /^\/.*\/[a-zA-Z]*$/.test(options.comments)) {
            var regex_pos = options.comments.lastIndexOf("/");
            comments = new RegExp(
                options.comments.substr(1, regex_pos - 1),
                options.comments.substr(regex_pos + 1)
            );
        }
        if (comments instanceof RegExp) {
            comment_filter = function(comment) {
                return comment.type != "comment5" && comments.test(comment.value);
            };
        } else if (typeof comments === "function") {
            comment_filter = function(comment) {
                return comment.type != "comment5" && comments(this, comment);
            };
        } else if (comments === "some") {
            comment_filter = is_some_comments;
        } else { // NOTE includes "all" option
            comment_filter = return_true;
        }
    }

    var indentation = options.indent_start;
    var current_col = 0;
    var current_line = 1;
    var current_pos = 0;
    var OUTPUT = "";

    var to_utf8 = options.ascii_only ? function(str, identifier) {
        if (identifier) str = str.replace(/[\ud800-\udbff][\udc00-\udfff]/g, function(ch) {
            return "\\u{" + (ch.charCodeAt(0) - 0xd7c0 << 10 | ch.charCodeAt(1) - 0xdc00).toString(16) + "}";
        });
        return str.replace(/[\u0000-\u001f\u007f-\uffff]/g, function(ch) {
            var code = ch.charCodeAt(0).toString(16);
            if (code.length <= 2 && !identifier) {
                while (code.length < 2) code = "0" + code;
                return "\\x" + code;
            } else {
                while (code.length < 4) code = "0" + code;
                return "\\u" + code;
            }
        });
    } : function(str) {
        var s = "";
        for (var i = 0, j = 0; i < str.length; i++) {
            var code = str.charCodeAt(i);
            if (is_surrogate_pair_head(code)) {
                if (is_surrogate_pair_tail(str.charCodeAt(i + 1))) {
                    i++;
                    continue;
                }
            } else if (!is_surrogate_pair_tail(code)) {
                continue;
            }
            s += str.slice(j, i) + "\\u" + code.toString(16);
            j = i + 1;
        }
        return j == 0 ? str : s + str.slice(j);
    };

    function make_string(str, quote) {
        var dq = 0, sq = 0;
        str = str.replace(/[\\\b\f\n\r\v\t\x22\x27\u2028\u2029\0\ufeff]/g, function(s, i) {
            switch (s) {
              case '"': ++dq; return '"';
              case "'": ++sq; return "'";
              case "\\": return "\\\\";
              case "\n": return "\\n";
              case "\r": return "\\r";
              case "\t": return "\\t";
              case "\b": return "\\b";
              case "\f": return "\\f";
              case "\x0B": return options.ie8 ? "\\x0B" : "\\v";
              case "\u2028": return "\\u2028";
              case "\u2029": return "\\u2029";
              case "\ufeff": return "\\ufeff";
              case "\0":
                  return /[0-9]/.test(str.charAt(i+1)) ? "\\x00" : "\\0";
            }
            return s;
        });
        function quote_single() {
            return "'" + str.replace(/\x27/g, "\\'") + "'";
        }
        function quote_double() {
            return '"' + str.replace(/\x22/g, '\\"') + '"';
        }
        str = to_utf8(str);
        switch (options.quote_style) {
          case 1:
            return quote_single();
          case 2:
            return quote_double();
          case 3:
            return quote == "'" ? quote_single() : quote_double();
          default:
            return dq > sq ? quote_single() : quote_double();
        }
    }

    function encode_string(str, quote) {
        var ret = make_string(str, quote);
        if (options.inline_script) {
            ret = ret.replace(/<\x2f(script)([>\/\t\n\f\r ])/gi, "<\\/$1$2");
            ret = ret.replace(/\x3c!--/g, "\\x3c!--");
            ret = ret.replace(/--\x3e/g, "--\\x3e");
        }
        return ret;
    }

    function make_name(name) {
        name = name.toString();
        name = to_utf8(name, true);
        return name;
    }

    /* -----[ beautification/minification ]----- */

    var has_parens = false;
    var line_end = 0;
    var line_fixed = true;
    var might_need_space = false;
    var might_need_semicolon = false;
    var need_newline_indented = false;
    var need_space = false;
    var newline_insert = -1;
    var last = "";
    var mapping_token, mapping_name, mappings = options.source_map && [];

    var adjust_mappings = mappings ? function(line, col) {
        mappings.forEach(function(mapping) {
            mapping.line += line;
            mapping.col += col;
        });
    } : noop;

    var flush_mappings = mappings ? function() {
        mappings.forEach(function(mapping) {
            options.source_map.add(
                mapping.token.file,
                mapping.line, mapping.col,
                mapping.token.line, mapping.token.col,
                !mapping.name && mapping.token.type == "name" ? mapping.token.value : mapping.name
            );
        });
        mappings = [];
    } : noop;

    function insert_newlines(count) {
        var index = OUTPUT.lastIndexOf("\n");
        if (line_end < index) line_end = index;
        var left = OUTPUT.slice(0, line_end);
        var right = OUTPUT.slice(line_end);
        adjust_mappings(count, right.length - current_col);
        current_line += count;
        current_pos += count;
        current_col = right.length;
        OUTPUT = left;
        while (count--) OUTPUT += "\n";
        OUTPUT += right;
    }

    var fix_line = options.max_line_len ? function() {
        if (line_fixed) {
            if (current_col > options.max_line_len) {
                AST_Node.warn("Output exceeds {max_line_len} characters", options);
            }
            return;
        }
        if (current_col > options.max_line_len) insert_newlines(1);
        line_fixed = true;
        flush_mappings();
    } : noop;

    var requireSemicolonChars = makePredicate("( [ + * / - , .");

    function print(str) {
        str = String(str);
        var ch = str.charAt(0);
        if (need_newline_indented && ch) {
            need_newline_indented = false;
            if (ch != "\n") {
                print("\n");
                indent();
            }
        }
        if (need_space && ch) {
            need_space = false;
            if (!/[\s;})]/.test(ch)) {
                space();
            }
        }
        newline_insert = -1;
        var prev = last.slice(-1);
        if (might_need_semicolon) {
            might_need_semicolon = false;

            if (prev == ":" && ch == "}" || (!ch || ";}".indexOf(ch) < 0) && prev != ";") {
                if (options.semicolons || requireSemicolonChars[ch]) {
                    OUTPUT += ";";
                    current_col++;
                    current_pos++;
                } else {
                    fix_line();
                    OUTPUT += "\n";
                    current_pos++;
                    current_line++;
                    current_col = 0;

                    if (/^\s+$/.test(str)) {
                        // reset the semicolon flag, since we didn't print one
                        // now and might still have to later
                        might_need_semicolon = true;
                    }
                }

                if (!options.beautify)
                    might_need_space = false;
            }
        }

        if (might_need_space) {
            if (is_identifier_char(prev) && (is_identifier_char(ch) || ch == "\\")
                || (ch == "/" && ch == prev)
                || ((ch == "+" || ch == "-") && ch == last)
                || str == "--" && last == "!"
                || str == "in" && prev == "/"
                || last == "--" && ch == ">") {
                OUTPUT += " ";
                current_col++;
                current_pos++;
            }
            if (prev != "<" || str != "!") might_need_space = false;
        }

        if (mapping_token) {
            mappings.push({
                token: mapping_token,
                name: mapping_name,
                line: current_line,
                col: current_col
            });
            mapping_token = false;
            if (line_fixed) flush_mappings();
        }

        OUTPUT += str;
        has_parens = str.slice(-1) == "(";
        current_pos += str.length;
        var a = str.split(/\r?\n/), n = a.length - 1;
        current_line += n;
        current_col += a[0].length;
        if (n > 0) {
            fix_line();
            current_col = a[n].length;
        }
        last = str;
    }

    var space = options.beautify ? function() {
        print(" ");
    } : function() {
        might_need_space = true;
    };

    var indent = options.beautify ? function(half) {
        print(repeat_string(" ", half ? indentation - (options.indent_level >> 1) : indentation));
    } : noop;

    var with_indent = options.beautify ? function(col, cont) {
        if (col === true) col = next_indent();
        var save_indentation = indentation;
        indentation = col;
        var ret = cont();
        indentation = save_indentation;
        return ret;
    } : function(col, cont) { return cont() };

    var may_add_newline = options.max_line_len || options.preserve_line ? function() {
        fix_line();
        line_end = OUTPUT.length;
        line_fixed = false;
    } : noop;

    var newline = options.beautify ? function() {
        if (newline_insert < 0) return print("\n");
        if (OUTPUT[newline_insert] != "\n") {
            OUTPUT = OUTPUT.slice(0, newline_insert) + "\n" + OUTPUT.slice(newline_insert);
            current_pos++;
            current_line++;
        }
        newline_insert++;
    } : may_add_newline;

    var semicolon = options.beautify ? function() {
        print(";");
    } : function() {
        might_need_semicolon = true;
    };

    function force_semicolon() {
        if (might_need_semicolon) print(";");
        print(";");
    }

    function next_indent() {
        return indentation + options.indent_level;
    }

    function with_block(cont) {
        var ret;
        print("{");
        newline();
        with_indent(next_indent(), function() {
            ret = cont();
        });
        indent();
        print("}");
        return ret;
    }

    function with_parens(cont) {
        print("(");
        may_add_newline();
        //XXX: still nice to have that for argument lists
        //var ret = with_indent(current_col, cont);
        var ret = cont();
        may_add_newline();
        print(")");
        return ret;
    }

    function with_square(cont) {
        print("[");
        may_add_newline();
        //var ret = with_indent(current_col, cont);
        var ret = cont();
        may_add_newline();
        print("]");
        return ret;
    }

    function comma() {
        may_add_newline();
        print(",");
        may_add_newline();
        space();
    }

    function colon() {
        print(":");
        space();
    }

    var add_mapping = mappings ? function(token, name) {
        mapping_token = token;
        mapping_name = name;
    } : noop;

    function get() {
        if (!line_fixed) fix_line();
        return OUTPUT;
    }

    function has_nlb() {
        var index = OUTPUT.lastIndexOf("\n");
        return /^ *$/.test(OUTPUT.slice(index + 1));
    }

    function prepend_comments(node) {
        var self = this;
        var scan = node instanceof AST_Exit && node.value;
        var comments = dump(node);
        if (!comments) comments = [];

        if (scan) {
            var tw = new TreeWalker(function(node) {
                var parent = tw.parent();
                if (parent instanceof AST_Exit
                    || parent instanceof AST_Binary && parent.left === node
                    || parent.TYPE == "Call" && parent.expression === node
                    || parent instanceof AST_Conditional && parent.condition === node
                    || parent instanceof AST_Dot && parent.expression === node
                    || parent instanceof AST_Sequence && parent.expressions[0] === node
                    || parent instanceof AST_Sub && parent.expression === node
                    || parent instanceof AST_UnaryPostfix) {
                    var before = dump(node);
                    if (before) comments = comments.concat(before);
                } else {
                    return true;
                }
            });
            tw.push(node);
            node.value.walk(tw);
        }

        if (current_pos == 0) {
            if (comments.length > 0 && options.shebang && comments[0].type == "comment5") {
                print("#!" + comments.shift().value + "\n");
                indent();
            }
            var preamble = options.preamble;
            if (preamble) {
                print(preamble.replace(/\r\n?|[\n\u2028\u2029]|\s*$/g, "\n"));
            }
        }

        comments = comments.filter(comment_filter, node);
        if (comments.length == 0) return;
        var last_nlb = has_nlb();
        comments.forEach(function(c, i) {
            if (!last_nlb) {
                if (c.nlb) {
                    print("\n");
                    indent();
                    last_nlb = true;
                } else if (i > 0) {
                    space();
                }
            }
            if (/comment[134]/.test(c.type)) {
                print("//" + c.value.replace(/[@#]__PURE__/g, " ") + "\n");
                indent();
                last_nlb = true;
            } else if (c.type == "comment2") {
                print("/*" + c.value.replace(/[@#]__PURE__/g, " ") + "*/");
                last_nlb = false;
            }
        });
        if (!last_nlb) {
            if (node.start.nlb) {
                print("\n");
                indent();
            } else {
                space();
            }
        }

        function dump(node) {
            var token = node.start;
            if (!token) {
                if (!scan) return;
                node.start = token = new AST_Token();
            }
            var comments = token.comments_before;
            if (!comments) {
                if (!scan) return;
                token.comments_before = comments = [];
            }
            if (comments._dumped === self) return;
            comments._dumped = self;
            return comments;
        }
    }

    function append_comments(node, tail) {
        var self = this;
        var token = node.end;
        if (!token) return;
        var comments = token[tail ? "comments_before" : "comments_after"];
        if (!comments || comments._dumped === self) return;
        if (!(node instanceof AST_Statement || all(comments, function(c) {
            return !/comment[134]/.test(c.type);
        }))) return;
        comments._dumped = self;
        var insert = OUTPUT.length;
        comments.filter(comment_filter, node).forEach(function(c, i) {
            need_space = false;
            if (need_newline_indented) {
                print("\n");
                indent();
                need_newline_indented = false;
            } else if (c.nlb && (i > 0 || !has_nlb())) {
                print("\n");
                indent();
            } else if (i > 0 || !tail) {
                space();
            }
            if (/comment[134]/.test(c.type)) {
                print("//" + c.value.replace(/[@#]__PURE__/g, " "));
                need_newline_indented = true;
            } else if (c.type == "comment2") {
                print("/*" + c.value.replace(/[@#]__PURE__/g, " ") + "*/");
                need_space = true;
            }
        });
        if (OUTPUT.length > insert) newline_insert = insert;
    }

    var stack = [];
    return {
        get             : get,
        toString        : get,
        indent          : indent,
        should_break    : readonly ? noop : function() {
            return options.width && current_col - indentation >= options.width;
        },
        has_parens      : function() { return has_parens },
        newline         : newline,
        print           : print,
        space           : space,
        comma           : comma,
        colon           : colon,
        last            : function() { return last },
        semicolon       : semicolon,
        force_semicolon : force_semicolon,
        to_utf8         : to_utf8,
        print_name      : function(name) { print(make_name(name)) },
        print_string    : function(str, quote) { print(encode_string(str, quote)) },
        next_indent     : next_indent,
        with_indent     : with_indent,
        with_block      : with_block,
        with_parens     : with_parens,
        with_square     : with_square,
        add_mapping     : add_mapping,
        option          : function(opt) { return options[opt] },
        prepend_comments: readonly ? noop : prepend_comments,
        append_comments : readonly || comment_filter === return_false ? noop : append_comments,
        line            : function() { return current_line },
        col             : function() { return current_col },
        pos             : function() { return current_pos },
        push_node       : function(node) { stack.push(node) },
        pop_node        : options.preserve_line ? function() {
            var node = stack.pop();
            if (node.start && node.start.line > current_line) {
                insert_newlines(node.start.line - current_line);
            }
        } : function() {
            stack.pop();
        },
        parent          : function(n) {
            return stack[stack.length - 2 - (n || 0)];
        },
    };
}

/* -----[ code generators ]----- */

(function() {

    /* -----[ utils ]----- */

    function DEFPRINT(nodetype, generator) {
        nodetype.DEFMETHOD("_codegen", generator);
    }

    var use_asm = false;

    AST_Node.DEFMETHOD("print", function(stream, force_parens) {
        var self = this;
        stream.push_node(self);
        if (force_parens || self.needs_parens(stream)) {
            stream.with_parens(doit);
        } else {
            doit();
        }
        stream.pop_node();

        function doit() {
            stream.prepend_comments(self);
            self.add_source_map(stream);
            self._codegen(stream);
            stream.append_comments(self);
        }
    });
    AST_Node.DEFMETHOD("print_to_string", function(options) {
        var s = OutputStream(options);
        this.print(s);
        return s.get();
    });

    /* -----[ PARENTHESES ]----- */

    function PARENS(nodetype, func) {
        nodetype.DEFMETHOD("needs_parens", func);
    }

    PARENS(AST_Node, return_false);

    // a function expression needs parens around it when it's provably
    // the first token to appear in a statement.
    function needs_parens_function(output) {
        if (!output.has_parens() && first_in_statement(output)) return true;
        if (output.option("webkit")) {
            var p = output.parent();
            if (p instanceof AST_PropAccess && p.expression === this) return true;
        }
        if (output.option("wrap_iife")) {
            var p = output.parent();
            if (p instanceof AST_Call && p.expression === this) return true;
        }
    }
    PARENS(AST_AsyncFunction, needs_parens_function);
    PARENS(AST_Function, needs_parens_function);

    // same goes for an object literal, because otherwise it would be
    // interpreted as a block of code.
    function needs_parens_obj(output) {
        return !output.has_parens() && first_in_statement(output, true);
    }
    PARENS(AST_Object, needs_parens_obj);

    PARENS(AST_Unary, function(output) {
        var p = output.parent();
        return (p instanceof AST_Call || p instanceof AST_PropAccess) && p.expression === this;
    });

    PARENS(AST_Sequence, function(output) {
        var p = output.parent();
            // [ 1, (2, 3), 4 ] ==> [ 1, 3, 4 ]
        return p instanceof AST_Array
            // () => (foo, bar)
            || p instanceof AST_Arrow && p.value === this
            // await (foo, bar)
            || p instanceof AST_Await
            // 1 + (2, 3) + 4 ==> 8
            || p instanceof AST_Binary
            // new (foo, bar) or foo(1, (2, 3), 4)
            || p instanceof AST_Call
            // (false, true) ? (a = 10, b = 20) : (c = 30)
            // ==> 20 (side effect, set a := 10 and b := 20)
            || p instanceof AST_Conditional
            // [ a = (1, 2) ] = [] ==> a == 2
            || p instanceof AST_DefaultValue
            // { [(1, 2)]: 3 }[2] ==> 3
            // { foo: (1, 2) }.foo ==> 2
            || p instanceof AST_DestructuredKeyVal
            || p instanceof AST_ObjectProperty
            // (1, {foo:2}).foo or (1, {foo:2})["foo"] ==> 2
            || p instanceof AST_PropAccess && p.expression === this
            // ...(foo, bar, baz)
            || p instanceof AST_Spread
            // !(foo, bar, baz)
            || p instanceof AST_Unary
            // var a = (1, 2), b = a + a; ==> b == 4
            || p instanceof AST_VarDef;
    });

    PARENS(AST_Binary, function(output) {
        var p = output.parent();
        // await (foo && bar)
        if (p instanceof AST_Await) return true;
        // this deals with precedence: 3 * (2 + 1)
        if (p instanceof AST_Binary) {
            var po = p.operator, pp = PRECEDENCE[po];
            var so = this.operator, sp = PRECEDENCE[so];
            return pp > sp || (pp == sp && this === p.right);
        }
        // (foo && bar)()
        if (p instanceof AST_Call) return p.expression === this;
        // (foo && bar)["prop"], (foo && bar).prop
        if (p instanceof AST_PropAccess) return p.expression === this;
        // typeof (foo && bar)
        if (p instanceof AST_Unary) return true;
    });

    PARENS(AST_PropAccess, function(output) {
        var node = this;
        var p = output.parent();
        if (p instanceof AST_New && p.expression === node) {
            // i.e. new (foo().bar)
            //
            // if there's one call into this subtree, then we need
            // parens around it too, otherwise the call will be
            // interpreted as passing the arguments to the upper New
            // expression.
            do {
                node = node.expression;
            } while (node instanceof AST_PropAccess);
            return node.TYPE == "Call";
        }
    });

    PARENS(AST_Call, function(output) {
        var p = output.parent();
        if (p instanceof AST_New) return p.expression === this;
        // https://bugs.webkit.org/show_bug.cgi?id=123506
        if (output.option("webkit")) {
            var g = output.parent(1);
            return this.expression instanceof AST_Function
                && p instanceof AST_PropAccess
                && p.expression === this
                && g instanceof AST_Assign
                && g.left === p;
        }
    });

    PARENS(AST_New, function(output) {
        if (need_constructor_parens(this, output)) return false;
        var p = output.parent();
        // (new foo)(bar)
        if (p instanceof AST_Call) return p.expression === this;
        // (new Date).getTime(), (new Date)["getTime"]()
        return p instanceof AST_PropAccess;
    });

    PARENS(AST_Number, function(output) {
        var p = output.parent();
        if (p instanceof AST_PropAccess && p.expression === this) {
            var value = this.value;
                // https://github.com/mishoo/UglifyJS/issues/115
            return value < 0
                // https://github.com/mishoo/UglifyJS/pull/1009
                || output.option("galio") && /^0/.test(make_num(value));
        }
    });

    function needs_parens_assign_cond(self, output) {
        var p = output.parent();
        // await (a = foo)
        if (p instanceof AST_Await) return true;
        // 1 + (a = 2) + 3 → 6, side effect setting a = 2
        if (p instanceof AST_Binary) return !(p instanceof AST_Assign);
        // (a = func)() —or— new (a = Object)()
        if (p instanceof AST_Call) return p.expression === self;
        // (a = foo) ? bar : baz
        if (p instanceof AST_Conditional) return p.condition === self;
        // (a = foo)["prop"] —or— (a = foo).prop
        if (p instanceof AST_PropAccess) return p.expression === self;
        // !(a = false) → true
        if (p instanceof AST_Unary) return true;
    }
    PARENS(AST_Arrow, function(output) {
        return needs_parens_assign_cond(this, output);
    });
    PARENS(AST_Assign, function(output) {
        if (needs_parens_assign_cond(this, output)) return true;
        //  v8 parser bug   =>     workaround
        // f([1], [a] = []) => f([1], ([a] = []))
        if (output.option("v8")) return this.left instanceof AST_Destructured;
        // ({ p: a } = o);
        if (this.left instanceof AST_DestructuredObject) return needs_parens_obj(output);
    });
    PARENS(AST_Conditional, function(output) {
        return needs_parens_assign_cond(this, output);
    });

    PARENS(AST_Await, function(output) {
        var p = output.parent();
        // new (await foo)
        // (await foo)(bar)
        if (p instanceof AST_Call) return p.expression === this;
        // (await foo).prop
        // (await foo)["prop"]
        if (p instanceof AST_PropAccess) return p.expression === this;
    });

    /* -----[ PRINTERS ]----- */

    DEFPRINT(AST_Directive, function(output) {
        var quote = this.quote;
        var value = this.value;
        switch (output.option("quote_style")) {
          case 0:
          case 2:
            if (value.indexOf('"') == -1) quote = '"';
            break;
          case 1:
            if (value.indexOf("'") == -1) quote = "'";
            break;
        }
        output.print(quote + value + quote);
        output.semicolon();
    });
    DEFPRINT(AST_Debugger, function(output) {
        output.print("debugger");
        output.semicolon();
    });

    /* -----[ statements ]----- */

    function display_body(body, is_toplevel, output, allow_directives) {
        var last = body.length - 1;
        var in_directive = allow_directives;
        var was_asm = use_asm;
        body.forEach(function(stmt, i) {
            if (in_directive) {
                if (stmt instanceof AST_Directive) {
                    if (stmt.value == "use asm") use_asm = true;
                } else if (!(stmt instanceof AST_EmptyStatement)) {
                    if (stmt instanceof AST_SimpleStatement && stmt.body instanceof AST_String) {
                        output.force_semicolon();
                    }
                    in_directive = false;
                }
            }
            if (stmt instanceof AST_EmptyStatement) return;
            output.indent();
            stmt.print(output);
            if (i == last && is_toplevel) return;
            output.newline();
            if (is_toplevel) output.newline();
        });
        use_asm = was_asm;
    }

    DEFPRINT(AST_Statement, function(output) {
        this.body.print(output);
        output.semicolon();
    });
    DEFPRINT(AST_Toplevel, function(output) {
        display_body(this.body, true, output, true);
        output.print("");
    });
    DEFPRINT(AST_LabeledStatement, function(output) {
        this.label.print(output);
        output.colon();
        this.body.print(output);
    });
    DEFPRINT(AST_SimpleStatement, function(output) {
        this.body.print(output);
        output.semicolon();
    });
    function print_braced_empty(self, output) {
        output.print("{");
        output.with_indent(output.next_indent(), function() {
            output.append_comments(self, true);
        });
        output.print("}");
    }
    function print_braced(self, output, allow_directives) {
        if (self.body.length > 0) {
            output.with_block(function() {
                display_body(self.body, false, output, allow_directives);
            });
        } else print_braced_empty(self, output);
    }
    DEFPRINT(AST_BlockStatement, function(output) {
        print_braced(this, output);
    });
    DEFPRINT(AST_EmptyStatement, function(output) {
        output.semicolon();
    });
    DEFPRINT(AST_Do, function(output) {
        var self = this;
        output.print("do");
        output.space();
        make_block(self.body, output);
        output.space();
        output.print("while");
        output.space();
        output.with_parens(function() {
            self.condition.print(output);
        });
        output.semicolon();
    });
    DEFPRINT(AST_While, function(output) {
        var self = this;
        output.print("while");
        output.space();
        output.with_parens(function() {
            self.condition.print(output);
        });
        output.space();
        force_statement(self.body, output);
    });
    DEFPRINT(AST_For, function(output) {
        var self = this;
        output.print("for");
        output.space();
        output.with_parens(function() {
            if (self.init) {
                if (self.init instanceof AST_Definitions) {
                    self.init.print(output);
                } else {
                    parenthesize_for_noin(self.init, output, true);
                }
                output.print(";");
                output.space();
            } else {
                output.print(";");
            }
            if (self.condition) {
                self.condition.print(output);
                output.print(";");
                output.space();
            } else {
                output.print(";");
            }
            if (self.step) {
                self.step.print(output);
            }
        });
        output.space();
        force_statement(self.body, output);
    });
    DEFPRINT(AST_ForIn, function(output) {
        var self = this;
        output.print("for");
        output.space();
        output.with_parens(function() {
            self.init.print(output);
            output.space();
            output.print("in");
            output.space();
            self.object.print(output);
        });
        output.space();
        force_statement(self.body, output);
    });
    DEFPRINT(AST_With, function(output) {
        var self = this;
        output.print("with");
        output.space();
        output.with_parens(function() {
            self.expression.print(output);
        });
        output.space();
        force_statement(self.body, output);
    });

    /* -----[ functions ]----- */
    DEFPRINT(AST_Arrow, function(output) {
        var self = this;
        if (self.argnames.length == 1 && self.argnames[0] instanceof AST_SymbolFunarg) {
            self.argnames[0].print(output);
        } else output.with_parens(function() {
            self.argnames.forEach(function(arg, i) {
                if (i) output.comma();
                arg.print(output);
            });
        });
        output.space();
        output.print("=>");
        output.space();
        if (self.value) {
            self.value.print(output);
        } else {
            print_braced(self, output, true);
        }
    });
    function print_lambda(self, output) {
        if (self.name) {
            output.space();
            self.name.print(output);
        }
        output.with_parens(function() {
            self.argnames.forEach(function(arg, i) {
                if (i) output.comma();
                arg.print(output);
            });
        });
        output.space();
        print_braced(self, output, true);
    }
    DEFPRINT(AST_Lambda, function(output) {
        output.print("function");
        print_lambda(this, output);
    });
    function print_async(output) {
        output.print("async");
        output.space();
        output.print("function");
        print_lambda(this, output);
    }
    DEFPRINT(AST_AsyncDefun, print_async);
    DEFPRINT(AST_AsyncFunction, print_async);

    /* -----[ jumps ]----- */
    function print_jump(kind, prop) {
        return function(output) {
            output.print(kind);
            var target = this[prop];
            if (target) {
                output.space();
                target.print(output);
            }
            output.semicolon();
        };
    }
    DEFPRINT(AST_Return, print_jump("return", "value"));
    DEFPRINT(AST_Throw, print_jump("throw", "value"));
    DEFPRINT(AST_Break, print_jump("break", "label"));
    DEFPRINT(AST_Continue, print_jump("continue", "label"));

    /* -----[ if ]----- */
    function make_then(self, output) {
        var b = self.body;
        if (output.option("braces") && !(b instanceof AST_Const || b instanceof AST_Let)
            || output.option("ie8") && b instanceof AST_Do)
            return make_block(b, output);
        // The squeezer replaces "block"-s that contain only a single
        // statement with the statement itself; technically, the AST
        // is correct, but this can create problems when we output an
        // IF having an ELSE clause where the THEN clause ends in an
        // IF *without* an ELSE block (then the outer ELSE would refer
        // to the inner IF).  This function checks for this case and
        // adds the block braces if needed.
        if (!b) return output.force_semicolon();
        while (true) {
            if (b instanceof AST_If) {
                if (!b.alternative) {
                    make_block(self.body, output);
                    return;
                }
                b = b.alternative;
            } else if (b instanceof AST_StatementWithBody) {
                b = b.body;
            } else break;
        }
        force_statement(self.body, output);
    }
    DEFPRINT(AST_If, function(output) {
        var self = this;
        output.print("if");
        output.space();
        output.with_parens(function() {
            self.condition.print(output);
        });
        output.space();
        if (self.alternative) {
            make_then(self, output);
            output.space();
            output.print("else");
            output.space();
            if (self.alternative instanceof AST_If)
                self.alternative.print(output);
            else
                force_statement(self.alternative, output);
        } else {
            force_statement(self.body, output);
        }
    });

    /* -----[ switch ]----- */
    DEFPRINT(AST_Switch, function(output) {
        var self = this;
        output.print("switch");
        output.space();
        output.with_parens(function() {
            self.expression.print(output);
        });
        output.space();
        var last = self.body.length - 1;
        if (last < 0) print_braced_empty(self, output);
        else output.with_block(function() {
            self.body.forEach(function(branch, i) {
                output.indent(true);
                branch.print(output);
                if (i < last && branch.body.length > 0)
                    output.newline();
            });
        });
    });
    function print_branch_body(self, output) {
        output.newline();
        self.body.forEach(function(stmt) {
            output.indent();
            stmt.print(output);
            output.newline();
        });
    }
    DEFPRINT(AST_Default, function(output) {
        output.print("default:");
        print_branch_body(this, output);
    });
    DEFPRINT(AST_Case, function(output) {
        var self = this;
        output.print("case");
        output.space();
        self.expression.print(output);
        output.print(":");
        print_branch_body(self, output);
    });

    /* -----[ exceptions ]----- */
    DEFPRINT(AST_Try, function(output) {
        var self = this;
        output.print("try");
        output.space();
        print_braced(self, output);
        if (self.bcatch) {
            output.space();
            self.bcatch.print(output);
        }
        if (self.bfinally) {
            output.space();
            self.bfinally.print(output);
        }
    });
    DEFPRINT(AST_Catch, function(output) {
        var self = this;
        output.print("catch");
        if (self.argname) {
            output.space();
            output.with_parens(function() {
                self.argname.print(output);
            });
        }
        output.space();
        print_braced(self, output);
    });
    DEFPRINT(AST_Finally, function(output) {
        output.print("finally");
        output.space();
        print_braced(this, output);
    });

    function print_definitinos(type) {
        return function(output) {
            var self = this;
            output.print(type);
            output.space();
            self.definitions.forEach(function(def, i) {
                if (i) output.comma();
                def.print(output);
            });
            var p = output.parent();
            if (p && p.init !== self || !(p instanceof AST_For || p instanceof AST_ForIn)) output.semicolon();
        };
    }
    DEFPRINT(AST_Const, print_definitinos("const"));
    DEFPRINT(AST_Let, print_definitinos("let"));
    DEFPRINT(AST_Var, print_definitinos("var"));

    function parenthesize_for_noin(node, output, noin) {
        var parens = false;
        // need to take some precautions here:
        //    https://github.com/mishoo/UglifyJS/issues/60
        if (noin) node.walk(new TreeWalker(function(node) {
            if (parens) return true;
            if (node instanceof AST_Binary && node.operator == "in") return parens = true;
            if (node instanceof AST_Scope && !(node instanceof AST_Arrow && node.value)) return true;
        }));
        node.print(output, parens);
    }

    DEFPRINT(AST_VarDef, function(output) {
        var self = this;
        self.name.print(output);
        if (self.value) {
            output.space();
            output.print("=");
            output.space();
            var p = output.parent(1);
            var noin = p instanceof AST_For || p instanceof AST_ForIn;
            parenthesize_for_noin(self.value, output, noin);
        }
    });

    DEFPRINT(AST_DefaultValue, function(output) {
        var self = this;
        self.name.print(output);
        output.space();
        output.print("=");
        output.space();
        self.value.print(output);
    });

    /* -----[ other expressions ]----- */
    function print_call_args(self, output) {
        if (self.expression instanceof AST_Call || self.expression instanceof AST_Lambda) {
            output.add_mapping(self.start);
        }
        output.with_parens(function() {
            self.args.forEach(function(expr, i) {
                if (i) output.comma();
                expr.print(output);
            });
        });
    }
    DEFPRINT(AST_Call, function(output) {
        this.expression.print(output);
        print_call_args(this, output);
    });
    DEFPRINT(AST_New, function(output) {
        var self = this;
        output.print("new");
        output.space();
        self.expression.print(output);
        if (need_constructor_parens(self, output)) print_call_args(self, output);
    });
    DEFPRINT(AST_Sequence, function(output) {
        this.expressions.forEach(function(node, index) {
            if (index > 0) {
                output.comma();
                if (output.should_break()) {
                    output.newline();
                    output.indent();
                }
            }
            node.print(output);
        });
    });
    DEFPRINT(AST_Dot, function(output) {
        var self = this;
        var expr = self.expression;
        expr.print(output);
        var prop = self.property;
        if (output.option("ie8") && RESERVED_WORDS[prop]) {
            output.print("[");
            output.add_mapping(self.end);
            output.print_string(prop);
            output.print("]");
        } else {
            if (expr instanceof AST_Number && expr.value >= 0) {
                if (!/[xa-f.)]/i.test(output.last())) {
                    output.print(".");
                }
            }
            output.print(".");
            // the name after dot would be mapped about here.
            output.add_mapping(self.end);
            output.print_name(prop);
        }
    });
    DEFPRINT(AST_Sub, function(output) {
        this.expression.print(output);
        output.print("[");
        this.property.print(output);
        output.print("]");
    });
    DEFPRINT(AST_Spread, function(output) {
        output.print("...");
        this.expression.print(output);
    });
    DEFPRINT(AST_UnaryPrefix, function(output) {
        var op = this.operator;
        var exp = this.expression;
        output.print(op);
        if (/^[a-z]/i.test(op)
            || (/[+-]$/.test(op)
                && exp instanceof AST_UnaryPrefix
                && /^[+-]/.test(exp.operator))) {
            output.space();
        }
        exp.print(output);
    });
    DEFPRINT(AST_UnaryPostfix, function(output) {
        this.expression.print(output);
        output.print(this.operator);
    });
    DEFPRINT(AST_Binary, function(output) {
        var self = this;
        self.left.print(output);
        output.space();
        output.print(self.operator);
        output.space();
        self.right.print(output);
    });
    DEFPRINT(AST_Conditional, function(output) {
        var self = this;
        self.condition.print(output);
        output.space();
        output.print("?");
        output.space();
        self.consequent.print(output);
        output.space();
        output.colon();
        self.alternative.print(output);
    });
    DEFPRINT(AST_Await, function(output) {
        output.print("await");
        output.space();
        this.expression.print(output);
    });

    /* -----[ literals ]----- */
    DEFPRINT(AST_Array, function(output) {
        var a = this.elements, len = a.length;
        output.with_square(len > 0 ? function() {
            output.space();
            a.forEach(function(exp, i) {
                if (i) output.comma();
                exp.print(output);
                // If the final element is a hole, we need to make sure it
                // doesn't look like a trailing comma, by inserting an actual
                // trailing comma.
                if (i === len - 1 && exp instanceof AST_Hole)
                  output.comma();
            });
            output.space();
        } : noop);
    });
    DEFPRINT(AST_DestructuredArray, function(output) {
        var a = this.elements, len = a.length;
        output.with_square(len > 0 ? function() {
            output.space();
            a.forEach(function(exp, i) {
                if (i) output.comma();
                exp.print(output);
                // If the final element is a hole, we need to make sure it
                // doesn't look like a trailing comma, by inserting an actual
                // trailing comma.
                if (i === len - 1 && exp instanceof AST_Hole)
                  output.comma();
            });
            output.space();
        } : noop);
    });
    DEFPRINT(AST_DestructuredKeyVal, print_key_value);
    DEFPRINT(AST_DestructuredObject, function(output) {
        var props = this.properties;
        if (props.length > 0) output.with_block(function() {
            props.forEach(function(prop, i) {
                if (i) {
                    output.print(",");
                    output.newline();
                }
                output.indent();
                prop.print(output);
            });
            output.newline();
        });
        else print_braced_empty(this, output);
    });
    DEFPRINT(AST_Object, function(output) {
        var props = this.properties;
        if (props.length > 0) output.with_block(function() {
            props.forEach(function(prop, i) {
                if (i) {
                    output.print(",");
                    output.newline();
                }
                output.indent();
                prop.print(output);
            });
            output.newline();
        });
        else print_braced_empty(this, output);
    });

    function print_property_key(self, output) {
        var key = self.key;
        if (key instanceof AST_Node) {
            output.with_square(function() {
                key.print(output);
            });
        } else if (output.option("quote_keys")) {
            output.print_string(key);
        } else if ("" + +key == key && key >= 0) {
            output.print(make_num(key));
        } else {
            var quote = self.start && self.start.quote;
            if (RESERVED_WORDS[key] ? !output.option("ie8") : is_identifier_string(key)) {
                if (quote && output.option("keep_quoted_props")) {
                    output.print_string(key, quote);
                } else {
                    output.print_name(key);
                }
            } else {
                output.print_string(key, quote);
            }
        }
    }

    function print_key_value(output) {
        var self = this;
        print_property_key(self, output);
        output.colon();
        self.value.print(output);
    }
    DEFPRINT(AST_ObjectKeyVal, print_key_value);
    function print_accessor(type) {
        return function(output) {
            var self = this;
            output.print(type);
            output.space();
            print_property_key(self, output);
            print_lambda(self.value, output);
        };
    }
    DEFPRINT(AST_ObjectGetter, print_accessor("get"));
    DEFPRINT(AST_ObjectSetter, print_accessor("set"));
    DEFPRINT(AST_Symbol, function(output) {
        var def = this.definition();
        output.print_name(def && def.mangled_name || this.name);
    });
    DEFPRINT(AST_Hole, noop);
    DEFPRINT(AST_This, function(output) {
        output.print("this");
    });
    DEFPRINT(AST_Constant, function(output) {
        output.print(this.value);
    });
    DEFPRINT(AST_String, function(output) {
        output.print_string(this.value, this.quote);
    });
    DEFPRINT(AST_Number, function(output) {
        var start = this.start;
        if (use_asm && start && start.raw != null) {
            output.print(start.raw);
        } else {
            output.print(make_num(this.value));
        }
    });

    DEFPRINT(AST_RegExp, function(output) {
        var regexp = this.value;
        var str = regexp.toString();
        var end = str.lastIndexOf("/");
        if (regexp.raw_source) {
            str = "/" + regexp.raw_source + str.slice(end);
        } else if (end == 1) {
            str = "/(?:)" + str.slice(end);
        } else if (str.indexOf("/", 1) < end) {
            str = "/" + str.slice(1, end).replace(/\\\\|[^/]?\//g, function(match) {
                return match[0] == "\\" ? match : match.slice(0, -1) + "\\/";
            }) + str.slice(end);
        }
        output.print(output.to_utf8(str).replace(/\\(?:\0(?![0-9])|[^\0])/g, function(match) {
            switch (match[1]) {
              case "\n": return "\\n";
              case "\r": return "\\r";
              case "\t": return "\t";
              case "\b": return "\b";
              case "\f": return "\f";
              case "\0": return "\0";
              case "\x0B": return "\v";
              case "\u2028": return "\\u2028";
              case "\u2029": return "\\u2029";
              default: return match;
            }
        }).replace(/[\n\r\u2028\u2029]/g, function(c) {
            switch (c) {
              case "\n": return "\\n";
              case "\r": return "\\r";
              case "\u2028": return "\\u2028";
              case "\u2029": return "\\u2029";
            }
        }));
        var p = output.parent();
        if (p instanceof AST_Binary && /^in/.test(p.operator) && p.left === this)
            output.print(" ");
    });

    function force_statement(stat, output) {
        if (output.option("braces") && !(stat instanceof AST_Const || stat instanceof AST_Let)) {
            make_block(stat, output);
        } else if (!stat || stat instanceof AST_EmptyStatement) {
            output.force_semicolon();
        } else {
            stat.print(output);
        }
    }

    // self should be AST_New.  decide if we want to show parens or not.
    function need_constructor_parens(self, output) {
        // Always print parentheses with arguments
        if (self.args.length > 0) return true;

        return output.option("beautify");
    }

    function best_of(a) {
        var best = a[0], len = best.length;
        for (var i = 1; i < a.length; ++i) {
            if (a[i].length < len) {
                best = a[i];
                len = best.length;
            }
        }
        return best;
    }

    function make_num(num) {
        var str = num.toString(10).replace(/^0\./, ".").replace("e+", "e");
        var candidates = [ str ];
        if (Math.floor(num) === num) {
            if (num < 0) {
                candidates.push("-0x" + (-num).toString(16).toLowerCase());
            } else {
                candidates.push("0x" + num.toString(16).toLowerCase());
            }
        }
        var match, len, digits;
        if (match = /^\.0+/.exec(str)) {
            len = match[0].length;
            digits = str.slice(len);
            candidates.push(digits + "e-" + (digits.length + len - 1));
        } else if (match = /0+$/.exec(str)) {
            len = match[0].length;
            candidates.push(str.slice(0, -len) + "e" + len);
        } else if (match = /^(\d)\.(\d+)e(-?\d+)$/.exec(str)) {
            candidates.push(match[1] + match[2] + "e" + (match[3] - match[2].length));
        }
        return best_of(candidates);
    }

    function make_block(stmt, output) {
        if (!stmt || stmt instanceof AST_EmptyStatement)
            output.print("{}");
        else if (stmt instanceof AST_BlockStatement)
            stmt.print(output);
        else output.with_block(function() {
            output.indent();
            stmt.print(output);
            output.newline();
        });
    }

    /* -----[ source map generators ]----- */

    function DEFMAP(nodetype, generator) {
        nodetype.forEach(function(nodetype) {
            nodetype.DEFMETHOD("add_source_map", generator);
        });
    }

    DEFMAP([
        // We could easily add info for ALL nodes, but it seems to me that
        // would be quite wasteful, hence this noop in the base class.
        AST_Node,
        // since the label symbol will mark it
        AST_LabeledStatement,
    ], noop);

    // XXX: I'm not exactly sure if we need it for all of these nodes,
    // or if we should add even more.
    DEFMAP([
        AST_Array,
        AST_BlockStatement,
        AST_Catch,
        AST_Constant,
        AST_Debugger,
        AST_Definitions,
        AST_Destructured,
        AST_Finally,
        AST_Jump,
        AST_Lambda,
        AST_New,
        AST_Object,
        AST_StatementWithBody,
        AST_Symbol,
        AST_Switch,
        AST_SwitchBranch,
        AST_Try,
    ], function(output) {
        output.add_mapping(this.start);
    });

    DEFMAP([ AST_DestructuredKeyVal, AST_ObjectProperty ], function(output) {
        if (typeof this.key == "string") output.add_mapping(this.start, this.key);
    });
})();
/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

function Compressor(options, false_by_default) {
    if (!(this instanceof Compressor))
        return new Compressor(options, false_by_default);
    TreeTransformer.call(this, this.before, this.after);
    this.options = defaults(options, {
        arguments       : !false_by_default,
        arrows          : !false_by_default,
        assignments     : !false_by_default,
        booleans        : !false_by_default,
        collapse_vars   : !false_by_default,
        comparisons     : !false_by_default,
        conditionals    : !false_by_default,
        dead_code       : !false_by_default,
        default_values  : !false_by_default,
        directives      : !false_by_default,
        drop_console    : false,
        drop_debugger   : !false_by_default,
        evaluate        : !false_by_default,
        expression      : false,
        functions       : !false_by_default,
        global_defs     : false,
        hoist_funs      : false,
        hoist_props     : !false_by_default,
        hoist_vars      : false,
        ie8             : false,
        if_return       : !false_by_default,
        inline          : !false_by_default,
        join_vars       : !false_by_default,
        keep_fargs      : false_by_default,
        keep_fnames     : false,
        keep_infinity   : false,
        loops           : !false_by_default,
        merge_vars      : !false_by_default,
        negate_iife     : !false_by_default,
        objects         : !false_by_default,
        passes          : 1,
        properties      : !false_by_default,
        pure_getters    : !false_by_default && "strict",
        pure_funcs      : null,
        reduce_funcs    : !false_by_default,
        reduce_vars     : !false_by_default,
        sequences       : !false_by_default,
        side_effects    : !false_by_default,
        spread          : !false_by_default,
        strings         : !false_by_default,
        switches        : !false_by_default,
        top_retain      : null,
        toplevel        : !!(options && options["top_retain"]),
        typeofs         : !false_by_default,
        unsafe          : false,
        unsafe_comps    : false,
        unsafe_Function : false,
        unsafe_math     : false,
        unsafe_proto    : false,
        unsafe_regexp   : false,
        unsafe_undefined: false,
        unused          : !false_by_default,
        varify          : !false_by_default,
    }, true);
    var evaluate = this.options["evaluate"];
    this.eval_threshold = /eager/.test(evaluate) ? 1 / 0 : +evaluate;
    var global_defs = this.options["global_defs"];
    if (typeof global_defs == "object") for (var key in global_defs) {
        if (/^@/.test(key) && HOP(global_defs, key)) {
            global_defs[key.slice(1)] = parse(global_defs[key], {
                expression: true
            });
        }
    }
    if (this.options["inline"] === true) this.options["inline"] = 3;
    this.drop_fargs = this.options["keep_fargs"] ? return_false : function(lambda, parent) {
        if (lambda.length_read) return false;
        var name = lambda.name;
        if (!name) return parent && parent.TYPE == "Call" && parent.expression === lambda;
        if (name.fixed_value() !== lambda) return false;
        var def = name.definition();
        if (def.direct_access) return false;
        var escaped = def.escaped;
        return escaped && escaped.depth != 1;
    };
    var pure_funcs = this.options["pure_funcs"];
    if (typeof pure_funcs == "function") {
        this.pure_funcs = pure_funcs;
    } else if (typeof pure_funcs == "string") {
        this.pure_funcs = function(node) {
            return pure_funcs !== node.expression.print_to_string();
        };
    } else if (Array.isArray(pure_funcs)) {
        this.pure_funcs = function(node) {
            return !member(node.expression.print_to_string(), pure_funcs);
        };
    } else {
        this.pure_funcs = return_true;
    }
    var sequences = this.options["sequences"];
    this.sequences_limit = sequences == 1 ? 800 : sequences | 0;
    var top_retain = this.options["top_retain"];
    if (top_retain instanceof RegExp) {
        this.top_retain = function(def) {
            return top_retain.test(def.name);
        };
    } else if (typeof top_retain == "function") {
        this.top_retain = top_retain;
    } else if (top_retain) {
        if (typeof top_retain == "string") {
            top_retain = top_retain.split(/,/);
        }
        this.top_retain = function(def) {
            return member(def.name, top_retain);
        };
    }
    var toplevel = this.options["toplevel"];
    this.toplevel = typeof toplevel == "string" ? {
        funcs: /funcs/.test(toplevel),
        vars: /vars/.test(toplevel)
    } : {
        funcs: toplevel,
        vars: toplevel
    };
}

Compressor.prototype = new TreeTransformer;
merge(Compressor.prototype, {
    option: function(key) { return this.options[key] },
    exposed: function(def) {
        if (def.undeclared) return true;
        if (!(def.global || def.scope.resolve() instanceof AST_Toplevel)) return false;
        var toplevel = this.toplevel;
        return !all(def.orig, function(sym) {
            return toplevel[sym instanceof AST_SymbolDefun ? "funcs" : "vars"];
        });
    },
    compress: function(node) {
        node = node.resolve_defines(this);
        if (this.option("expression")) {
            node.process_expression(true);
        }
        var passes = +this.options.passes || 1;
        var min_count = 1 / 0;
        var stopping = false;
        var mangle = { ie8: this.option("ie8") };
        for (var pass = 0; pass < passes; pass++) {
            node.figure_out_scope(mangle);
            if (pass > 0 || this.option("reduce_vars"))
                node.reset_opt_flags(this);
            node = node.transform(this);
            if (passes > 1) {
                var count = 0;
                node.walk(new TreeWalker(function() {
                    count++;
                }));
                AST_Node.info("pass {pass}: last_count: {min_count}, count: {count}", {
                    pass: pass,
                    min_count: min_count,
                    count: count,
                });
                if (count < min_count) {
                    min_count = count;
                    stopping = false;
                } else if (stopping) {
                    break;
                } else {
                    stopping = true;
                }
            }
        }
        if (this.option("expression")) {
            node.process_expression(false);
        }
        return node;
    },
    before: function(node, descend, in_list) {
        if (node._squeezed) return node;
        var is_scope = node instanceof AST_Scope;
        if (is_scope) {
            node.hoist_properties(this);
            node.hoist_declarations(this);
            node.process_boolean_returns(this);
        }
        // Before https://github.com/mishoo/UglifyJS/pull/1602 AST_Node.optimize()
        // would call AST_Node.transform() if a different instance of AST_Node is
        // produced after OPT().
        // This corrupts TreeWalker.stack, which cause AST look-ups to malfunction.
        // Migrate and defer all children's AST_Node.transform() to below, which
        // will now happen after this parent AST_Node has been properly substituted
        // thus gives a consistent AST snapshot.
        descend(node, this);
        // Existing code relies on how AST_Node.optimize() worked, and omitting the
        // following replacement call would result in degraded efficiency of both
        // output and performance.
        descend(node, this);
        var opt = node.optimize(this);
        if (is_scope && opt === node && !this.has_directive("use asm") && !opt.pinned()) {
            opt.merge_variables(this);
            opt.drop_unused(this);
            descend(opt, this);
        }
        if (opt === node) opt._squeezed = true;
        return opt;
    }
});

(function(OPT) {
    OPT(AST_Node, function(self, compressor) {
        return self;
    });

    AST_Node.DEFMETHOD("equivalent_to", function(node) {
        return this.TYPE == node.TYPE && this.print_to_string() == node.print_to_string();
    });

    AST_Scope.DEFMETHOD("process_expression", function(insert, transform) {
        var self = this;
        var tt = new TreeTransformer(function(node) {
            if (insert && node instanceof AST_SimpleStatement) {
                return make_node(AST_Return, node, {
                    value: node.body
                });
            }
            if (!insert && node instanceof AST_Return) {
                return transform ? transform(node) : make_node(AST_SimpleStatement, node, {
                    body: node.value || make_node(AST_UnaryPrefix, node, {
                        operator: "void",
                        expression: make_node(AST_Number, node, {
                            value: 0
                        })
                    })
                });
            }
            if (node instanceof AST_Lambda && node !== self) {
                return node;
            }
            if (node instanceof AST_Block) {
                var index = node.body.length - 1;
                if (index >= 0) {
                    node.body[index] = node.body[index].transform(tt);
                }
            } else if (node instanceof AST_If) {
                node.body = node.body.transform(tt);
                if (node.alternative) {
                    node.alternative = node.alternative.transform(tt);
                }
            } else if (node instanceof AST_With) {
                node.body = node.body.transform(tt);
            }
            return node;
        });
        self.transform(tt);
    });

    function read_property(obj, node) {
        var key = node.getProperty();
        if (key instanceof AST_Node) return;
        var value;
        if (obj instanceof AST_Array) {
            var elements = obj.elements;
            if (key == "length") return make_node_from_constant(elements.length, obj);
            if (typeof key == "number" && key in elements) value = elements[key];
        } else if (obj instanceof AST_Lambda) {
            if (key == "length") {
                obj.length_read = true;
                return make_node_from_constant(obj.argnames.length, obj);
            }
        } else if (obj instanceof AST_Object) {
            key = "" + key;
            var props = obj.properties;
            for (var i = props.length; --i >= 0;) {
                var prop = props[i];
                if (!(prop instanceof AST_ObjectKeyVal)) return;
                if (!value && props[i].key === key) value = props[i].value;
            }
        }
        return value instanceof AST_SymbolRef && value.fixed_value() || value;
    }

    function is_read_only_fn(value, name) {
        if (value instanceof AST_Boolean) return native_fns.Boolean[name];
        if (value instanceof AST_Number) return native_fns.Number[name];
        if (value instanceof AST_String) return native_fns.String[name];
        if (name == "valueOf") return false;
        if (value instanceof AST_Array) return native_fns.Array[name];
        if (value instanceof AST_Lambda) return native_fns.Function[name];
        if (value instanceof AST_Object) return native_fns.Object[name];
        if (value instanceof AST_RegExp) return native_fns.RegExp[name] && !value.value.global;
    }

    function is_modified(compressor, tw, node, value, level, immutable, recursive) {
        var parent = tw.parent(level);
        if (compressor.option("unsafe") && parent instanceof AST_Dot && is_read_only_fn(value, parent.property)) {
            return;
        }
        var lhs = is_lhs(node, parent);
        if (lhs) return lhs;
        if (parent instanceof AST_Array) return is_modified(compressor, tw, parent, parent, level + 1);
        if (parent instanceof AST_Call) {
            return !immutable
                && parent.expression === node
                && !parent.is_expr_pure(compressor)
                && (!is_function(value) || !(parent instanceof AST_New) && value.contains_this());
        }
        if (parent instanceof AST_ForIn) return parent.init === node;
        if (parent instanceof AST_ObjectKeyVal) {
            if (parent.value !== node) return;
            var obj = tw.parent(level + 1);
            return is_modified(compressor, tw, obj, obj, level + 2);
        }
        if (parent instanceof AST_PropAccess) {
            if (parent.expression !== node) return;
            var prop = read_property(value, parent);
            return (!immutable || recursive) && is_modified(compressor, tw, parent, prop, level + 1);
        }
    }

    function is_arguments(def) {
        return def.name == "arguments" && def.scope.uses_arguments;
    }

    function is_funarg(def) {
        return def.orig[0] instanceof AST_SymbolFunarg || def.orig[1] instanceof AST_SymbolFunarg;
    }

    function cross_scope(def, sym) {
        do {
            if (def === sym) return false;
            if (sym instanceof AST_Scope) return true;
        } while (sym = sym.parent_scope);
    }

    function can_drop_symbol(ref, keep_lambda) {
        var def = ref.definition();
        if (ref.in_arg && is_funarg(def)) return false;
        return all(def.orig, function(sym) {
            return !(sym instanceof AST_SymbolConst || sym instanceof AST_SymbolLet
                || keep_lambda && sym instanceof AST_SymbolLambda);
        });
    }

    (function(def) {
        def(AST_Node, noop);

        function reset_def(tw, compressor, def) {
            def.assignments = 0;
            def.bool_fn = 0;
            def.cross_loop = false;
            def.direct_access = false;
            def.escaped = [];
            def.fixed = !def.const_redefs
                && !def.scope.pinned()
                && !compressor.exposed(def)
                && !(is_function(def.init) && def.init !== def.scope)
                && def.init;
            if (is_defun(def.fixed) && !all(def.references, function(ref) {
                var scope = ref.scope.resolve();
                do {
                    if (def.scope === scope) return true;
                } while (is_function(scope) && (scope = scope.parent_scope.resolve()));
            })) {
                tw.defun_ids[def.id] = false;
            }
            def.recursive_refs = 0;
            def.references = [];
            def.should_replace = undefined;
            def.single_use = undefined;
        }

        function reset_variables(tw, compressor, scope) {
            scope.variables.each(function(def) {
                reset_def(tw, compressor, def);
                if (def.fixed === null) {
                    def.safe_ids = tw.safe_ids;
                    mark(tw, def);
                } else if (def.fixed) {
                    tw.loop_ids[def.id] = tw.in_loop;
                    mark(tw, def);
                }
            });
            scope.may_call_this = function() {
                scope.may_call_this = noop;
                if (!scope.contains_this()) return;
                scope.functions.each(function(def) {
                    if (is_defun(def.init) && !(def.id in tw.defun_ids)) {
                        tw.defun_ids[def.id] = false;
                    }
                });
            };
            if (scope.uses_arguments) scope.each_argname(function(node) {
                node.definition().last_ref = false;
            });
            if (compressor.option("ie8")) scope.variables.each(function(def) {
                var d = def.orig[0].definition();
                if (d !== def) d.fixed = false;
            });
        }

        function mark_defun(tw, def) {
            if (def.id in tw.defun_ids) {
                var marker = tw.defun_ids[def.id];
                if (!marker) return;
                var visited = tw.defun_visited[def.id];
                if (marker === tw.safe_ids) {
                    if (!visited) return def.fixed;
                } else if (visited) {
                    def.init.enclosed.forEach(function(d) {
                        if (def.init.variables.get(d.name) === d) return;
                        if (!safe_to_read(tw, d)) d.fixed = false;
                    });
                } else {
                    tw.defun_ids[def.id] = false;
                }
            } else {
                if (!tw.in_loop) {
                    tw.defun_ids[def.id] = tw.safe_ids;
                    return def.fixed;
                }
                tw.defun_ids[def.id] = false;
            }
        }

        function walk_defuns(tw, scope) {
            scope.functions.each(function(def) {
                if (is_defun(def.init) && !tw.defun_visited[def.id]) {
                    tw.defun_ids[def.id] = tw.safe_ids;
                    def.init.walk(tw);
                }
            });
        }

        function push(tw) {
            tw.safe_ids = Object.create(tw.safe_ids);
        }

        function pop(tw) {
            tw.safe_ids = Object.getPrototypeOf(tw.safe_ids);
        }

        function mark(tw, def) {
            tw.safe_ids[def.id] = {};
        }

        function push_ref(def, ref) {
            def.references.push(ref);
            if (def.last_ref !== false) def.last_ref = ref;
        }

        function safe_to_read(tw, def) {
            if (def.single_use == "m") return false;
            var safe = tw.safe_ids[def.id];
            if (safe) {
                if (!HOP(tw.safe_ids, def.id)) safe.read = safe.read && safe.read !== tw.safe_ids ? true : tw.safe_ids;
                if (def.fixed == null) {
                    if (is_arguments(def)) return false;
                    if (def.global && def.name == "arguments") return false;
                    tw.loop_ids[def.id] = null;
                    def.fixed = make_node(AST_Undefined, def.orig[0]);
                    return true;
                }
                return !safe.assign || safe.assign === tw.safe_ids;
            }
            return is_defun(def.fixed);
        }

        function safe_to_assign(tw, def, declare) {
            if (!(declare || all(def.orig, function(sym) {
                return !(sym instanceof AST_SymbolConst);
            }))) return false;
            if (def.fixed === undefined) return declare || all(def.orig, function(sym) {
                return !(sym instanceof AST_SymbolLet);
            });
            if (def.fixed === null && def.safe_ids) {
                def.safe_ids[def.id] = false;
                delete def.safe_ids;
                return true;
            }
            if (def.fixed === false) return false;
            var safe = tw.safe_ids[def.id];
            if (!HOP(tw.safe_ids, def.id)) {
                if (!safe) return false;
                if (safe.read && def.scope !== tw.find_parent(AST_Scope)) return false;
                safe.assign = safe.assign && safe.assign !== tw.safe_ids ? true : tw.safe_ids;
            }
            if (def.fixed != null && safe.read) {
                if (safe.read !== tw.safe_ids) return false;
                if (tw.loop_ids[def.id] !== tw.in_loop) return false;
            }
            return safe_to_read(tw, def) && all(def.orig, function(sym) {
                return !(sym instanceof AST_SymbolLambda);
            });
        }

        function make_ref(ref, fixed) {
            var node = make_node(AST_SymbolRef, ref, ref);
            node.fixed = fixed || make_node(AST_Undefined, ref);
            return node;
        }

        function ref_once(compressor, def) {
            return compressor.option("unused")
                && !def.scope.pinned()
                && def.single_use !== false
                && def.references.length - def.recursive_refs == 1
                && !(is_funarg(def) && def.scope.uses_arguments);
        }

        function is_immutable(value) {
            if (!value) return false;
            return value.is_constant()
                || value instanceof AST_Lambda
                || value instanceof AST_This;
        }

        function has_escaped(d, node, parent) {
            if (parent instanceof AST_Assign) return parent.operator == "=" && parent.right === node;
            if (parent instanceof AST_Call) return parent.expression !== node || parent instanceof AST_New;
            if (parent instanceof AST_Exit) return parent.value === node && node.scope !== d.scope;
            if (parent instanceof AST_VarDef) return parent.value === node;
        }

        function value_in_use(node, parent) {
            if (parent instanceof AST_Array) return true;
            if (parent instanceof AST_Binary) return lazy_op[parent.operator];
            if (parent instanceof AST_Conditional) return parent.condition !== node;
            if (parent instanceof AST_Sequence) return parent.tail_node() === node;
        }

        function mark_escaped(tw, d, scope, node, value, level, depth) {
            var parent = tw.parent(level);
            if (value && value.is_constant()) return;
            if (has_escaped(d, node, parent)) {
                d.escaped.push(parent);
                if (depth > 1 && !(value && value.is_constant_expression(scope))) depth = 1;
                if (!d.escaped.depth || d.escaped.depth > depth) d.escaped.depth = depth;
                return;
            } else if (value_in_use(node, parent)) {
                mark_escaped(tw, d, scope, parent, parent, level + 1, depth);
            } else if (parent instanceof AST_ObjectKeyVal && parent.value === node) {
                var obj = tw.parent(level + 1);
                mark_escaped(tw, d, scope, obj, obj, level + 2, depth);
            } else if (parent instanceof AST_PropAccess && parent.expression === node) {
                value = read_property(value, parent);
                mark_escaped(tw, d, scope, parent, value, level + 1, depth + 1);
                if (value) return;
            }
            if (level > 0) return;
            if (parent instanceof AST_Call && parent.expression === node) return;
            if (parent instanceof AST_Sequence && parent.tail_node() !== node) return;
            if (parent instanceof AST_SimpleStatement) return;
            if (parent instanceof AST_Unary && !unary_side_effects[parent.operator]) return;
            d.direct_access = true;
        }

        function mark_assignment_to_arguments(node) {
            if (!(node instanceof AST_Sub)) return;
            var expr = node.expression;
            if (!(expr instanceof AST_SymbolRef)) return;
            var def = expr.definition();
            if (!is_arguments(def)) return;
            var key = node.property;
            if (key.is_constant()) key = key.value;
            if (!(key instanceof AST_Node) && !/^[1-9]*[0-9]$/.test(key)) return;
            def.reassigned = true;
            (key instanceof AST_Node ? def.scope.argnames : [ def.scope.argnames[key] ]).forEach(function(argname) {
                if (argname instanceof AST_SymbolFunarg) argname.definition().fixed = false;
            });
        }

        function scan_declaration(tw, lhs, fixed, visit) {
            var scanner = new TreeWalker(function(node) {
                if (node instanceof AST_DefaultValue) {
                    reset_flags(node);
                    push(tw);
                    node.value.walk(tw);
                    pop(tw);
                    var save = fixed;
                    fixed = function() {
                        var value = save();
                        return is_undefined(value) ? make_sequence(node, [ value, node.value ]) : node.name;
                    };
                    node.name.walk(scanner);
                    fixed = save;
                    return true;
                }
                if (node instanceof AST_DestructuredArray) {
                    reset_flags(node);
                    var save = fixed;
                    node.elements.forEach(function(node, index) {
                        if (node instanceof AST_Hole) return reset_flags(node);
                        fixed = function() {
                            return make_node(AST_Sub, node, {
                                expression: save(),
                                property: make_node(AST_Number, node, {
                                    value: index
                                })
                            });
                        };
                        node.walk(scanner);
                    });
                    fixed = save;
                    return true;
                }
                if (node instanceof AST_DestructuredObject) {
                    reset_flags(node);
                    var save = fixed;
                    node.properties.forEach(function(node) {
                        reset_flags(node);
                        if (node.key instanceof AST_Node) {
                            push(tw);
                            node.key.walk(tw);
                            pop(tw);
                        }
                        fixed = function() {
                            var key = node.key;
                            var type = AST_Sub;
                            if (typeof key == "string") {
                                if (is_identifier_string(key)) {
                                    type = AST_Dot;
                                } else {
                                    key = make_node_from_constant(key, node);
                                }
                            }
                            return make_node(type, node, {
                                expression: save(),
                                property: key
                            });
                        };
                        node.value.walk(scanner);
                    });
                    fixed = save;
                    return true;
                }
                visit(node, fixed, function() {
                    var save_len = tw.stack.length;
                    for (var i = 0, len = scanner.stack.length - 1; i < len; i++) {
                        tw.stack.push(scanner.stack[i]);
                    }
                    node.walk(tw);
                    tw.stack.length = save_len;
                });
                return true;
            });
            lhs.walk(scanner);
        }

        function reduce_defun(tw, descend, compressor) {
            var id = this.name.definition().id;
            if (tw.defun_visited[id]) return true;
            if (tw.defun_ids[id] !== tw.safe_ids) return true;
            tw.defun_visited[id] = true;
            this.inlined = false;
            push(tw);
            reset_variables(tw, compressor, this);
            descend();
            pop(tw);
            walk_defuns(tw, this);
            return true;
        }

        function reduce_iife(tw, descend, compressor) {
            var fn = this;
            fn.inlined = false;
            var iife = tw.parent();
            var hit = fn instanceof AST_AsyncFunction;
            var aborts = false;
            fn.walk(new TreeWalker(function(node) {
                if (hit) return aborts = true;
                if (node instanceof AST_Return) return hit = true;
                if (node instanceof AST_Scope && node !== fn) return true;
            }));
            if (aborts) push(tw);
            reset_variables(tw, compressor, fn);
            // Virtually turn IIFE parameters into variable definitions:
            //   (function(a,b) {...})(c,d) => (function() {var a=c,b=d; ...})()
            // So existing transformation rules can work on them.
            var safe = !fn.uses_arguments || tw.has_directive("use strict");
            fn.argnames.forEach(function(arg, i) {
                var value = iife.args[i];
                scan_declaration(tw, arg, function() {
                    var j = fn.argnames.indexOf(arg);
                    return (j < 0 ? value : iife.args[j]) || make_node(AST_Undefined, iife);
                }, function(node, fixed) {
                    var d = node.definition();
                    if (safe && d.fixed === undefined) {
                        mark(tw, d);
                        tw.loop_ids[d.id] = tw.in_loop;
                        var value = iife.args[i];
                        d.fixed = fixed;
                        d.fixed.assigns = [ arg ];
                    } else {
                        d.fixed = false;
                    }
                });
            });
            if (fn instanceof AST_Arrow && fn.value) {
                fn.value.walk(tw);
            } else {
                walk_body(fn, tw);
            }
            var safe_ids = tw.safe_ids;
            pop(tw);
            walk_defuns(tw, fn);
            if (!aborts) tw.safe_ids = safe_ids;
            return true;
        }

        def(AST_Assign, function(tw, descend, compressor) {
            var node = this;
            var left = node.left;
            if (node.operator == "=" && left.equivalent_to(node.right) && !left.has_side_effects(compressor)) {
                node.right.walk(tw);
                walk_prop(left);
                node.__drop = true;
            } else if (!(left instanceof AST_Destructured || left instanceof AST_SymbolRef)) {
                mark_assignment_to_arguments(left);
                return;
            } else if (node.operator == "=") {
                node.right.walk(tw);
                scan_declaration(tw, left, function() {
                    return node.right;
                }, function(sym, fixed, walk) {
                    if (!(sym instanceof AST_SymbolRef)) {
                        mark_assignment_to_arguments(sym);
                        walk();
                        return;
                    }
                    var d = sym.definition();
                    d.assignments++;
                    if (!is_modified(compressor, tw, node, node.right, 0) && safe_to_assign(tw, d)) {
                        push_ref(d, sym);
                        mark(tw, d);
                        if (d.single_use && left instanceof AST_Destructured) d.single_use = false;
                        tw.loop_ids[d.id] = tw.in_loop;
                        mark_escaped(tw, d, sym.scope, node, node.right, 0, 1);
                        sym.fixed = d.fixed = fixed;
                        sym.fixed.assigns = [ node ];
                    } else {
                        walk();
                        d.fixed = false;
                    }
                });
            } else {
                var d = left.definition();
                d.assignments++;
                var fixed = d.fixed;
                if (is_modified(compressor, tw, node, node, 0)) {
                    d.fixed = false;
                    return;
                }
                var safe = safe_to_read(tw, d);
                node.right.walk(tw);
                if (safe && safe_to_assign(tw, d)) {
                    push_ref(d, left);
                    mark(tw, d);
                    if (d.single_use) d.single_use = false;
                    left.fixed = d.fixed = function() {
                        return make_node(AST_Binary, node, {
                            operator: node.operator.slice(0, -1),
                            left: make_ref(left, fixed),
                            right: node.right
                        });
                    };
                    left.fixed.assigns = !fixed || !fixed.assigns ? [] : fixed.assigns.slice();
                    left.fixed.assigns.push(node);
                } else {
                    left.walk(tw);
                    d.fixed = false;
                }
            }
            return true;

            function walk_prop(node) {
                if (node instanceof AST_Dot) {
                    walk_prop(node.expression);
                } else if (node instanceof AST_Sub) {
                    walk_prop(node.expression);
                    node.property.walk(tw);
                } else if (node instanceof AST_SymbolRef) {
                    var d = node.definition();
                    push_ref(d, node);
                    node.fixed = d.fixed;
                } else {
                    node.walk(tw);
                }
            }
        });
        def(AST_AsyncDefun, reduce_defun);
        def(AST_Binary, function(tw) {
            if (!lazy_op[this.operator]) return;
            this.left.walk(tw);
            push(tw);
            this.right.walk(tw);
            pop(tw);
            return true;
        });
        def(AST_BlockScope, function(tw, descend, compressor) {
            this.variables.each(function(def) {
                reset_def(tw, compressor, def);
            });
        });
        def(AST_Call, function(tw, descend) {
            tw.find_parent(AST_Scope).may_call_this();
            var exp = this.expression;
            if (is_function(exp)) {
                var iife = !exp.name;
                this.args.forEach(function(arg) {
                    arg.walk(tw);
                    if (arg instanceof AST_Spread) iife = false;
                });
                if (iife) exp.reduce_vars = reduce_iife;
                exp.walk(tw);
                if (iife) delete exp.reduce_vars;
                return true;
            } else if (exp instanceof AST_SymbolRef) {
                var def = exp.definition();
                if (this.TYPE == "Call" && tw.in_boolean_context()) def.bool_fn++;
                if (!is_defun(def.fixed)) return;
                var defun = mark_defun(tw, def);
                if (!defun) return;
                descend();
                defun.walk(tw);
                return true;
            } else if (this.TYPE == "Call"
                && exp instanceof AST_Assign
                && exp.operator == "="
                && exp.left instanceof AST_SymbolRef
                && tw.in_boolean_context()) {
                exp.left.definition().bool_fn++;
            }
        });
        def(AST_Conditional, function(tw) {
            this.condition.walk(tw);
            push(tw);
            this.consequent.walk(tw);
            pop(tw);
            push(tw);
            this.alternative.walk(tw);
            pop(tw);
            return true;
        });
        def(AST_DefaultValue, function(tw) {
            this.name.walk(tw);
            push(tw);
            this.value.walk(tw);
            pop(tw);
            return true;
        });
        def(AST_Defun, reduce_defun);
        def(AST_Do, function(tw) {
            var saved_loop = tw.in_loop;
            tw.in_loop = this;
            push(tw);
            this.body.walk(tw);
            if (has_loop_control(this, tw.parent())) {
                pop(tw);
                push(tw);
            }
            this.condition.walk(tw);
            pop(tw);
            tw.in_loop = saved_loop;
            return true;
        });
        def(AST_For, function(tw, descend, compressor) {
            this.variables.each(function(def) {
                reset_def(tw, compressor, def);
            });
            if (this.init) this.init.walk(tw);
            var saved_loop = tw.in_loop;
            tw.in_loop = this;
            push(tw);
            if (this.condition) this.condition.walk(tw);
            this.body.walk(tw);
            if (this.step) {
                if (has_loop_control(this, tw.parent())) {
                    pop(tw);
                    push(tw);
                }
                this.step.walk(tw);
            }
            pop(tw);
            tw.in_loop = saved_loop;
            return true;
        });
        def(AST_ForIn, function(tw, descend, compressor) {
            this.variables.each(function(def) {
                reset_def(tw, compressor, def);
            });
            this.object.walk(tw);
            var saved_loop = tw.in_loop;
            tw.in_loop = this;
            push(tw);
            var init = this.init;
            if (init instanceof AST_Definitions) {
                init.definitions[0].name.mark_symbol(function(node) {
                    if (node instanceof AST_SymbolDeclaration) {
                        var def = node.definition();
                        def.assignments++;
                        def.fixed = false;
                    }
                }, tw);
            } else if (init instanceof AST_Destructured || init instanceof AST_SymbolRef) {
                init.mark_symbol(function(node) {
                    if (node instanceof AST_SymbolRef) {
                        var def = node.definition();
                        push_ref(def, node);
                        def.assignments++;
                        if (!node.is_immutable()) def.fixed = false;
                    }
                }, tw);
            } else {
                init.walk(tw);
            }
            this.body.walk(tw);
            pop(tw);
            tw.in_loop = saved_loop;
            return true;
        });
        def(AST_If, function(tw) {
            this.condition.walk(tw);
            push(tw);
            this.body.walk(tw);
            pop(tw);
            if (this.alternative) {
                push(tw);
                this.alternative.walk(tw);
                pop(tw);
            }
            return true;
        });
        def(AST_LabeledStatement, function(tw) {
            push(tw);
            this.body.walk(tw);
            pop(tw);
            return true;
        });
        def(AST_Lambda, function(tw, descend, compressor) {
            var fn = this;
            fn.inlined = false;
            push(tw);
            reset_variables(tw, compressor, fn);
            descend();
            pop(tw);
            if (fn.name) mark_escaped(tw, fn.name.definition(), fn, fn.name, fn, 0, 1);
            walk_defuns(tw, fn);
            return true;
        });
        def(AST_Switch, function(tw, descend, compressor) {
            this.variables.each(function(def) {
                reset_def(tw, compressor, def);
            });
            this.expression.walk(tw);
            var first = true;
            this.body.forEach(function(branch) {
                if (branch instanceof AST_Default) return;
                branch.expression.walk(tw);
                if (first) {
                    first = false;
                    push(tw);
                }
            })
            if (!first) pop(tw);
            walk_body(this, tw);
            return true;
        });
        def(AST_SwitchBranch, function(tw) {
            push(tw);
            walk_body(this, tw);
            pop(tw);
            return true;
        });
        def(AST_SymbolCatch, function() {
            this.definition().fixed = false;
        });
        def(AST_SymbolRef, function(tw, descend, compressor) {
            var d = this.definition();
            push_ref(d, this);
            if (d.references.length == 1
                && !d.fixed
                && d.orig[0] instanceof AST_SymbolDefun) {
                tw.loop_ids[d.id] = tw.in_loop;
            }
            if (d.fixed === false) {
                var redef = d.redefined();
                if (redef && cross_scope(d.scope, this.scope)) redef.single_use = false;
            } else if (d.fixed === undefined || !safe_to_read(tw, d)) {
                d.fixed = false;
            } else if (d.fixed) {
                if (this.in_arg && d.orig[0] instanceof AST_SymbolLambda) this.fixed = d.scope;
                var value = this.fixed_value();
                var recursive = recursive_ref(tw, d);
                if (recursive) {
                    d.recursive_refs++;
                } else if (value && ref_once(compressor, d)) {
                    d.in_loop = tw.loop_ids[d.id] !== tw.in_loop;
                    d.single_use = value instanceof AST_Lambda
                            && !value.pinned()
                            && (!d.in_loop || tw.parent() instanceof AST_Call)
                        || !d.in_loop
                            && d.scope === this.scope.resolve()
                            && value.is_constant_expression();
                } else {
                    d.single_use = false;
                }
                if (is_modified(compressor, tw, this, value, 0, is_immutable(value), recursive)) {
                    if (d.single_use) {
                        d.single_use = "m";
                    } else {
                        d.fixed = false;
                    }
                }
                if (d.fixed && tw.loop_ids[d.id] !== tw.in_loop) {
                    d.cross_loop = true;
                }
                mark_escaped(tw, d, this.scope, this, value, 0, 1);
            }
            if (!this.fixed) this.fixed = d.fixed;
            var parent;
            if (is_defun(d.fixed) && !((parent = tw.parent()) instanceof AST_Call && parent.expression === this)) {
                var defun = mark_defun(tw, d);
                if (defun) defun.walk(tw);
            }
        });
        def(AST_Toplevel, function(tw, descend, compressor) {
            this.globals.each(function(def) {
                reset_def(tw, compressor, def);
            });
            push(tw);
            reset_variables(tw, compressor, this);
            descend();
            pop(tw);
            walk_defuns(tw, this);
            return true;
        });
        def(AST_Try, function(tw, descend, compressor) {
            this.variables.each(function(def) {
                reset_def(tw, compressor, def);
            });
            push(tw);
            walk_body(this, tw);
            pop(tw);
            if (this.bcatch) {
                push(tw);
                this.bcatch.walk(tw);
                pop(tw);
            }
            if (this.bfinally) this.bfinally.walk(tw);
            return true;
        });
        def(AST_Unary, function(tw, descend) {
            var node = this;
            if (!UNARY_POSTFIX[node.operator]) return;
            var exp = node.expression;
            if (!(exp instanceof AST_SymbolRef)) {
                mark_assignment_to_arguments(exp);
                return;
            }
            var d = exp.definition();
            d.assignments++;
            var fixed = d.fixed;
            if (safe_to_read(tw, d) && safe_to_assign(tw, d)) {
                push_ref(d, exp);
                mark(tw, d);
                if (d.single_use) d.single_use = false;
                d.fixed = function() {
                    return make_node(AST_Binary, node, {
                        operator: node.operator.slice(0, -1),
                        left: make_node(AST_UnaryPrefix, node, {
                            operator: "+",
                            expression: make_ref(exp, fixed)
                        }),
                        right: make_node(AST_Number, node, {
                            value: 1
                        })
                    });
                };
                d.fixed.assigns = fixed && fixed.assigns ? fixed.assigns.slice() : [];
                d.fixed.assigns.push(node);
                if (node instanceof AST_UnaryPrefix) {
                    exp.fixed = d.fixed;
                } else {
                    exp.fixed = function() {
                        return make_node(AST_UnaryPrefix, node, {
                            operator: "+",
                            expression: make_ref(exp, fixed)
                        });
                    };
                    exp.fixed.assigns = fixed && fixed.assigns;
                }
            } else {
                exp.walk(tw);
                d.fixed = false;
            }
            return true;
        });
        def(AST_VarDef, function(tw) {
            var node = this;
            if (!node.value) return;
            node.value.walk(tw);
            scan_declaration(tw, node.name, function() {
                return node.value;
            }, function(name, fixed) {
                var d = name.definition();
                if (safe_to_assign(tw, d, true)) {
                    mark(tw, d);
                    tw.loop_ids[d.id] = tw.in_loop;
                    d.fixed = fixed;
                    d.fixed.assigns = [ node ];
                    if (name instanceof AST_SymbolConst && d.redefined()
                        || !(can_drop_symbol(name) || is_safe_lexical(d))) {
                        d.single_use = false;
                    }
                } else {
                    d.fixed = false;
                }
            });
            return true;
        });
        def(AST_While, function(tw, descend) {
            var saved_loop = tw.in_loop;
            tw.in_loop = this;
            push(tw);
            descend();
            pop(tw);
            tw.in_loop = saved_loop;
            return true;
        });
    })(function(node, func) {
        node.DEFMETHOD("reduce_vars", func);
    });

    function reset_flags(node) {
        node._squeezed = false;
        node._optimized = false;
        delete node.fixed;
        if (node instanceof AST_Scope) delete node._var_names;
    }

    AST_Toplevel.DEFMETHOD("reset_opt_flags", function(compressor) {
        var tw = new TreeWalker(compressor.option("reduce_vars") ? function(node, descend) {
            reset_flags(node);
            return node.reduce_vars(tw, descend, compressor);
        } : reset_flags);
        // Flow control for visiting `AST_Defun`s
        tw.defun_ids = Object.create(null);
        tw.defun_visited = Object.create(null);
        // Record the loop body in which `AST_SymbolDeclaration` is first encountered
        tw.in_loop = null;
        tw.loop_ids = Object.create(null);
        // Stack of look-up tables to keep track of whether a `SymbolDef` has been
        // properly assigned before use:
        // - `push()` & `pop()` when visiting conditional branches
        // - backup & restore via `save_ids` when visiting out-of-order sections
        tw.safe_ids = Object.create(null);
        this.walk(tw);
    });

    AST_Symbol.DEFMETHOD("fixed_value", function() {
        var fixed = this.definition().fixed;
        if (!fixed) return fixed;
        if (this.fixed) fixed = this.fixed;
        return fixed instanceof AST_Node ? fixed : fixed();
    });

    AST_SymbolRef.DEFMETHOD("is_immutable", function() {
        var def = this.definition();
        if (def.orig.length != 1) return false;
        var sym = def.orig[0];
        return sym instanceof AST_SymbolLambda && def.scope.name === sym;
    });

    AST_Node.DEFMETHOD("convert_symbol", noop);
    AST_Destructured.DEFMETHOD("convert_symbol", function(type, process) {
        return this.transform(new TreeTransformer(function(node, descend) {
            if (node instanceof AST_DefaultValue) {
                node = node.clone();
                node.name = node.name.transform(this);
                return node;
            }
            if (node instanceof AST_Destructured) {
                node = node.clone();
                descend(node, this);
                return node;
            }
            if (node instanceof AST_DestructuredKeyVal) {
                node = node.clone();
                node.value = node.value.transform(this);
                return node;
            }
            return node.convert_symbol(type, process);
        }));
    });
    function convert_symbol(type, process) {
        var node = make_node(type, this, this);
        process(node, this);
        return node;
    }
    AST_SymbolDeclaration.DEFMETHOD("convert_symbol", convert_symbol);
    AST_SymbolRef.DEFMETHOD("convert_symbol", convert_symbol);

    function mark_destructured(process, tw) {
        var marker = new TreeWalker(function(node) {
            if (node instanceof AST_DefaultValue) {
                node.value.walk(tw);
                node.name.walk(marker);
                return true;
            }
            if (node instanceof AST_DestructuredKeyVal) {
                if (node.key instanceof AST_Node) node.key.walk(tw);
                node.value.walk(marker);
                return true;
            }
            return process(node);
        });
        this.walk(marker);
    }
    AST_DefaultValue.DEFMETHOD("mark_symbol", mark_destructured);
    AST_Destructured.DEFMETHOD("mark_symbol", mark_destructured);
    function mark_symbol(process) {
        return process(this);
    }
    AST_SymbolDeclaration.DEFMETHOD("mark_symbol", mark_symbol);
    AST_SymbolRef.DEFMETHOD("mark_symbol", mark_symbol);

    AST_Node.DEFMETHOD("match_symbol", function(predicate) {
        return predicate(this);
    });
    AST_Destructured.DEFMETHOD("match_symbol", function(predicate, ignore_side_effects) {
        var found = false;
        var tw = new TreeWalker(function(node) {
            if (found) return true;
            if (node instanceof AST_DefaultValue) {
                if (!ignore_side_effects) return found = true;
                node.name.walk(tw);
                return true;
            }
            if (node instanceof AST_DestructuredKeyVal) {
                if (!ignore_side_effects && node.key instanceof AST_Node) return found = true;
                node.value.walk(tw);
                return true;
            }
            if (predicate(node)) return found = true;
        });
        this.walk(tw);
        return found;
    });

    function find_scope(compressor) {
        var level = 0, node;
        while (node = compressor.parent(level++)) {
            if (node.variables) return node;
        }
    }

    function is_lhs_read_only(lhs, compressor) {
        if (lhs instanceof AST_This) return true;
        if (lhs instanceof AST_SymbolRef) {
            var def = lhs.definition();
            return def.lambda || compressor.exposed(def) && identifier_atom[def.name];
        }
        if (lhs instanceof AST_PropAccess) {
            lhs = lhs.expression;
            if (lhs instanceof AST_SymbolRef) {
                if (lhs.is_immutable()) return false;
                lhs = lhs.fixed_value();
            }
            if (!lhs) return true;
            if (lhs.is_constant()) return true;
            return is_lhs_read_only(lhs, compressor);
        }
        return false;
    }

    function make_node(ctor, orig, props) {
        if (!props) props = {};
        if (orig) {
            if (!props.start) props.start = orig.start;
            if (!props.end) props.end = orig.end;
        }
        return new ctor(props);
    }

    function make_sequence(orig, expressions) {
        if (expressions.length == 1) return expressions[0];
        return make_node(AST_Sequence, orig, {
            expressions: expressions.reduce(merge_sequence, [])
        });
    }

    function make_node_from_constant(val, orig) {
        switch (typeof val) {
          case "string":
            return make_node(AST_String, orig, {
                value: val
            });
          case "number":
            if (isNaN(val)) return make_node(AST_NaN, orig);
            if (isFinite(val)) {
                return 1 / val < 0 ? make_node(AST_UnaryPrefix, orig, {
                    operator: "-",
                    expression: make_node(AST_Number, orig, { value: -val })
                }) : make_node(AST_Number, orig, { value: val });
            }
            return val < 0 ? make_node(AST_UnaryPrefix, orig, {
                operator: "-",
                expression: make_node(AST_Infinity, orig)
            }) : make_node(AST_Infinity, orig);
          case "boolean":
            return make_node(val ? AST_True : AST_False, orig);
          case "undefined":
            return make_node(AST_Undefined, orig);
          default:
            if (val === null) {
                return make_node(AST_Null, orig, { value: null });
            }
            if (val instanceof RegExp) {
                return make_node(AST_RegExp, orig, { value: val });
            }
            throw new Error(string_template("Can't handle constant of type: {type}", {
                type: typeof val
            }));
        }
    }

    function needs_unbinding(compressor, val) {
        return val instanceof AST_PropAccess
            || is_undeclared_ref(val) && val.name == "eval";
    }

    // we shouldn't compress (1,func)(something) to
    // func(something) because that changes the meaning of
    // the func (becomes lexical instead of global).
    function maintain_this_binding(compressor, parent, orig, val) {
        var wrap = false;
        if (parent.TYPE == "Call") {
            wrap = parent.expression === orig && needs_unbinding(compressor, val);
        } else if (parent instanceof AST_UnaryPrefix) {
            wrap = parent.operator == "delete"
                || parent.operator == "typeof" && is_undeclared_ref(val);
        }
        return wrap ? make_sequence(orig, [ make_node(AST_Number, orig, { value: 0 }), val ]) : val;
    }

    function merge_sequence(array, node) {
        if (node instanceof AST_Sequence) {
            array.push.apply(array, node.expressions);
        } else {
            array.push(node);
        }
        return array;
    }

    function as_statement_array(thing) {
        if (thing === null) return [];
        if (thing instanceof AST_BlockStatement) return all(thing.body, function(stat) {
            return !(stat instanceof AST_Const || stat instanceof AST_Let);
        }) ? thing.body : [ thing ];
        if (thing instanceof AST_EmptyStatement) return [];
        if (thing instanceof AST_Statement) return [ thing ];
        throw new Error("Can't convert thing to statement array");
    }

    function is_empty(thing) {
        if (thing === null) return true;
        if (thing instanceof AST_EmptyStatement) return true;
        if (thing instanceof AST_BlockStatement) return thing.body.length == 0;
        return false;
    }

    function has_declarations_only(block) {
        return all(block.body, function(stat) {
            return is_empty(stat)
                || stat instanceof AST_Defun
                || stat instanceof AST_Var && all(stat.definitions, function(var_def) {
                    return !var_def.value;
                });
        });
    }

    function loop_body(x) {
        if (x instanceof AST_IterationStatement) {
            return x.body instanceof AST_BlockStatement ? x.body : x;
        }
        return x;
    }

    function root_expr(prop) {
        while (prop instanceof AST_PropAccess) prop = prop.expression;
        return prop;
    }

    function is_iife_call(node) {
        if (node.TYPE != "Call") return false;
        var exp = node.expression;
        return exp instanceof AST_AsyncFunction || exp instanceof AST_Function || is_iife_call(exp);
    }

    function is_undeclared_ref(node) {
        return node instanceof AST_SymbolRef && node.definition().undeclared;
    }

    function get_rvalue(expr) {
        return expr[expr instanceof AST_Assign ? "right" : "value"];
    }

    var global_names = makePredicate("Array Boolean clearInterval clearTimeout console Date decodeURI decodeURIComponent encodeURI encodeURIComponent Error escape eval EvalError Function isFinite isNaN JSON Math Number parseFloat parseInt RangeError ReferenceError RegExp Object setInterval setTimeout String SyntaxError TypeError unescape URIError");
    AST_SymbolRef.DEFMETHOD("is_declared", function(compressor) {
        return this.defined
            || !this.definition().undeclared
            || compressor.option("unsafe") && global_names[this.name];
    });

    var identifier_atom = makePredicate("Infinity NaN undefined");
    function is_identifier_atom(node) {
        return node instanceof AST_Infinity
            || node instanceof AST_NaN
            || node instanceof AST_Undefined;
    }

    function declarations_only(node) {
        return all(node.definitions, function(var_def) {
            return !var_def.value;
        });
    }

    function is_declaration(stat) {
        return stat instanceof AST_Defun || stat instanceof AST_Var && declarations_only(stat);
    }

    function tighten_body(statements, compressor) {
        var in_loop, in_try, scope;
        find_loop_scope_try();
        var CHANGED, max_iter = 10;
        do {
            CHANGED = false;
            eliminate_spurious_blocks(statements);
            if (compressor.option("dead_code")) {
                eliminate_dead_code(statements, compressor);
            }
            if (compressor.option("if_return")) {
                handle_if_return(statements, compressor);
            }
            if (compressor.sequences_limit > 0) {
                sequencesize(statements, compressor);
                sequencesize_2(statements, compressor);
            }
            if (compressor.option("join_vars")) {
                join_consecutive_vars(statements);
            }
            if (compressor.option("collapse_vars")) {
                collapse(statements, compressor);
            }
        } while (CHANGED && max_iter-- > 0);
        return statements;

        function find_loop_scope_try() {
            var node = compressor.self(), level = 0;
            do {
                if (node instanceof AST_Catch) {
                    if (!compressor.parent(level).bfinally) level++;
                } else if (node instanceof AST_Finally) {
                    level++;
                } else if (node instanceof AST_IterationStatement) {
                    in_loop = true;
                } else if (node instanceof AST_Scope) {
                    scope = node;
                    break;
                } else if (node instanceof AST_Try) {
                    if (!in_try) in_try = node;
                }
            } while (node = compressor.parent(level++));
        }

        // Search from right to left for assignment-like expressions:
        // - `var a = x;`
        // - `a = x;`
        // - `++a`
        // For each candidate, scan from left to right for first usage, then try
        // to fold assignment into the site for compression.
        // Will not attempt to collapse assignments into or past code blocks
        // which are not sequentially executed, e.g. loops and conditionals.
        function collapse(statements, compressor) {
            if (scope.pinned()) return statements;
            var args;
            var assignments = Object.create(null);
            var candidates = [];
            var declare_only = Object.create(null);
            var force_single;
            var stat_index = statements.length;
            var scanner = new TreeTransformer(function(node, descend) {
                if (abort) return node;
                // Skip nodes before `candidate` as quickly as possible
                if (!hit) {
                    if (node !== hit_stack[hit_index]) return node;
                    hit_index++;
                    if (hit_index < hit_stack.length) return handle_custom_scan_order(node, scanner);
                    hit = true;
                    stop_after = (value_def ? find_stop_value : find_stop)(node, 0);
                    if (stop_after === node) abort = true;
                    return node;
                }
                // Stop immediately if these node types are encountered
                var parent = scanner.parent();
                if (should_stop(node, parent)) {
                    abort = true;
                    return node;
                }
                // Stop only if candidate is found within conditional branches
                if (!stop_if_hit && in_conditional(node, parent)) {
                    stop_if_hit = parent;
                }
                // Skip transient nodes caused by single-use variable replacement
                if (node.single_use && parent instanceof AST_VarDef && parent.value === node) return node;
                // Replace variable with assignment when found
                var hit_rhs;
                if (!(node instanceof AST_SymbolDeclaration)
                    && (scan_lhs && lhs.equivalent_to(node)
                        || scan_rhs && (hit_rhs = scan_rhs(node, this)))) {
                    if (!can_replace || stop_if_hit && (hit_rhs || !lhs_local || !replace_all)) {
                        if (!hit_rhs && !value_def) abort = true;
                        return node;
                    }
                    if (is_lhs(node, parent)) {
                        if (value_def && !hit_rhs) {
                            assign_used = true;
                            replaced++;
                        }
                        return node;
                    } else if (value_def) {
                        if (!hit_rhs) replaced++;
                        return node;
                    } else {
                        replaced++;
                    }
                    CHANGED = abort = true;
                    AST_Node.info("Collapsing {node} [{file}:{line},{col}]", {
                        node: node,
                        file: node.start.file,
                        line: node.start.line,
                        col: node.start.col,
                    });
                    if (candidate instanceof AST_UnaryPostfix) {
                        if (lhs instanceof AST_SymbolRef) lhs.definition().fixed = false;
                        return make_node(AST_UnaryPrefix, candidate, candidate);
                    }
                    if (candidate instanceof AST_VarDef) {
                        var def = candidate.name.definition();
                        if (def.references.length - def.replaced == 1 && !compressor.exposed(def)) {
                            def.replaced++;
                            return maintain_this_binding(compressor, parent, node, candidate.value);
                        }
                        return make_node(AST_Assign, candidate, {
                            operator: "=",
                            left: make_node(AST_SymbolRef, candidate.name, candidate.name),
                            right: candidate.value
                        });
                    }
                    candidate.write_only = false;
                    return candidate;
                }
                // These node types have child nodes that execute sequentially,
                // but are otherwise not safe to scan into or beyond them.
                if (is_last_node(node, parent) || may_throw(node)) {
                    stop_after = node;
                    if (node instanceof AST_Scope) abort = true;
                }
                // Scan but don't replace inside getter/setter
                if (node instanceof AST_Accessor) {
                    var replace = can_replace;
                    can_replace = false;
                    descend(node, scanner);
                    can_replace = replace;
                    return signal_abort(node);
                }
                // Scan but don't replace inside destructuring expression
                if (node instanceof AST_Destructured) {
                    var replace = can_replace;
                    can_replace = false;
                    descend(node, scanner);
                    can_replace = replace;
                    return signal_abort(node);
                }
                // Scan but don't replace inside default value
                if (node instanceof AST_DefaultValue) {
                    node.name = node.name.transform(scanner);
                    var replace = can_replace;
                    can_replace = false;
                    node.value = node.value.transform(scanner);
                    can_replace = replace;
                    return signal_abort(node);
                }
                return handle_custom_scan_order(node, scanner);
            }, signal_abort);
            var multi_replacer = new TreeTransformer(function(node) {
                if (abort) return node;
                // Skip nodes before `candidate` as quickly as possible
                if (!hit) {
                    if (node !== hit_stack[hit_index]) return node;
                    hit_index++;
                    switch (hit_stack.length - hit_index) {
                      case 0:
                        hit = true;
                        if (assign_used) return node;
                        if (node instanceof AST_VarDef) return node;
                        def.replaced++;
                        var parent = multi_replacer.parent();
                        if (parent instanceof AST_Sequence && parent.tail_node() !== node) {
                            value_def.replaced++;
                            return List.skip;
                        }
                        return rvalue;
                      case 1:
                        if (!assign_used && node.body === candidate) {
                            hit = true;
                            def.replaced++;
                            value_def.replaced++;
                            return null;
                        }
                      default:
                        return;
                    }
                }
                // Replace variable when found
                if (node instanceof AST_SymbolRef
                    && node.name == def.name) {
                    if (!--replaced) abort = true;
                    if (is_lhs(node, multi_replacer.parent())) return node;
                    def.replaced++;
                    var ref = rvalue.clone();
                    value_def.references.push(ref);
                    return ref;
                }
                // Skip (non-executed) functions and (leading) default case in switch statements
                if (node instanceof AST_Default || node instanceof AST_Scope) return node;
            }, patch_sequence);
            while (--stat_index >= 0) {
                // Treat parameters as collapsible in IIFE, i.e.
                //   function(a, b){ ... }(x());
                // would be translated into equivalent assignments:
                //   var a = x(), b = undefined;
                if (stat_index == 0 && compressor.option("unused")) extract_args();
                // Find collapsible assignments
                var hit_stack = [];
                extract_candidates(statements[stat_index]);
                while (candidates.length > 0) {
                    hit_stack = candidates.pop();
                    var hit_index = 0;
                    var candidate = hit_stack[hit_stack.length - 1];
                    var value_def = null;
                    var stop_after = null;
                    var stop_if_hit = null;
                    var lhs = get_lhs(candidate);
                    var side_effects = lhs && lhs.has_side_effects(compressor);
                    var scan_lhs = lhs && !side_effects && !is_lhs_read_only(lhs, compressor);
                    var scan_rhs = foldable(candidate);
                    if (!scan_lhs && !scan_rhs) continue;
                    var funarg = candidate.name instanceof AST_SymbolFunarg;
                    var may_throw = return_false;
                    if (candidate.may_throw(compressor)) {
                        if (funarg && scope instanceof AST_AsyncFunction) continue;
                        may_throw = in_try ? function(node) {
                            return node.has_side_effects(compressor);
                        } : side_effects_external;
                    }
                    var read_toplevel = false;
                    var modify_toplevel = false;
                    // Locate symbols which may execute code outside of scanning range
                    var lvalues = get_lvalues(candidate);
                    var lhs_local = is_lhs_local(lhs);
                    var rvalue = get_rvalue(candidate);
                    if (!side_effects) side_effects = value_has_side_effects();
                    var replace_all = replace_all_symbols(candidate);
                    var hit = funarg;
                    var abort = false;
                    var replaced = 0;
                    var assign_used = false;
                    var can_replace = !args || !hit;
                    if (!can_replace) {
                        for (var j = candidate.arg_index + 1; !abort && j < args.length; j++) {
                            if (args[j]) args[j].transform(scanner);
                        }
                        can_replace = true;
                    }
                    for (var i = stat_index; !abort && i < statements.length; i++) {
                        statements[i].transform(scanner);
                    }
                    if (value_def) {
                        var def = lhs.definition();
                        var referenced = def.references.length - def.replaced;
                        if (candidate instanceof AST_Assign) referenced--;
                        if (replaced && referenced == replaced) {
                            abort = false;
                        } else {
                            candidates.push(hit_stack);
                            force_single = true;
                            continue;
                        }
                        if (replaced) {
                            hit_index = 0;
                            hit = funarg;
                            for (var i = stat_index; !abort && i < statements.length; i++) {
                                if (!statements[i].transform(multi_replacer)) statements.splice(i--, 1);
                            }
                            if (candidate instanceof AST_VarDef) {
                                replaced = !compressor.exposed(def) && def.references.length == def.replaced;
                            }
                            value_def.single_use = false;
                        }
                    }
                    if (replaced && !remove_candidate(candidate)) statements.splice(stat_index, 1);
                }
            }

            function signal_abort(node) {
                if (abort) return node;
                if (stop_after === node) abort = true;
                if (stop_if_hit === node) stop_if_hit = null;
                return node;
            }

            function handle_custom_scan_order(node, tt) {
                if (!(node instanceof AST_BlockScope)) return;
                // Skip (non-executed) functions
                if (node instanceof AST_Scope) return node;
                // Stop upon collision with block-scoped variables
                if (!(node.variables && node.variables.all(function(def) {
                    return !lvalues.has(def.name);
                }))) {
                    abort = true;
                    return node;
                }
                // Scan object only in a for-in statement
                if (node instanceof AST_ForIn) {
                    node.object = node.object.transform(tt);
                    abort = true;
                    return node;
                }
                // Scan first case expression only in a switch statement
                if (node instanceof AST_Switch) {
                    node.expression = node.expression.transform(tt);
                    for (var i = 0; !abort && i < node.body.length; i++) {
                        var branch = node.body[i];
                        if (branch instanceof AST_Case) {
                            if (!hit) {
                                if (branch !== hit_stack[hit_index]) continue;
                                hit_index++;
                            }
                            branch.expression = branch.expression.transform(tt);
                            if (!replace_all) break;
                            scan_rhs = false;
                        }
                    }
                    abort = true;
                    return node;
                }
            }

            function is_direct_assignment(node, parent) {
                if (parent instanceof AST_Assign) return parent.operator == "=" && parent.left === node;
                if (parent instanceof AST_DefaultValue) return parent.name === node;
                if (parent instanceof AST_DestructuredArray) return true;
                if (parent instanceof AST_DestructuredKeyVal) return parent.value === node;
            }

            function should_stop(node, parent) {
                if (node === rvalue) return true;
                if (parent instanceof AST_For) return node !== parent.init;
                if (node instanceof AST_Assign) {
                    return node.operator != "=" && lhs.equivalent_to(node.left);
                }
                if (node instanceof AST_Call) {
                    if (!(lhs instanceof AST_PropAccess)) return false;
                    if (!lhs.equivalent_to(node.expression)) return false;
                    return !(rvalue instanceof AST_Function && !rvalue.contains_this());
                }
                if (node instanceof AST_Debugger) return true;
                if (node instanceof AST_Defun) return funarg && lhs.name === node.name.name;
                if (node instanceof AST_Destructured) return (in_try || !lhs_local) && parent instanceof AST_Assign;
                if (node instanceof AST_DestructuredKeyVal) return node.key instanceof AST_Node;
                if (node instanceof AST_DWLoop) return true;
                if (node instanceof AST_LoopControl) return true;
                if (node instanceof AST_SymbolRef) {
                    if (node.is_declared(compressor)) {
                        if (node.fixed_value()) return false;
                        if (can_drop_symbol(node)) {
                            return !(parent instanceof AST_PropAccess && parent.expression === node)
                                && is_arguments(node.definition());
                        }
                    } else if (is_direct_assignment(node, parent)) {
                        return false;
                    }
                    if (!replace_all) return true;
                    scan_rhs = false;
                    return false;
                }
                if (node instanceof AST_Try) return true;
                if (node instanceof AST_With) return true;
                return false;
            }

            function in_conditional(node, parent) {
                if (parent instanceof AST_Binary) return lazy_op[parent.operator] && parent.left !== node;
                if (parent instanceof AST_Case) return parent.expression !== node;
                if (parent instanceof AST_Conditional) return parent.condition !== node;
                return parent instanceof AST_If && parent.condition !== node;
            }

            function is_last_node(node, parent) {
                if (node instanceof AST_Await) return true;
                if (node.TYPE == "Binary") return node.operator == "in" && !is_object(node.right);
                if (node instanceof AST_Call) {
                    var def, fn = node.expression;
                    if (fn instanceof AST_SymbolRef) {
                        def = fn.definition();
                        fn = fn.fixed_value();
                    }
                    if (!(fn instanceof AST_Lambda)) return true;
                    if (def && recursive_ref(compressor, def)) return true;
                    if (fn.collapse_scanning) return false;
                    fn.collapse_scanning = true;
                    var replace = can_replace;
                    can_replace = false;
                    var after = stop_after;
                    var if_hit = stop_if_hit;
                    if (!all(fn.argnames, function(argname) {
                        if (argname instanceof AST_DefaultValue) {
                            argname.value.transform(scanner);
                            if (abort) return false;
                            argname = argname.name;
                        }
                        return !(argname instanceof AST_Destructured);
                    })) {
                        abort = true;
                    } else if (fn instanceof AST_Arrow && fn.value) {
                        fn.value.transform(scanner);
                    } else for (var i = 0; !abort && i < fn.body.length; i++) {
                        var stat = fn.body[i];
                        if (stat instanceof AST_Return) {
                            if (stat.value) stat.value.transform(scanner);
                            break;
                        }
                        stat.transform(scanner);
                    }
                    stop_if_hit = if_hit;
                    stop_after = after;
                    can_replace = replace;
                    delete fn.collapse_scanning;
                    if (!abort) return false;
                    abort = false;
                    return true;
                }
                if (node instanceof AST_Exit) {
                    if (in_try) {
                        if (in_try.bfinally) return true;
                        if (in_try.bcatch && node instanceof AST_Throw) return true;
                    }
                    return side_effects || lhs instanceof AST_PropAccess || may_modify(lhs);
                }
                if (node instanceof AST_Function) {
                    return compressor.option("ie8") && node.name && lvalues.has(node.name.name);
                }
                if (node instanceof AST_PropAccess) {
                    var exp = node.expression;
                    return side_effects || !value_def && exp.may_throw_on_access(compressor)
                        || exp instanceof AST_SymbolRef && is_arguments(exp.definition());
                }
                if (node instanceof AST_Spread) return true;
                if (node instanceof AST_SymbolRef) {
                    if (symbol_in_lvalues(node, parent)) return !is_direct_assignment(node, parent);
                    if (side_effects && may_modify(node)) return true;
                    var def = node.definition();
                    return (in_try || def.scope.resolve() !== scope) && !can_drop_symbol(node);
                }
                if (node instanceof AST_This) return symbol_in_lvalues(node, parent);
                if (node instanceof AST_VarDef) {
                    if ((in_try || !lhs_local) && node.name instanceof AST_Destructured) return true;
                    return (node.value || parent instanceof AST_Let) && node.name.match_symbol(function(node) {
                        return node instanceof AST_SymbolDeclaration
                            && (lvalues.has(node.name) || side_effects && may_modify(node));
                    }, true);
                }
                var sym = is_lhs(node.left, node);
                if (!sym) return false;
                if (sym instanceof AST_PropAccess) return true;
                if ((in_try || !lhs_local) && sym instanceof AST_Destructured) return true;
                return sym.match_symbol(function(node) {
                    return node instanceof AST_SymbolRef
                        && (lvalues.has(node.name) || read_toplevel && compressor.exposed(node.definition()));
                }, true);
            }

            function extract_args() {
                var iife, fn = compressor.self();
                if (is_function(fn)
                    && !fn.name
                    && !fn.uses_arguments
                    && !fn.pinned()
                    && (iife = compressor.parent()) instanceof AST_Call
                    && iife.expression === fn
                    && all(iife.args, function(arg) {
                        return !(arg instanceof AST_Spread);
                    })) {
                    var fn_strict = compressor.has_directive("use strict");
                    if (fn_strict && !member(fn_strict, fn.body)) fn_strict = false;
                    var has_await = fn instanceof AST_AsyncFunction ? function(node) {
                        return node instanceof AST_Symbol && node.name == "await";
                    } : function(node) {
                        return node instanceof AST_Await && !tw.find_parent(AST_Scope);
                    };
                    var tw = new TreeWalker(function(node) {
                        if (!arg) return true;
                        if (has_await(node)) {
                            arg = null;
                            return true;
                        }
                        if (node instanceof AST_SymbolRef && fn.variables.has(node.name)) {
                            var s = node.definition().scope;
                            if (s !== scope) while (s = s.parent_scope) {
                                if (s === scope) return true;
                            }
                            arg = null;
                        }
                        if (node instanceof AST_This && (fn_strict || !tw.find_parent(AST_Scope))) {
                            arg = null;
                            return true;
                        }
                    });
                    args = iife.args.slice();
                    var names = Object.create(null);
                    for (var i = fn.argnames.length; --i >= 0;) {
                        var sym = fn.argnames[i];
                        var arg = iife.args[i];
                        var value;
                        if (sym instanceof AST_DefaultValue) {
                            value = sym.value;
                            sym = sym.name;
                            args[iife.args.length + i] = value;
                        }
                        if (sym instanceof AST_Destructured) {
                            if (!sym.match_symbol(return_false)) continue;
                            candidates.length = 0;
                            break;
                        }
                        if (sym.name in names) continue;
                        names[sym.name] = true;
                        if (value) arg = !arg || is_undefined(arg) ? value : null;
                        if (!arg && !value) {
                            arg = make_node(AST_Undefined, sym).transform(compressor);
                        } else if (arg instanceof AST_Lambda && arg.pinned()) {
                            arg = null;
                        } else if (arg) {
                            arg.walk(tw);
                        }
                        if (!arg) continue;
                        var candidate = make_node(AST_VarDef, sym, {
                            name: sym,
                            value: arg
                        });
                        candidate.name_index = i;
                        candidate.arg_index = value ? iife.args.length + i : i;
                        candidates.unshift([ candidate ]);
                    }
                }
            }

            function extract_candidates(expr) {
                hit_stack.push(expr);
                if (expr instanceof AST_Array) {
                    expr.elements.forEach(extract_candidates);
                } else if (expr instanceof AST_Assign) {
                    if (!(expr.left instanceof AST_Destructured)) candidates.push(hit_stack.slice());
                    extract_candidates(expr.left);
                    extract_candidates(expr.right);
                    if (expr.left instanceof AST_SymbolRef) {
                        assignments[expr.left.name] = (assignments[expr.left.name] || 0) + 1;
                    }
                } else if (expr instanceof AST_Await) {
                    extract_candidates(expr.expression);
                } else if (expr instanceof AST_Binary) {
                    extract_candidates(expr.left);
                    extract_candidates(expr.right);
                } else if (expr instanceof AST_Call) {
                    extract_candidates(expr.expression);
                    expr.args.forEach(extract_candidates);
                } else if (expr instanceof AST_Case) {
                    extract_candidates(expr.expression);
                } else if (expr instanceof AST_Conditional) {
                    extract_candidates(expr.condition);
                    extract_candidates(expr.consequent);
                    extract_candidates(expr.alternative);
                } else if (expr instanceof AST_Definitions) {
                    expr.definitions.forEach(extract_candidates);
                } else if (expr instanceof AST_Dot) {
                    extract_candidates(expr.expression);
                } else if (expr instanceof AST_DWLoop) {
                    extract_candidates(expr.condition);
                    if (!(expr.body instanceof AST_Block)) {
                        extract_candidates(expr.body);
                    }
                } else if (expr instanceof AST_Exit) {
                    if (expr.value) extract_candidates(expr.value);
                } else if (expr instanceof AST_For) {
                    if (expr.init) extract_candidates(expr.init);
                    if (expr.condition) extract_candidates(expr.condition);
                    if (expr.step) extract_candidates(expr.step);
                    if (!(expr.body instanceof AST_Block)) {
                        extract_candidates(expr.body);
                    }
                } else if (expr instanceof AST_ForIn) {
                    extract_candidates(expr.object);
                    if (!(expr.body instanceof AST_Block)) {
                        extract_candidates(expr.body);
                    }
                } else if (expr instanceof AST_If) {
                    extract_candidates(expr.condition);
                    if (!(expr.body instanceof AST_Block)) {
                        extract_candidates(expr.body);
                    }
                    if (expr.alternative && !(expr.alternative instanceof AST_Block)) {
                        extract_candidates(expr.alternative);
                    }
                } else if (expr instanceof AST_Object) {
                    expr.properties.forEach(function(prop) {
                        hit_stack.push(prop);
                        if (prop.key instanceof AST_Node) extract_candidates(prop.key);
                        if (prop instanceof AST_ObjectKeyVal) extract_candidates(prop.value);
                        hit_stack.pop();
                    });
                } else if (expr instanceof AST_Sequence) {
                    expr.expressions.forEach(extract_candidates);
                } else if (expr instanceof AST_SimpleStatement) {
                    extract_candidates(expr.body);
                } else if (expr instanceof AST_Spread) {
                    extract_candidates(expr.expression);
                } else if (expr instanceof AST_Sub) {
                    extract_candidates(expr.expression);
                    extract_candidates(expr.property);
                } else if (expr instanceof AST_Switch) {
                    extract_candidates(expr.expression);
                    expr.body.forEach(extract_candidates);
                } else if (expr instanceof AST_Unary) {
                    if (UNARY_POSTFIX[expr.operator]) {
                        candidates.push(hit_stack.slice());
                    } else {
                        extract_candidates(expr.expression);
                    }
                } else if (expr instanceof AST_VarDef) {
                    if (expr.name instanceof AST_SymbolVar) {
                        if (expr.value) {
                            var def = expr.name.definition();
                            if (def.references.length > def.replaced) {
                                candidates.push(hit_stack.slice());
                            }
                        } else {
                            declare_only[expr.name.name] = (declare_only[expr.name.name] || 0) + 1;
                        }
                    }
                    if (expr.value) extract_candidates(expr.value);
                }
                hit_stack.pop();
            }

            function find_stop(node, level) {
                var parent = scanner.parent(level);
                if (parent instanceof AST_Array) return node;
                if (parent instanceof AST_Assign) return node;
                if (parent instanceof AST_Await) return node;
                if (parent instanceof AST_Binary) return node;
                if (parent instanceof AST_Call) return node;
                if (parent instanceof AST_Case) return node;
                if (parent instanceof AST_Conditional) return node;
                if (parent instanceof AST_Definitions) return find_stop_unused(parent, level + 1);
                if (parent instanceof AST_Exit) return node;
                if (parent instanceof AST_If) return node;
                if (parent instanceof AST_IterationStatement) return node;
                if (parent instanceof AST_ObjectProperty) return node;
                if (parent instanceof AST_PropAccess) return node;
                if (parent instanceof AST_Sequence) {
                    return (parent.tail_node() === node ? find_stop : find_stop_unused)(parent, level + 1);
                }
                if (parent instanceof AST_SimpleStatement) return find_stop_unused(parent, level + 1);
                if (parent instanceof AST_Spread) return node;
                if (parent instanceof AST_Switch) return node;
                if (parent instanceof AST_Unary) return node;
                if (parent instanceof AST_VarDef) return node;
                return null;
            }

            function find_stop_value(node, level) {
                var parent = scanner.parent(level);
                if (parent instanceof AST_Array) return find_stop_value(parent, level + 1);
                if (parent instanceof AST_Assign) return may_throw(parent) || parent.left.match_symbol(function(ref) {
                    return ref instanceof AST_SymbolRef && (lhs.name == ref.name || value_def.name == ref.name);
                }) ? node : find_stop_value(parent, level + 1);
                if (parent instanceof AST_Binary) {
                    if (lazy_op[parent.operator] && parent.left !== node) {
                        do {
                            node = parent;
                            parent = scanner.parent(++level);
                        } while (parent instanceof AST_Binary && parent.operator == node.operator);
                        return node;
                    }
                    return find_stop_value(parent, level + 1);
                }
                if (parent instanceof AST_Call) return parent;
                if (parent instanceof AST_Case) {
                    if (parent.expression !== node) return node;
                    return find_stop_value(parent, level + 1);
                }
                if (parent instanceof AST_Conditional) {
                    if (parent.condition !== node) return node;
                    return find_stop_value(parent, level + 1);
                }
                if (parent instanceof AST_Definitions) return find_stop_unused(parent, level + 1);
                if (parent instanceof AST_Do) return node;
                if (parent instanceof AST_Exit) return find_stop_unused(parent, level + 1);
                if (parent instanceof AST_For) {
                    if (parent.init !== node && parent.condition !== node) return node;
                    return find_stop_value(parent, level + 1);
                }
                if (parent instanceof AST_ForIn) {
                    if (parent.init !== node) return node;
                    return find_stop_value(parent, level + 1);
                }
                if (parent instanceof AST_If) {
                    if (parent.condition !== node) return node;
                    return find_stop_value(parent, level + 1);
                }
                if (parent instanceof AST_ObjectProperty) {
                    var obj = scanner.parent(level + 1);
                    return all(obj.properties, function(prop) {
                        return prop instanceof AST_ObjectKeyVal;
                    }) ? find_stop_value(obj, level + 2) : obj;
                }
                if (parent instanceof AST_PropAccess) return find_stop_value(parent, level + 1);
                if (parent instanceof AST_Sequence) {
                    return (parent.tail_node() === node ? find_stop_value : find_stop_unused)(parent, level + 1);
                }
                if (parent instanceof AST_SimpleStatement) return find_stop_unused(parent, level + 1);
                if (parent instanceof AST_Spread) return find_stop_value(parent, level + 1);
                if (parent instanceof AST_Switch) {
                    if (parent.expression !== node) return node;
                    return find_stop_value(parent, level + 1);
                }
                if (parent instanceof AST_Unary) {
                    if (parent.operator == "delete") return node;
                    return find_stop_value(parent, level + 1);
                }
                if (parent instanceof AST_VarDef) return parent.name.match_symbol(function(sym) {
                    return sym instanceof AST_SymbolDeclaration && (lhs.name == sym.name || value_def.name == sym.name);
                }) ? node : find_stop_value(parent, level + 1);
                if (parent instanceof AST_While) {
                    if (parent.condition !== node) return node;
                    return find_stop_value(parent, level + 1);
                }
                return null;
            }

            function find_stop_unused(node, level) {
                var parent = scanner.parent(level);
                if (is_last_node(node, parent)) return node;
                if (in_conditional(node, parent)) return node;
                if (parent instanceof AST_Array) return find_stop_unused(parent, level + 1);
                if (parent instanceof AST_Assign) return check_assignment(parent.left);
                if (parent instanceof AST_Await) return node;
                if (parent instanceof AST_Binary) return find_stop_unused(parent, level + 1);
                if (parent instanceof AST_Call) return find_stop_unused(parent, level + 1);
                if (parent instanceof AST_Case) return find_stop_unused(parent, level + 1);
                if (parent instanceof AST_Conditional) return find_stop_unused(parent, level + 1);
                if (parent instanceof AST_Definitions) return find_stop_unused(parent, level + 1);
                if (parent instanceof AST_Exit) return find_stop_unused(parent, level + 1);
                if (parent instanceof AST_If) return find_stop_unused(parent, level + 1);
                if (parent instanceof AST_IterationStatement) return node;
                if (parent instanceof AST_ObjectProperty) {
                    var obj = scanner.parent(level + 1);
                    return all(obj.properties, function(prop) {
                        return prop instanceof AST_ObjectKeyVal;
                    }) ? find_stop_unused(obj, level + 2) : obj;
                }
                if (parent instanceof AST_PropAccess) {
                    var exp = parent.expression;
                    if (exp === node) return find_stop_unused(parent, level + 1);
                    var sym = root_expr(exp);
                    if (!(sym instanceof AST_SymbolRef)) return find_stop_unused(parent, level + 1);
                    var lvalue = lvalues.get(sym.name);
                    return !lvalue || all(lvalue, function(lhs) {
                        return !(lhs instanceof AST_PropAccess);
                    }) ? find_stop_unused(parent, level + 1) : node;
                }
                if (parent instanceof AST_Sequence) return find_stop_unused(parent, level + 1);
                if (parent instanceof AST_SimpleStatement) return find_stop_unused(parent, level + 1);
                if (parent instanceof AST_Spread) return node;
                if (parent instanceof AST_Switch) return find_stop_unused(parent, level + 1);
                if (parent instanceof AST_Unary) return find_stop_unused(parent, level + 1);
                if (parent instanceof AST_VarDef) return check_assignment(parent.name);
                return null;

                function check_assignment(lhs) {
                    if (may_throw(parent)) return node;
                    if (lhs !== node && lhs instanceof AST_Destructured) {
                        var replace = can_replace;
                        can_replace = false;
                        var after = stop_after;
                        var if_hit = stop_if_hit;
                        lhs.transform(scanner);
                        stop_if_hit = if_hit;
                        stop_after = after;
                        can_replace = replace;
                        if (abort) {
                            abort = false;
                            return node;
                        }
                    }
                    return find_stop_unused(parent, level + 1);
                }
            }

            function mangleable_var(value) {
                if (force_single) {
                    force_single = false;
                    return;
                }
                if (!(value instanceof AST_SymbolRef)) return;
                var def = value.definition();
                if (def.undeclared) return;
                if (is_arguments(def)) return;
                return value_def = def;
            }

            function get_lhs(expr) {
                if (expr instanceof AST_VarDef) {
                    var def = expr.name.definition();
                    if (def.const_redefs) return;
                    if (!member(expr.name, def.orig)) return;
                    var declared = def.orig.length - def.eliminated - (declare_only[def.name] || 0);
                    var referenced = def.references.length - def.replaced - (assignments[def.name] || 0);
                    if (declared > 1 && !(expr.name instanceof AST_SymbolFunarg)) {
                        mangleable_var(expr.value);
                        return make_node(AST_SymbolRef, expr.name, expr.name);
                    }
                    if (mangleable_var(expr.value) || referenced == 1 && !compressor.exposed(def)) {
                        return make_node(AST_SymbolRef, expr.name, expr.name);
                    }
                } else if (expr instanceof AST_Assign) {
                    var def, lhs = expr.left;
                    if (expr.operator == "="
                        && lhs instanceof AST_SymbolRef
                        && (def = lhs.definition()).references[0] === lhs
                        && !compressor.exposed(def)) {
                        var referenced = def.references.length - def.replaced;
                        if (referenced > 1) mangleable_var(expr.right);
                    }
                    return lhs;
                } else {
                    return expr.expression;
                }
            }

            function invariant(expr) {
                if (expr instanceof AST_Array) return false;
                if (expr instanceof AST_Binary && lazy_op[expr.operator]) {
                    return invariant(expr.left) && invariant(expr.right);
                }
                if (expr instanceof AST_Call) return false;
                if (expr instanceof AST_Conditional) {
                    return invariant(expr.consequent) && invariant(expr.alternative);
                }
                if (expr instanceof AST_Object) return false;
                return !expr.has_side_effects(compressor);
            }

            function foldable(expr) {
                if (expr instanceof AST_Assign && expr.right.single_use) return;
                var lhs_ids = Object.create(null);
                var marker = new TreeWalker(function(node) {
                    if (node instanceof AST_SymbolRef) lhs_ids[node.definition().id] = true;
                });
                while (expr instanceof AST_Assign && expr.operator == "=") {
                    expr.left.walk(marker);
                    expr = expr.right;
                }
                if (expr instanceof AST_SymbolRef) {
                    var value = expr.evaluate(compressor);
                    if (value === expr) return rhs_exact_match;
                    return rhs_fuzzy_match(value, rhs_exact_match);
                }
                if (expr instanceof AST_This) return rhs_exact_match;
                if (expr.is_truthy()) return rhs_fuzzy_match(true, return_false);
                if (expr.is_constant()) {
                    return rhs_fuzzy_match(expr.evaluate(compressor), rhs_exact_match);
                }
                if (!(lhs instanceof AST_SymbolRef)) return false;
                if (!invariant(expr)) return false;
                var circular;
                expr.walk(new TreeWalker(function(node) {
                    if (circular) return true;
                    if (node instanceof AST_SymbolRef && lhs_ids[node.definition().id]) circular = true;
                }));
                return !circular && rhs_exact_match;

                function rhs_exact_match(node) {
                    return expr.equivalent_to(node);
                }
            }

            function rhs_fuzzy_match(value, fallback) {
                return function(node, tw) {
                    if (tw.in_boolean_context()) {
                        if (value && node.is_truthy() && !node.has_side_effects(compressor)) {
                            return true;
                        }
                        if (node.is_constant()) {
                            return !node.evaluate(compressor) == !value;
                        }
                    }
                    return fallback(node);
                };
            }

            function may_be_global(node) {
                if (node instanceof AST_SymbolRef) {
                    node = node.fixed_value();
                    if (!node) return true;
                }
                if (node instanceof AST_Assign) return node.operator == "=" && may_be_global(node.right);
                return node instanceof AST_PropAccess || node instanceof AST_This;
            }

            function get_lvalues(expr) {
                var lvalues = new Dictionary();
                if (expr instanceof AST_VarDef) lvalues.add(expr.name.name, lhs);
                var find_arguments = scope.uses_arguments && !compressor.has_directive("use strict");
                var scan_toplevel = scope instanceof AST_Toplevel;
                var tw = new TreeWalker(function(node) {
                    var value;
                    if (node instanceof AST_SymbolRef) {
                        value = node.fixed_value() || node;
                    } else if (node instanceof AST_This) {
                        value = node;
                    }
                    if (value) lvalues.add(node.name, is_modified(compressor, tw, node, value, 0));
                    if (find_arguments && node instanceof AST_Sub) {
                        scope.each_argname(function(argname) {
                            if (!compressor.option("reduce_vars") || argname.definition().assignments) {
                                lvalues.add(argname.name, true);
                            }
                        });
                        find_arguments = false;
                    }
                    if (!scan_toplevel) return;
                    if (node.TYPE == "Call") {
                        if (modify_toplevel) return;
                        var exp = node.expression;
                        if (exp instanceof AST_PropAccess) return;
                        if (exp instanceof AST_Function && !exp.contains_this()) return;
                        modify_toplevel = true;
                    } else if (node instanceof AST_PropAccess && may_be_global(node.expression)) {
                        if (node === lhs && !(expr instanceof AST_Unary)) {
                            modify_toplevel = true;
                        } else {
                            read_toplevel = true;
                        }
                    }
                });
                expr.walk(tw);
                return lvalues;
            }

            function remove_candidate(expr) {
                var index = expr.name_index;
                if (index >= 0) {
                    var argname = scope.argnames[index];
                    if (argname instanceof AST_DefaultValue) {
                        argname.value = make_node(AST_Number, argname, {
                            value: 0
                        });
                        argname.name.definition().fixed = false;
                    } else {
                        var args = compressor.parent().args;
                        if (args[index]) {
                            args[index] = make_node(AST_Number, args[index], {
                                value: 0
                            });
                            argname.definition().fixed = false;
                        }
                    }
                    return true;
                }
                var end = hit_stack.length - 1;
                if (hit_stack[end - 1].body === hit_stack[end]) end--;
                var tt = new TreeTransformer(function(node, descend, in_list) {
                    if (hit) return node;
                    if (node !== hit_stack[hit_index]) return node;
                    hit_index++;
                    if (hit_index <= end) return handle_custom_scan_order(node, tt);
                    hit = true;
                    if (node instanceof AST_VarDef) {
                        node.value = null;
                        declare_only[node.name.name] = (declare_only[node.name.name] || 0) + 1;
                        if (value_def) value_def.replaced++;
                        return node;
                    }
                    return in_list ? List.skip : null;
                }, patch_sequence);
                abort = false;
                hit = false;
                hit_index = 0;
                return statements[stat_index].transform(tt);
            }

            function patch_sequence(node) {
                if (node instanceof AST_Sequence) switch (node.expressions.length) {
                    case 0: return null;
                    case 1: return node.expressions[0];
                }
            }

            function is_lhs_local(lhs) {
                var sym = root_expr(lhs);
                return sym instanceof AST_SymbolRef
                    && sym.definition().scope === scope
                    && !(in_loop
                        && (lvalues.has(sym.name) && lvalues.get(sym.name)[0] !== lhs
                            || candidate instanceof AST_Unary
                            || candidate instanceof AST_Assign && candidate.operator != "="));
            }

            function value_has_side_effects() {
                if (candidate instanceof AST_Unary) return false;
                return rvalue.has_side_effects(compressor);
            }

            function replace_all_symbols(expr) {
                if (expr instanceof AST_Unary) return false;
                if (side_effects) return false;
                if (value_def) return true;
                if (!(lhs instanceof AST_SymbolRef)) return false;
                var referenced;
                if (expr instanceof AST_VarDef) {
                    referenced = 1;
                } else if (expr.operator == "=") {
                    referenced = 2;
                } else {
                    return false;
                }
                var def = lhs.definition();
                return def.references.length - def.replaced == referenced;
            }

            function symbol_in_lvalues(sym, parent) {
                var lvalue = lvalues.get(sym.name);
                if (!lvalue || all(lvalue, function(lhs) {
                    return !lhs;
                })) return;
                if (lvalue[0] !== lhs) return true;
                scan_rhs = false;
            }

            function may_modify(sym) {
                var def = sym.definition();
                if (def.orig.length == 1 && def.orig[0] instanceof AST_SymbolDefun) return false;
                if (def.scope !== scope) return true;
                if (modify_toplevel && compressor.exposed(def)) return true;
                return !all(def.references, function(ref) {
                    return ref.scope.resolve() === scope;
                });
            }

            function side_effects_external(node, lhs) {
                if (node instanceof AST_Assign) return side_effects_external(node.left, true);
                if (node instanceof AST_Unary) return side_effects_external(node.expression, true);
                if (node instanceof AST_VarDef) return node.value && side_effects_external(node.value);
                if (lhs) {
                    if (node instanceof AST_Dot) return side_effects_external(node.expression, true);
                    if (node instanceof AST_Sub) return side_effects_external(node.expression, true);
                    if (node instanceof AST_SymbolRef) return node.definition().scope !== scope;
                }
                return false;
            }
        }

        function eliminate_spurious_blocks(statements) {
            var seen_dirs = [];
            for (var i = 0; i < statements.length;) {
                var stat = statements[i];
                if (stat instanceof AST_BlockStatement) {
                    if (all(stat.body, function(stat) {
                        return !(stat instanceof AST_Const || stat instanceof AST_Let);
                    })) {
                        CHANGED = true;
                        eliminate_spurious_blocks(stat.body);
                        [].splice.apply(statements, [i, 1].concat(stat.body));
                        i += stat.body.length;
                        continue;
                    }
                }
                if (stat instanceof AST_Directive) {
                    if (member(stat.value, seen_dirs)) {
                        CHANGED = true;
                        statements.splice(i, 1);
                        continue;
                    }
                    seen_dirs.push(stat.value);
                }
                if (stat instanceof AST_EmptyStatement) {
                    CHANGED = true;
                    statements.splice(i, 1);
                    continue;
                }
                i++;
            }
        }

        function handle_if_return(statements, compressor) {
            var self = compressor.self();
            var parent = compressor.parent();
            var in_lambda = last_of(function(node) {
                return node instanceof AST_Lambda;
            });
            var in_iife = in_lambda && parent && parent.TYPE == "Call";
            var multiple_if_returns = has_multiple_if_returns(statements);
            for (var i = statements.length; --i >= 0;) {
                var stat = statements[i];
                var j = next_index(i);
                var next = statements[j];

                if (in_lambda && !next && stat instanceof AST_Return) {
                    if (!stat.value) {
                        CHANGED = true;
                        statements.splice(i, 1);
                        continue;
                    }
                    if (stat.value instanceof AST_UnaryPrefix && stat.value.operator == "void") {
                        CHANGED = true;
                        statements[i] = make_node(AST_SimpleStatement, stat, {
                            body: stat.value.expression
                        });
                        continue;
                    }
                }

                if (stat instanceof AST_If) {
                    var ab = aborts(stat.body);
                    if (can_merge_flow(ab)) {
                        if (ab.label) remove(ab.label.thedef.references, ab);
                        CHANGED = true;
                        stat = stat.clone();
                        stat.condition = stat.condition.negate(compressor);
                        var body = as_statement_array_with_return(stat.body, ab);
                        stat.body = make_node(AST_BlockStatement, stat, {
                            body: as_statement_array(stat.alternative).concat(extract_functions())
                        });
                        stat.alternative = make_node(AST_BlockStatement, stat, {
                            body: body
                        });
                        statements[i] = stat;
                        statements[i] = stat.transform(compressor);
                        continue;
                    }

                    if (ab && !stat.alternative && stat.body instanceof AST_BlockStatement && next instanceof AST_Jump) {
                        var negated = stat.condition.negate(compressor);
                        if (negated.print_to_string().length <= stat.condition.print_to_string().length) {
                            CHANGED = true;
                            stat = stat.clone();
                            stat.condition = negated;
                            statements[j] = stat.body;
                            stat.body = next;
                            statements[i] = stat;
                            statements[i] = stat.transform(compressor);
                            continue;
                        }
                    }

                    var alt = aborts(stat.alternative);
                    if (can_merge_flow(alt)) {
                        if (alt.label) remove(alt.label.thedef.references, alt);
                        CHANGED = true;
                        stat = stat.clone();
                        stat.body = make_node(AST_BlockStatement, stat.body, {
                            body: as_statement_array(stat.body).concat(extract_functions())
                        });
                        var body = as_statement_array_with_return(stat.alternative, alt);
                        stat.alternative = make_node(AST_BlockStatement, stat.alternative, {
                            body: body
                        });
                        statements[i] = stat;
                        statements[i] = stat.transform(compressor);
                        continue;
                    }

                    if (compressor.option("typeofs")) {
                        if (ab && !alt) {
                            mark_locally_defined(stat.condition, null, make_node(AST_BlockStatement, self, {
                                body: statements.slice(i + 1)
                            }));
                        }
                        if (!ab && alt) {
                            mark_locally_defined(stat.condition, make_node(AST_BlockStatement, self, {
                                body: statements.slice(i + 1)
                            }));
                        }
                    }
                }

                if (stat instanceof AST_If && stat.body instanceof AST_Return) {
                    var value = stat.body.value;
                    var in_bool = stat.body.in_bool || next instanceof AST_Return && next.in_bool;
                    //---
                    // pretty silly case, but:
                    // if (foo()) return; return; => foo(); return;
                    if (!value && !stat.alternative
                        && (in_lambda && !next || next instanceof AST_Return && !next.value)) {
                        CHANGED = true;
                        statements[i] = make_node(AST_SimpleStatement, stat.condition, {
                            body: stat.condition
                        });
                        continue;
                    }
                    //---
                    // if (foo()) return x; return y; => return foo() ? x : y;
                    if (!stat.alternative && next instanceof AST_Return) {
                        CHANGED = true;
                        stat = stat.clone();
                        stat.alternative = next;
                        statements.splice(i, 1, stat.transform(compressor));
                        statements.splice(j, 1);
                        continue;
                    }
                    //---
                    // if (foo()) return x; [ return ; ] => return foo() ? x : undefined;
                    if (!stat.alternative && !next && in_lambda && (in_bool || value && multiple_if_returns)) {
                        CHANGED = true;
                        stat = stat.clone();
                        stat.alternative = make_node(AST_Return, stat, {
                            value: null
                        });
                        statements.splice(i, 1, stat.transform(compressor));
                        continue;
                    }
                    //---
                    // if (a) return b; if (c) return d; e; => return a ? b : c ? d : void e;
                    //
                    // if sequences is not enabled, this can lead to an endless loop (issue #866).
                    // however, with sequences on this helps producing slightly better output for
                    // the example code.
                    var prev = statements[prev_index(i)];
                    if (compressor.option("sequences") && in_lambda && !stat.alternative
                        && (!prev && in_iife || prev instanceof AST_If && prev.body instanceof AST_Return)
                        && next_index(j) == statements.length && next instanceof AST_SimpleStatement) {
                        CHANGED = true;
                        stat = stat.clone();
                        stat.alternative = make_node(AST_BlockStatement, next, {
                            body: [
                                next,
                                make_node(AST_Return, next, {
                                    value: null
                                })
                            ]
                        });
                        statements.splice(i, 1, stat.transform(compressor));
                        statements.splice(j, 1);
                        continue;
                    }
                }
            }

            function has_multiple_if_returns(statements) {
                var n = 0;
                for (var i = statements.length; --i >= 0;) {
                    var stat = statements[i];
                    if (stat instanceof AST_If && stat.body instanceof AST_Return) {
                        if (++n > 1) return true;
                    }
                }
                return false;
            }

            function is_return_void(value) {
                return !value || value instanceof AST_UnaryPrefix && value.operator == "void";
            }

            function is_last_statement(body, stat) {
                var index = body.lastIndexOf(stat);
                if (index < 0) return false;
                while (++index < body.length) {
                    if (!is_declaration(body[index])) return false;
                }
                return true;
            }

            function last_of(predicate) {
                var block = self, stat, level = 0;
                do {
                    do {
                        if (predicate(block)) return true;
                        block = compressor.parent(level++);
                    } while (block instanceof AST_If && (stat = block));
                } while ((block instanceof AST_BlockStatement || block instanceof AST_Scope)
                    && is_last_statement(block.body, stat));
            }

            function match_target(target) {
                return last_of(function(node) {
                    return node === target;
                });
            }

            function can_merge_flow(ab) {
                if (ab instanceof AST_Return) return in_lambda && is_return_void(ab.value);
                if (!(ab instanceof AST_LoopControl)) return false;
                var lct = compressor.loopcontrol_target(ab);
                if (ab instanceof AST_Continue) return match_target(loop_body(lct));
                if (lct instanceof AST_IterationStatement) return false;
                return match_target(lct);
            }

            function extract_functions() {
                var tail = statements.slice(i + 1);
                statements.length = i + 1;
                return tail.filter(function(stat) {
                    if (stat instanceof AST_Defun) {
                        statements.push(stat);
                        return false;
                    }
                    return true;
                });
            }

            function as_statement_array_with_return(node, ab) {
                var body = as_statement_array(node);
                var block = body, last;
                while ((last = block[block.length - 1]) !== ab) {
                    block = last.body;
                }
                block.pop();
                if (ab.value) block.push(make_node(AST_SimpleStatement, ab.value, {
                    body: ab.value.expression
                }));
                return body;
            }

            function next_index(i) {
                for (var j = i + 1; j < statements.length; j++) {
                    if (!is_declaration(statements[j])) break;
                }
                return j;
            }

            function prev_index(i) {
                for (var j = i; --j >= 0;) {
                    if (!is_declaration(statements[j])) break;
                }
                return j;
            }
        }

        function eliminate_dead_code(statements, compressor) {
            var has_quit;
            var self = compressor.self();
            for (var i = 0, n = 0, len = statements.length; i < len; i++) {
                var stat = statements[i];
                if (stat instanceof AST_LoopControl) {
                    var lct = compressor.loopcontrol_target(stat);
                    if (stat instanceof AST_Break
                            && !(lct instanceof AST_IterationStatement)
                            && loop_body(lct) === self
                        || stat instanceof AST_Continue
                            && loop_body(lct) === self) {
                        if (stat.label) remove(stat.label.thedef.references, stat);
                    } else {
                        statements[n++] = stat;
                    }
                } else {
                    statements[n++] = stat;
                }
                if (aborts(stat)) {
                    has_quit = statements.slice(i + 1);
                    break;
                }
            }
            statements.length = n;
            CHANGED = n != len;
            if (has_quit) has_quit.forEach(function(stat) {
                extract_declarations_from_unreachable_code(compressor, stat, statements);
            });
        }

        function sequencesize(statements, compressor) {
            if (statements.length < 2) return;
            var seq = [], n = 0;
            function push_seq() {
                if (!seq.length) return;
                var body = make_sequence(seq[0], seq);
                statements[n++] = make_node(AST_SimpleStatement, body, { body: body });
                seq = [];
            }
            for (var i = 0, len = statements.length; i < len; i++) {
                var stat = statements[i];
                if (stat instanceof AST_SimpleStatement) {
                    if (seq.length >= compressor.sequences_limit) push_seq();
                    var body = stat.body;
                    if (seq.length > 0) body = body.drop_side_effect_free(compressor);
                    if (body) merge_sequence(seq, body);
                } else if (is_declaration(stat)) {
                    statements[n++] = stat;
                } else {
                    push_seq();
                    statements[n++] = stat;
                }
            }
            push_seq();
            statements.length = n;
            if (n != len) CHANGED = true;
        }

        function to_simple_statement(block, decls) {
            if (!(block instanceof AST_BlockStatement)) return block;
            var stat = null;
            for (var i = 0; i < block.body.length; i++) {
                var line = block.body[i];
                if (line instanceof AST_Var && declarations_only(line)) {
                    decls.push(line);
                } else if (stat || line instanceof AST_Const || line instanceof AST_Let) {
                    return false;
                } else {
                    stat = line;
                }
            }
            return stat;
        }

        function sequencesize_2(statements, compressor) {
            function cons_seq(right) {
                n--;
                CHANGED = true;
                var left = prev.body;
                return make_sequence(left, [ left, right ]);
            }
            var n = 0, prev;
            for (var i = 0; i < statements.length; i++) {
                var stat = statements[i];
                if (prev) {
                    if (stat instanceof AST_Exit) {
                        stat.value = cons_seq(stat.value || make_node(AST_Undefined, stat)).transform(compressor);
                    } else if (stat instanceof AST_For) {
                        if (!(stat.init instanceof AST_Definitions)) {
                            var abort = false;
                            prev.body.walk(new TreeWalker(function(node) {
                                if (abort || node instanceof AST_Scope) return true;
                                if (node instanceof AST_Binary && node.operator == "in") {
                                    abort = true;
                                    return true;
                                }
                            }));
                            if (!abort) {
                                if (stat.init) stat.init = cons_seq(stat.init);
                                else {
                                    stat.init = prev.body;
                                    n--;
                                    CHANGED = true;
                                }
                            }
                        }
                    } else if (stat instanceof AST_ForIn) {
                        stat.object = cons_seq(stat.object);
                    } else if (stat instanceof AST_If) {
                        stat.condition = cons_seq(stat.condition);
                    } else if (stat instanceof AST_Switch) {
                        stat.expression = cons_seq(stat.expression);
                    } else if (stat instanceof AST_With) {
                        stat.expression = cons_seq(stat.expression);
                    }
                }
                if (compressor.option("conditionals") && stat instanceof AST_If) {
                    var decls = [];
                    var body = to_simple_statement(stat.body, decls);
                    var alt = to_simple_statement(stat.alternative, decls);
                    if (body !== false && alt !== false && decls.length > 0) {
                        var len = decls.length;
                        decls.push(make_node(AST_If, stat, {
                            condition: stat.condition,
                            body: body || make_node(AST_EmptyStatement, stat.body),
                            alternative: alt
                        }));
                        decls.unshift(n, 1);
                        [].splice.apply(statements, decls);
                        i += len;
                        n += len + 1;
                        prev = null;
                        CHANGED = true;
                        continue;
                    }
                }
                statements[n++] = stat;
                prev = stat instanceof AST_SimpleStatement ? stat : null;
            }
            statements.length = n;
        }

        function join_assigns(defn, body, keep) {
            var exprs;
            if (body instanceof AST_Assign) {
                exprs = [ body ];
            } else if (body instanceof AST_Sequence) {
                exprs = body.expressions.slice();
            }
            if (!exprs) return;
            var trimmed = false;
            for (var i = exprs.length - 1; --i >= 0;) {
                var expr = exprs[i];
                if (!(expr instanceof AST_Assign)) continue;
                if (expr.operator != "=") continue;
                if (!(expr.left instanceof AST_SymbolRef)) continue;
                var tail = exprs.slice(i + 1);
                if (!trim_assigns(expr.left, expr.right, tail)) continue;
                trimmed = true;
                exprs = exprs.slice(0, i + 1).concat(tail);
            }
            if (defn instanceof AST_Definitions) {
                keep = keep || 0;
                for (var i = defn.definitions.length; --i >= 0;) {
                    var def = defn.definitions[i];
                    if (!def.value) continue;
                    if (trim_assigns(def.name, def.value, exprs)) trimmed = true;
                    if (merge_conditional_assignments(def, exprs, keep)) trimmed = true;
                    break;
                }
                if (defn instanceof AST_Var && join_var_assign(defn.definitions, exprs, keep)) trimmed = true;
            }
            return trimmed && exprs;
        }

        function merge_conditional_assignments(var_def, exprs, keep) {
            if (!compressor.option("conditionals")) return;
            if (var_def.name instanceof AST_Destructured) return;
            var trimmed = false;
            var def = var_def.name.definition();
            while (exprs.length > keep) {
                var cond = to_conditional_assignment(compressor, def, var_def.value, exprs[0]);
                if (!cond) break;
                var_def.value = cond;
                exprs.shift();
                trimmed = true;
            }
            return trimmed;
        }

        function join_var_assign(definitions, exprs, keep) {
            var trimmed = false;
            while (exprs.length > keep) {
                var expr = exprs[0];
                if (!(expr instanceof AST_Assign)) break;
                if (expr.operator != "=") break;
                var lhs = expr.left;
                if (!(lhs instanceof AST_SymbolRef)) break;
                if (is_undeclared_ref(lhs)) break;
                if (lhs.scope.resolve() !== scope) break;
                var def = lhs.definition();
                if (def.scope !== scope) break;
                if (def.orig.length > def.eliminated + 1) break;
                if (def.orig[0].TYPE != "SymbolVar") break;
                var name = make_node(AST_SymbolVar, lhs, lhs);
                definitions.push(make_node(AST_VarDef, expr, {
                    name: name,
                    value: expr.right
                }));
                def.orig.push(name);
                def.replaced++;
                exprs.shift();
                trimmed = true;
            }
            return trimmed;
        }

        function trim_assigns(name, value, exprs) {
            if (!(value instanceof AST_Object)) return;
            var trimmed = false;
            do {
                var node = exprs[0];
                if (!(node instanceof AST_Assign)) break;
                if (node.operator != "=") break;
                if (!(node.left instanceof AST_PropAccess)) break;
                var sym = node.left.expression;
                if (!(sym instanceof AST_SymbolRef)) break;
                if (name.name != sym.name) break;
                if (!node.right.is_constant_expression(scope)) break;
                var prop = node.left.property;
                if (prop instanceof AST_Node) {
                    prop = prop.evaluate(compressor);
                }
                if (prop instanceof AST_Node) break;
                prop = "" + prop;
                var diff = prop == "__proto__" || compressor.has_directive("use strict") ? function(node) {
                    return typeof node.key == "string" && node.key != prop;
                } : function(node) {
                    if (node instanceof AST_ObjectGetter || node instanceof AST_ObjectSetter) {
                        return typeof node.key == "string" && node.key != prop;
                    }
                    return true;
                };
                if (!all(value.properties, diff)) break;
                value.properties.push(make_node(AST_ObjectKeyVal, node, {
                    key: prop,
                    value: node.right
                }));
                exprs.shift();
                trimmed = true;
            } while (exprs.length);
            return trimmed;
        }

        function join_consecutive_vars(statements) {
            var defs;
            for (var i = 0, j = -1; i < statements.length; i++) {
                var stat = statements[i];
                var prev = statements[j];
                if (stat instanceof AST_Definitions) {
                    if (prev && prev.TYPE == stat.TYPE) {
                        prev.definitions = prev.definitions.concat(stat.definitions);
                        CHANGED = true;
                    } else if (defs && defs.TYPE == stat.TYPE && declarations_only(stat)) {
                        defs.definitions = defs.definitions.concat(stat.definitions);
                        CHANGED = true;
                    } else {
                        statements[++j] = stat;
                        if (stat instanceof AST_Var) defs = stat;
                    }
                    continue;
                } else if (stat instanceof AST_Exit) {
                    stat.value = join_assigns_expr(stat.value);
                } else if (stat instanceof AST_For) {
                    var exprs = join_assigns(prev, stat.init);
                    if (exprs) {
                        CHANGED = true;
                        stat.init = exprs.length ? make_sequence(stat.init, exprs) : null;
                    } else if (prev instanceof AST_Var && (!stat.init || stat.init.TYPE == prev.TYPE)) {
                        if (stat.init) {
                            prev.definitions = prev.definitions.concat(stat.init.definitions);
                        }
                        defs = stat.init = prev;
                        statements[j] = merge_defns(stat);
                        CHANGED = true;
                        continue;
                    } else if (defs && stat.init && defs.TYPE == stat.init.TYPE && declarations_only(stat.init)) {
                        defs.definitions = defs.definitions.concat(stat.init.definitions);
                        stat.init = null;
                        CHANGED = true;
                    } else if (stat.init instanceof AST_Var) {
                        defs = stat.init;
                    }
                } else if (stat instanceof AST_ForIn) {
                    if (defs && defs.TYPE == stat.init.TYPE) {
                        var defns = defs.definitions.slice();
                        stat.init = stat.init.definitions[0].name.convert_symbol(AST_SymbolRef, function(ref, name) {
                            defns.push(make_node(AST_VarDef, name, {
                                name: name,
                                value: null
                            }));
                            name.definition().references.push(ref);
                        });
                        defs.definitions = defns;
                        CHANGED = true;
                    }
                    stat.object = join_assigns_expr(stat.object);
                } else if (stat instanceof AST_If) {
                    stat.condition = join_assigns_expr(stat.condition);
                } else if (stat instanceof AST_SimpleStatement) {
                    var exprs = join_assigns(prev, stat.body);
                    if (exprs) {
                        CHANGED = true;
                        if (!exprs.length) continue;
                        stat.body = make_sequence(stat.body, exprs);
                    }
                } else if (stat instanceof AST_Switch) {
                    stat.expression = join_assigns_expr(stat.expression);
                } else if (stat instanceof AST_With) {
                    stat.expression = join_assigns_expr(stat.expression);
                }
                statements[++j] = defs ? merge_defns(stat) : stat;
            }
            statements.length = j + 1;

            function join_assigns_expr(value) {
                var exprs = join_assigns(prev, value, 1);
                if (!exprs) return value;
                CHANGED = true;
                var tail = value.tail_node();
                if (exprs[exprs.length - 1] !== tail) exprs.push(tail.left);
                return make_sequence(value, exprs);
            }

            function merge_defns(stat) {
                return stat.transform(new TreeTransformer(function(node, descend, in_list) {
                    if (node instanceof AST_Definitions) {
                        if (defs === node) return node;
                        if (defs.TYPE != node.TYPE) return node;
                        var parent = this.parent();
                        if (parent instanceof AST_ForIn && parent.init === node) return node;
                        if (!declarations_only(node)) return node;
                        defs.definitions = defs.definitions.concat(node.definitions);
                        CHANGED = true;
                        if (parent instanceof AST_For && parent.init === node) return null;
                        return in_list ? List.skip : make_node(AST_EmptyStatement, node);
                    }
                    if (node instanceof AST_Scope) return node;
                    if (!(node instanceof AST_Statement)) return node;
                }));
            }
        }
    }

    function extract_declarations_from_unreachable_code(compressor, stat, target) {
        if (!(stat instanceof AST_Definitions || is_defun(stat))) {
            AST_Node.warn("Dropping unreachable code [{file}:{line},{col}]", stat.start);
        }
        var block;
        stat.walk(new TreeWalker(function(node, descend) {
            if (node instanceof AST_Definitions) {
                var defns = [];
                if (node.remove_initializers(compressor, defns)) {
                    AST_Node.warn("Dropping initialization in unreachable code [{file}:{line},{col}]", node.start);
                }
                if (defns.length > 0) {
                    node.definitions = defns;
                    push(node);
                }
                return true;
            }
            if (is_defun(node)) {
                push(node);
                return true;
            }
            if (node instanceof AST_Scope) return true;
            if (node instanceof AST_BlockScope) {
                var save = block;
                block = [];
                descend();
                if (block.required) {
                    target.push(make_node(AST_BlockStatement, stat, {
                        body: block
                    }));
                } else if (block.length) {
                    [].push.apply(target, block);
                }
                block = save;
                return true;
            }
        }));
        function push(node) {
            if (block) {
                block.push(node);
                if (node instanceof AST_Const || node instanceof AST_Let) block.required = true;
            } else {
                target.push(node);
            }
        }
    }

    function is_undefined(node, compressor) {
        return node.is_undefined
            || node instanceof AST_Undefined
            || node instanceof AST_UnaryPrefix
                && node.operator == "void"
                && !(compressor && node.expression.has_side_effects(compressor));
    }

    // is_truthy()
    // return true if `!!node === true`
    (function(def) {
        def(AST_Node, return_false);
        def(AST_Array, return_true);
        def(AST_Assign, function() {
            return this.operator == "=" && this.right.is_truthy();
        });
        def(AST_Lambda, return_true);
        def(AST_Object, return_true);
        def(AST_RegExp, return_true);
        def(AST_Sequence, function() {
            return this.tail_node().is_truthy();
        });
        def(AST_SymbolRef, function() {
            var fixed = this.fixed_value();
            if (!fixed) return false;
            this.is_truthy = return_false;
            var result = fixed.is_truthy();
            delete this.is_truthy;
            return result;
        });
    })(function(node, func) {
        node.DEFMETHOD("is_truthy", func);
    });

    // is_negative_zero()
    // return true if the node may represent -0
    (function(def) {
        def(AST_Node, return_true);
        def(AST_Array, return_false);
        function binary(op, left, right) {
            switch (op) {
              case "-":
                return left.is_negative_zero()
                    && (!(right instanceof AST_Constant) || right.value == 0);
              case "&&":
              case "||":
                return left.is_negative_zero() || right.is_negative_zero();
              case "*":
              case "/":
              case "%":
                return true;
              default:
                return false;
            }
        }
        def(AST_Assign, function() {
            var op = this.operator;
            if (op == "=") return this.right.is_negative_zero();
            return binary(op.slice(0, -1), this.left, this.right);
        });
        def(AST_Binary, function() {
            return binary(this.operator, this.left, this.right);
        });
        def(AST_Constant, function() {
            return this.value == 0 && 1 / this.value < 0;
        });
        def(AST_Lambda, return_false);
        def(AST_Object, return_false);
        def(AST_RegExp, return_false);
        def(AST_Sequence, function() {
            return this.tail_node().is_negative_zero();
        });
        def(AST_SymbolRef, function() {
            var fixed = this.fixed_value();
            if (!fixed) return true;
            this.is_negative_zero = return_true;
            var result = fixed.is_negative_zero();
            delete this.is_negative_zero;
            return result;
        });
        def(AST_UnaryPrefix, function() {
            return this.operator == "+" && this.expression.is_negative_zero()
                || this.operator == "-";
        });
    })(function(node, func) {
        node.DEFMETHOD("is_negative_zero", func);
    });

    // may_throw_on_access()
    // returns true if this node may be null, undefined or contain `AST_Accessor`
    (function(def) {
        AST_Node.DEFMETHOD("may_throw_on_access", function(compressor) {
            return !compressor.option("pure_getters") || this._dot_throw(compressor);
        });
        function is_strict(compressor) {
            return /strict/.test(compressor.option("pure_getters"));
        }
        def(AST_Node, is_strict);
        def(AST_Array, return_false);
        def(AST_Assign, function(compressor) {
            if (this.operator != "=") return false;
            var rhs = this.right;
            if (!rhs._dot_throw(compressor)) return false;
            var sym = this.left;
            if (!(sym instanceof AST_SymbolRef)) return true;
            if (rhs instanceof AST_Binary && rhs.operator == "||" && sym.name == rhs.left.name) {
                return rhs.right._dot_throw(compressor);
            }
            return true;
        });
        def(AST_Binary, function(compressor) {
            switch (this.operator) {
              case "&&":
                return this.left._dot_throw(compressor) || this.right._dot_throw(compressor);
              case "||":
                return this.right._dot_throw(compressor);
              default:
                return false;
            }
        });
        def(AST_Conditional, function(compressor) {
            return this.consequent._dot_throw(compressor) || this.alternative._dot_throw(compressor);
        });
        def(AST_Constant, return_false);
        def(AST_Dot, function(compressor) {
            if (!is_strict(compressor)) return false;
            var exp = this.expression;
            if (exp instanceof AST_SymbolRef) exp = exp.fixed_value();
            return !(exp instanceof AST_Lambda && this.property == "prototype");
        });
        def(AST_Lambda, return_false);
        def(AST_Null, return_true);
        def(AST_Object, function(compressor) {
            return is_strict(compressor) && !all(this.properties, function(prop) {
                return prop instanceof AST_ObjectKeyVal;
            });
        });
        def(AST_Sequence, function(compressor) {
            return this.tail_node()._dot_throw(compressor);
        });
        def(AST_SymbolRef, function(compressor) {
            if (this.is_undefined) return true;
            if (!is_strict(compressor)) return false;
            if (is_undeclared_ref(this) && this.is_declared(compressor)) return false;
            if (this.is_immutable()) return false;
            var def = this.definition();
            if (is_arguments(def) && all(def.scope.argnames, function(argname) {
                return argname instanceof AST_SymbolFunarg;
            })) return def.scope.uses_arguments > 2;
            var fixed = this.fixed_value();
            if (!fixed) return true;
            this._dot_throw = return_true;
            if (fixed._dot_throw(compressor)) {
                delete this._dot_throw;
                return true;
            }
            this._dot_throw = return_false;
            return false;
        });
        def(AST_This, function(compressor) {
            return is_strict(compressor) && !this.scope.new;
        });
        def(AST_UnaryPrefix, function() {
            return this.operator == "void";
        });
        def(AST_UnaryPostfix, return_false);
        def(AST_Undefined, return_true);
    })(function(node, func) {
        node.DEFMETHOD("_dot_throw", func);
    });

    (function(def) {
        def(AST_Node, return_false);
        def(AST_Array, return_true);
        def(AST_Assign, function(compressor) {
            return this.operator != "=" || this.right.is_defined(compressor);
        });
        def(AST_Binary, function(compressor) {
            switch (this.operator) {
              case "&&":
                return this.left.is_defined(compressor) && this.right.is_defined(compressor);
              case "||":
                return this.left.is_truthy() || this.right.is_defined(compressor);
              default:
                return true;
            }
        });
        def(AST_Conditional, function(compressor) {
            return this.consequent.is_defined(compressor) && this.alternative.is_defined(compressor);
        });
        def(AST_Constant, return_true);
        def(AST_Hole, return_false);
        def(AST_Lambda, return_true);
        def(AST_Object, return_true);
        def(AST_Sequence, function(compressor) {
            return this.tail_node().is_defined(compressor);
        });
        def(AST_SymbolRef, function(compressor) {
            if (this.is_undefined) return false;
            if (is_undeclared_ref(this) && this.is_declared(compressor)) return true;
            if (this.is_immutable()) return true;
            var fixed = this.fixed_value();
            if (!fixed) return false;
            this.is_defined = return_false;
            var result = fixed.is_defined(compressor);
            delete this.is_defined;
            return result;
        });
        def(AST_UnaryPrefix, function() {
            return this.operator != "void";
        });
        def(AST_UnaryPostfix, return_true);
        def(AST_Undefined, return_false);
    })(function(node, func) {
        node.DEFMETHOD("is_defined", func);
    });

    /* -----[ boolean/negation helpers ]----- */

    // methods to determine whether an expression has a boolean result type
    (function(def) {
        def(AST_Node, return_false);
        def(AST_Assign, function(compressor) {
            return this.operator == "=" && this.right.is_boolean(compressor);
        });
        var binary = makePredicate("in instanceof == != === !== < <= >= >");
        def(AST_Binary, function(compressor) {
            return binary[this.operator] || lazy_op[this.operator]
                && this.left.is_boolean(compressor)
                && this.right.is_boolean(compressor);
        });
        def(AST_Boolean, return_true);
        var fn = makePredicate("every hasOwnProperty isPrototypeOf propertyIsEnumerable some");
        def(AST_Call, function(compressor) {
            if (!compressor.option("unsafe")) return false;
            var exp = this.expression;
            return exp instanceof AST_Dot && (fn[exp.property]
                || exp.property == "test" && exp.expression instanceof AST_RegExp);
        });
        def(AST_Conditional, function(compressor) {
            return this.consequent.is_boolean(compressor) && this.alternative.is_boolean(compressor);
        });
        def(AST_New, return_false);
        def(AST_Sequence, function(compressor) {
            return this.tail_node().is_boolean(compressor);
        });
        def(AST_SymbolRef, function(compressor) {
            var fixed = this.fixed_value();
            if (!fixed) return false;
            this.is_boolean = return_false;
            var result = fixed.is_boolean(compressor);
            delete this.is_boolean;
            return result;
        });
        var unary = makePredicate("! delete");
        def(AST_UnaryPrefix, function() {
            return unary[this.operator];
        });
    })(function(node, func) {
        node.DEFMETHOD("is_boolean", func);
    });

    // methods to determine if an expression has a numeric result type
    (function(def) {
        def(AST_Node, return_false);
        var binary = makePredicate("- * / % & | ^ << >> >>>");
        def(AST_Assign, function(compressor) {
            return binary[this.operator.slice(0, -1)]
                || this.operator == "=" && this.right.is_number(compressor);
        });
        def(AST_Binary, function(compressor) {
            if (binary[this.operator]) return true;
            if (this.operator != "+") return false;
            return (this.left.is_boolean(compressor) || this.left.is_number(compressor))
                && (this.right.is_boolean(compressor) || this.right.is_number(compressor));
        });
        var fn = makePredicate([
            "charCodeAt",
            "getDate",
            "getDay",
            "getFullYear",
            "getHours",
            "getMilliseconds",
            "getMinutes",
            "getMonth",
            "getSeconds",
            "getTime",
            "getTimezoneOffset",
            "getUTCDate",
            "getUTCDay",
            "getUTCFullYear",
            "getUTCHours",
            "getUTCMilliseconds",
            "getUTCMinutes",
            "getUTCMonth",
            "getUTCSeconds",
            "getYear",
            "indexOf",
            "lastIndexOf",
            "localeCompare",
            "push",
            "search",
            "setDate",
            "setFullYear",
            "setHours",
            "setMilliseconds",
            "setMinutes",
            "setMonth",
            "setSeconds",
            "setTime",
            "setUTCDate",
            "setUTCFullYear",
            "setUTCHours",
            "setUTCMilliseconds",
            "setUTCMinutes",
            "setUTCMonth",
            "setUTCSeconds",
            "setYear",
            "toExponential",
            "toFixed",
            "toPrecision",
        ]);
        def(AST_Call, function(compressor) {
            if (!compressor.option("unsafe")) return false;
            var exp = this.expression;
            return exp instanceof AST_Dot && (fn[exp.property]
                || is_undeclared_ref(exp.expression) && exp.expression.name == "Math");
        });
        def(AST_Conditional, function(compressor) {
            return this.consequent.is_number(compressor) && this.alternative.is_number(compressor);
        });
        def(AST_New, return_false);
        def(AST_Number, return_true);
        def(AST_Sequence, function(compressor) {
            return this.tail_node().is_number(compressor);
        });
        def(AST_SymbolRef, function(compressor) {
            var fixed = this.fixed_value();
            if (!fixed) return false;
            this.is_number = return_false;
            var result = fixed.is_number(compressor);
            delete this.is_number;
            return result;
        });
        var unary = makePredicate("+ - ~ ++ --");
        def(AST_Unary, function() {
            return unary[this.operator];
        });
    })(function(node, func) {
        node.DEFMETHOD("is_number", func);
    });

    // methods to determine if an expression has a string result type
    (function(def) {
        def(AST_Node, return_false);
        def(AST_Assign, function(compressor) {
            switch (this.operator) {
              case "+=":
                if (this.left.is_string(compressor)) return true;
              case "=":
                return this.right.is_string(compressor);
            }
        });
        def(AST_Binary, function(compressor) {
            return this.operator == "+" &&
                (this.left.is_string(compressor) || this.right.is_string(compressor));
        });
        var fn = makePredicate([
            "charAt",
            "substr",
            "substring",
            "toLowerCase",
            "toString",
            "toUpperCase",
            "trim",
        ]);
        def(AST_Call, function(compressor) {
            if (!compressor.option("unsafe")) return false;
            var exp = this.expression;
            return exp instanceof AST_Dot && fn[exp.property];
        });
        def(AST_Conditional, function(compressor) {
            return this.consequent.is_string(compressor) && this.alternative.is_string(compressor);
        });
        def(AST_Sequence, function(compressor) {
            return this.tail_node().is_string(compressor);
        });
        def(AST_String, return_true);
        def(AST_SymbolRef, function(compressor) {
            var fixed = this.fixed_value();
            if (!fixed) return false;
            this.is_string = return_false;
            var result = fixed.is_string(compressor);
            delete this.is_string;
            return result;
        });
        def(AST_UnaryPrefix, function() {
            return this.operator == "typeof";
        });
    })(function(node, func) {
        node.DEFMETHOD("is_string", func);
    });

    var lazy_op = makePredicate("&& ||");

    function is_lhs(node, parent) {
        if (parent instanceof AST_Assign) return parent.left === node && node;
        if (parent instanceof AST_DefaultValue) return parent.name === node && node;
        if (parent instanceof AST_Destructured) return node;
        if (parent instanceof AST_DestructuredKeyVal) return node;
        if (parent instanceof AST_Unary) return unary_side_effects[parent.operator] && parent.expression;
    }

    (function(def) {
        function to_node(value, orig) {
            if (value instanceof AST_Node) return value.clone(true);
            if (Array.isArray(value)) return make_node(AST_Array, orig, {
                elements: value.map(function(value) {
                    return to_node(value, orig);
                })
            });
            if (value && typeof value == "object") {
                var props = [];
                for (var key in value) if (HOP(value, key)) {
                    props.push(make_node(AST_ObjectKeyVal, orig, {
                        key: key,
                        value: to_node(value[key], orig)
                    }));
                }
                return make_node(AST_Object, orig, {
                    properties: props
                });
            }
            return make_node_from_constant(value, orig);
        }

        function warn(node) {
            AST_Node.warn("global_defs {node} redefined [{file}:{line},{col}]", {
                node: node,
                file: node.start.file,
                line: node.start.line,
                col: node.start.col,
            });
        }

        AST_Toplevel.DEFMETHOD("resolve_defines", function(compressor) {
            if (!compressor.option("global_defs")) return this;
            this.figure_out_scope({ ie8: compressor.option("ie8") });
            return this.transform(new TreeTransformer(function(node) {
                var def = node._find_defs(compressor, "");
                if (!def) return;
                var level = 0, child = node, parent;
                while (parent = this.parent(level++)) {
                    if (!(parent instanceof AST_PropAccess)) break;
                    if (parent.expression !== child) break;
                    child = parent;
                }
                if (is_lhs(child, parent)) {
                    warn(node);
                    return;
                }
                return def;
            }));
        });
        def(AST_Node, noop);
        def(AST_Dot, function(compressor, suffix) {
            return this.expression._find_defs(compressor, "." + this.property + suffix);
        });
        def(AST_SymbolDeclaration, function(compressor) {
            if (!this.definition().global) return;
            if (HOP(compressor.option("global_defs"), this.name)) warn(this);
        });
        def(AST_SymbolRef, function(compressor, suffix) {
            if (!this.definition().global) return;
            var defines = compressor.option("global_defs");
            var name = this.name + suffix;
            if (HOP(defines, name)) return to_node(defines[name], this);
        });
    })(function(node, func) {
        node.DEFMETHOD("_find_defs", func);
    });

    function best_of_expression(ast1, ast2, threshold) {
        var delta = ast2.print_to_string().length - ast1.print_to_string().length;
        return delta < (threshold || 0) ? ast2 : ast1;
    }

    function best_of_statement(ast1, ast2, threshold) {
        return best_of_expression(make_node(AST_SimpleStatement, ast1, {
            body: ast1
        }), make_node(AST_SimpleStatement, ast2, {
            body: ast2
        }), threshold).body;
    }

    function best_of(compressor, ast1, ast2, threshold) {
        return (first_in_statement(compressor) ? best_of_statement : best_of_expression)(ast1, ast2, threshold);
    }

    function convert_to_predicate(obj) {
        var map = Object.create(null);
        Object.keys(obj).forEach(function(key) {
            map[key] = makePredicate(obj[key]);
        });
        return map;
    }

    function skip_directives(body) {
        for (var i = 0; i < body.length; i++) {
            var stat = body[i];
            if (!(stat instanceof AST_Directive)) return stat;
        }
    }
    AST_Arrow.DEFMETHOD("first_statement", function() {
        if (this.value) return make_node(AST_Return, this.value, {
            value: this.value
        });
        return skip_directives(this.body);
    });
    AST_Lambda.DEFMETHOD("first_statement", function() {
        return skip_directives(this.body);
    });

    function try_evaluate(compressor, node) {
        var ev = node.evaluate(compressor);
        if (ev === node) return node;
        ev = make_node_from_constant(ev, node).optimize(compressor);
        return best_of(compressor, node, ev, compressor.eval_threshold);
    }

    var object_fns = [
        "constructor",
        "toString",
        "valueOf",
    ];
    var native_fns = convert_to_predicate({
        Array: [
            "indexOf",
            "join",
            "lastIndexOf",
            "slice",
        ].concat(object_fns),
        Boolean: object_fns,
        Function: object_fns,
        Number: [
            "toExponential",
            "toFixed",
            "toPrecision",
        ].concat(object_fns),
        Object: object_fns,
        RegExp: [
            "exec",
            "test",
        ].concat(object_fns),
        String: [
            "charAt",
            "charCodeAt",
            "concat",
            "indexOf",
            "italics",
            "lastIndexOf",
            "match",
            "replace",
            "search",
            "slice",
            "split",
            "substr",
            "substring",
            "toLowerCase",
            "toUpperCase",
            "trim",
        ].concat(object_fns),
    });
    var static_fns = convert_to_predicate({
        Array: [
            "isArray",
        ],
        Math: [
            "abs",
            "acos",
            "asin",
            "atan",
            "ceil",
            "cos",
            "exp",
            "floor",
            "log",
            "round",
            "sin",
            "sqrt",
            "tan",
            "atan2",
            "pow",
            "max",
            "min",
        ],
        Number: [
            "isFinite",
            "isNaN",
        ],
        Object: [
            "create",
            "getOwnPropertyDescriptor",
            "getOwnPropertyNames",
            "getPrototypeOf",
            "isExtensible",
            "isFrozen",
            "isSealed",
            "keys",
        ],
        String: [
            "fromCharCode",
        ],
    });

    // Accomodate when compress option evaluate=false
    // as well as the common constant expressions !0 and -1
    (function(def) {
        def(AST_Node, return_false);
        def(AST_Constant, return_true);
        def(AST_RegExp, return_false);
        var unaryPrefix = makePredicate("! ~ - + void");
        def(AST_UnaryPrefix, function() {
            return unaryPrefix[this.operator] && this.expression instanceof AST_Constant;
        });
    })(function(node, func) {
        node.DEFMETHOD("is_constant", func);
    });

    // methods to evaluate a constant expression
    (function(def) {
        // If the node has been successfully reduced to a constant,
        // then its value is returned; otherwise the element itself
        // is returned.
        //
        // They can be distinguished as constant value is never a
        // descendant of AST_Node.
        //
        // When `ignore_side_effects` is `true`, inspect the constant value
        // produced without worrying about any side effects caused by said
        // expression.
        AST_Node.DEFMETHOD("evaluate", function(compressor, ignore_side_effects) {
            if (!compressor.option("evaluate")) return this;
            var cached = [];
            var val = this._eval(compressor, ignore_side_effects, cached, 1);
            cached.forEach(function(node) {
                delete node._eval;
            });
            if (ignore_side_effects) return val;
            if (!val || val instanceof RegExp) return val;
            if (typeof val == "function" || typeof val == "object") return this;
            return val;
        });
        var scan_modified = new TreeWalker(function(node) {
            if (node instanceof AST_Assign) modified(node.left);
            if (node instanceof AST_Unary && UNARY_POSTFIX[node.operator]) modified(node.expression);
        });
        function modified(node) {
            if (node instanceof AST_PropAccess) {
                modified(node.expression);
            } else if (node instanceof AST_SymbolRef) {
                node.definition().references.forEach(function(ref) {
                    delete ref._eval;
                });
            }
        }
        def(AST_Statement, function() {
            throw new Error(string_template("Cannot evaluate a statement [{file}:{line},{col}]", this.start));
        });
        def(AST_Accessor, return_this);
        def(AST_Node, return_this);
        def(AST_Constant, function() {
            return this.value;
        });
        def(AST_Assign, function(compressor, ignore_side_effects, cached, depth) {
            var lhs = this.left;
            if (!ignore_side_effects) {
                if (!(lhs instanceof AST_SymbolRef)) return this;
                if (!HOP(lhs, "_eval")) {
                    if (!lhs.fixed) return this;
                    var def = lhs.definition();
                    if (!def.fixed) return this;
                    if (def.undeclared) return this;
                    if (def.last_ref !== lhs) return this;
                    if (def.single_use == "m") return this;
                }
            }
            var op = this.operator;
            var node;
            if (!HOP(lhs, "_eval") && lhs instanceof AST_SymbolRef && lhs.fixed && lhs.definition().fixed) {
                node = lhs;
            } else if (op == "=") {
                lhs.walk(scan_modified);
                node = this.right;
            } else {
                node = make_node(AST_Binary, this, {
                    operator: op.slice(0, -1),
                    left: lhs,
                    right: this.right,
                });
            }
            var value = node._eval(compressor, ignore_side_effects, cached, depth);
            if (typeof value == "object") return this;
            modified(lhs);
            return value;
        });
        def(AST_Sequence, function(compressor, ignore_side_effects, cached, depth) {
            if (!ignore_side_effects) return this;
            var exprs = this.expressions;
            for (var i = 0, last = exprs.length - 1; i < last; i++) {
                exprs[i].walk(scan_modified);
            }
            var tail = exprs[last];
            var value = tail._eval(compressor, ignore_side_effects, cached, depth);
            return value === tail ? this : value;
        });
        def(AST_Lambda, function(compressor) {
            if (compressor.option("unsafe")) {
                var fn = function() {};
                fn.node = this;
                fn.toString = function() {
                    return "function(){}";
                };
                return fn;
            }
            return this;
        });
        def(AST_Array, function(compressor, ignore_side_effects, cached, depth) {
            if (compressor.option("unsafe")) {
                var elements = [];
                for (var i = 0; i < this.elements.length; i++) {
                    var element = this.elements[i];
                    if (element instanceof AST_Hole) return this;
                    var value = element._eval(compressor, ignore_side_effects, cached, depth);
                    if (element === value) return this;
                    elements.push(value);
                }
                return elements;
            }
            return this;
        });
        def(AST_Object, function(compressor, ignore_side_effects, cached, depth) {
            if (compressor.option("unsafe")) {
                var val = {};
                for (var i = 0; i < this.properties.length; i++) {
                    var prop = this.properties[i];
                    if (!(prop instanceof AST_ObjectKeyVal)) return this;
                    var key = prop.key;
                    if (key instanceof AST_Node) {
                        key = key._eval(compressor, ignore_side_effects, cached, depth);
                        if (key === prop.key) return this;
                    }
                    if (prop.value instanceof AST_Function && typeof Object.prototype[key] == "function") return this;
                    val[key] = prop.value._eval(compressor, ignore_side_effects, cached, depth);
                    if (val[key] === prop.value) return this;
                }
                return val;
            }
            return this;
        });
        var non_converting_unary = makePredicate("! typeof void");
        def(AST_UnaryPrefix, function(compressor, ignore_side_effects, cached, depth) {
            var e = this.expression;
            var op = this.operator;
            // Function would be evaluated to an array and so typeof would
            // incorrectly return "object". Hence making is a special case.
            if (compressor.option("typeofs")
                && op == "typeof"
                && (e instanceof AST_Lambda
                    || e instanceof AST_SymbolRef
                        && e.fixed_value() instanceof AST_Lambda)) {
                return typeof function(){};
            }
            var def = e instanceof AST_SymbolRef && e.definition();
            if (!non_converting_unary[op] && !(def && def.fixed)) depth++;
            var v = e._eval(compressor, ignore_side_effects, cached, depth);
            if (v === e) {
                if (ignore_side_effects && op == "void") return;
                return this;
            }
            switch (op) {
              case "!": return !v;
              case "typeof":
                // typeof <RegExp> returns "object" or "function" on different platforms
                // so cannot evaluate reliably
                if (v instanceof RegExp) return this;
                return typeof v;
              case "void": return;
              case "~": return ~v;
              case "-": return -v;
              case "+": return +v;
              case "++":
              case "--":
                if (!def) return this;
                if (!ignore_side_effects) {
                    if (def.undeclared) return this;
                    if (def.last_ref !== e) return this;
                }
                if (HOP(e, "_eval")) v = +(op[0] + 1) + +v;
                modified(e);
                return v;
            }
            return this;
        });
        def(AST_UnaryPostfix, function(compressor, ignore_side_effects, cached, depth) {
            var e = this.expression;
            if (!(e instanceof AST_SymbolRef)) {
                if (!ignore_side_effects) return this;
            } else if (!HOP(e, "_eval")) {
                if (!e.fixed) return this;
                if (!ignore_side_effects) {
                    var def = e.definition();
                    if (!def.fixed) return this;
                    if (def.undeclared) return this;
                    if (def.last_ref !== e) return this;
                }
            }
            if (!(e instanceof AST_SymbolRef && e.definition().fixed)) depth++;
            var v = e._eval(compressor, ignore_side_effects, cached, depth);
            if (v === e) return this;
            modified(e);
            return +v;
        });
        var non_converting_binary = makePredicate("&& || === !==");
        def(AST_Binary, function(compressor, ignore_side_effects, cached, depth) {
            if (!non_converting_binary[this.operator]) depth++;
            var left = this.left._eval(compressor, ignore_side_effects, cached, depth);
            if (left === this.left) return this;
            if (this.operator == (left ? "||" : "&&")) return left;
            var rhs_ignore_side_effects = ignore_side_effects && !(left && typeof left == "object");
            var right = this.right._eval(compressor, rhs_ignore_side_effects, cached, depth);
            if (right === this.right) return this;
            var result;
            switch (this.operator) {
              case "&&" : result = left &&  right; break;
              case "||" : result = left ||  right; break;
              case "|"  : result = left |   right; break;
              case "&"  : result = left &   right; break;
              case "^"  : result = left ^   right; break;
              case "+"  : result = left +   right; break;
              case "-"  : result = left -   right; break;
              case "*"  : result = left *   right; break;
              case "/"  : result = left /   right; break;
              case "%"  : result = left %   right; break;
              case "<<" : result = left <<  right; break;
              case ">>" : result = left >>  right; break;
              case ">>>": result = left >>> right; break;
              case "==" : result = left ==  right; break;
              case "===": result = left === right; break;
              case "!=" : result = left !=  right; break;
              case "!==": result = left !== right; break;
              case "<"  : result = left <   right; break;
              case "<=" : result = left <=  right; break;
              case ">"  : result = left >   right; break;
              case ">=" : result = left >=  right; break;
              case "in":
                if (right && typeof right == "object" && HOP(right, left)) {
                    result = true;
                    break;
                }
              default:
                return this;
            }
            if (isNaN(result)) return compressor.find_parent(AST_With) ? this : result;
            if (compressor.option("unsafe_math")
                && !ignore_side_effects
                && result
                && typeof result == "number"
                && (this.operator == "+" || this.operator == "-")) {
                var digits = Math.max(0, decimals(left), decimals(right));
                // 53-bit significand => 15.95 decimal places
                if (digits < 16) return +result.toFixed(digits);
            }
            return result;

            function decimals(operand) {
                var match = /(\.[0-9]*)?(e.+)?$/.exec(+operand);
                return (match[1] || ".").length - 1 - (match[2] || "").slice(1);
            }
        });
        def(AST_Conditional, function(compressor, ignore_side_effects, cached, depth) {
            var condition = this.condition._eval(compressor, ignore_side_effects, cached, depth);
            if (condition === this.condition) return this;
            var node = condition ? this.consequent : this.alternative;
            var value = node._eval(compressor, ignore_side_effects, cached, depth);
            return value === node ? this : value;
        });
        function verify_escaped(ref, depth) {
            var escaped = ref.definition().escaped;
            switch (escaped.length) {
              case 0:
                return true;
              case 1:
                var found = false;
                escaped[0].walk(new TreeWalker(function(node) {
                    if (found) return true;
                    if (node === ref) return found = true;
                    if (node instanceof AST_Scope) return true;
                }));
                return found;
              default:
                return depth <= escaped.depth;
            }
        }
        def(AST_SymbolRef, function(compressor, ignore_side_effects, cached, depth) {
            var fixed = this.fixed_value();
            if (!fixed) return this;
            var value;
            if (HOP(fixed, "_eval")) {
                value = fixed._eval();
            } else {
                this._eval = return_this;
                value = fixed._eval(compressor, ignore_side_effects, cached, depth);
                delete this._eval;
                if (value === fixed) return this;
                fixed._eval = function() {
                    return value;
                };
                cached.push(fixed);
            }
            return value && typeof value == "object" && !verify_escaped(this, depth) ? this : value;
        });
        var global_objs = {
            Array: Array,
            Math: Math,
            Number: Number,
            Object: Object,
            String: String,
        };
        var static_values = convert_to_predicate({
            Math: [
                "E",
                "LN10",
                "LN2",
                "LOG2E",
                "LOG10E",
                "PI",
                "SQRT1_2",
                "SQRT2",
            ],
            Number: [
                "MAX_VALUE",
                "MIN_VALUE",
                "NaN",
                "NEGATIVE_INFINITY",
                "POSITIVE_INFINITY",
            ],
        });
        var regexp_props = makePredicate("global ignoreCase multiline source");
        def(AST_PropAccess, function(compressor, ignore_side_effects, cached, depth) {
            if (compressor.option("unsafe")) {
                var val;
                var exp = this.expression;
                if (!is_undeclared_ref(exp)) {
                    val = exp._eval(compressor, ignore_side_effects, cached, depth + 1);
                    if (val == null || val === exp) return this;
                }
                var key = this.property;
                if (key instanceof AST_Node) {
                    key = key._eval(compressor, ignore_side_effects, cached, depth);
                    if (key === this.property) return this;
                }
                if (val === undefined) {
                    var static_value = static_values[exp.name];
                    if (!static_value || !static_value[key]) return this;
                    val = global_objs[exp.name];
                } else if (val instanceof RegExp) {
                    if (!regexp_props[key]) return this;
                } else if (typeof val == "object") {
                    if (!HOP(val, key)) return this;
                } else if (typeof val == "function") switch (key) {
                  case "name":
                    return val.node.name ? val.node.name.name : "";
                  case "length":
                    return val.node.argnames.length;
                  default:
                    return this;
                }
                return val[key];
            }
            return this;
        });
        def(AST_Call, function(compressor, ignore_side_effects, cached, depth) {
            var exp = this.expression;
            var fn = exp instanceof AST_SymbolRef ? exp.fixed_value() : exp;
            if (fn instanceof AST_Defun || fn instanceof AST_Function) {
                if (fn.evaluating) return this;
                if (fn.name && fn.name.definition().recursive_refs > 0) return this;
                if (this.is_expr_pure(compressor)) return this;
                var args = eval_args(this.args);
                if (!all(fn.argnames, function(sym, index) {
                    if (sym instanceof AST_DefaultValue) {
                        if (!args) return false;
                        if (args[index] !== undefined) return false;
                        var value = sym.value._eval(compressor, ignore_side_effects, cached, depth);
                        if (value === sym.value) return false;
                        args[index] = value;
                        sym = sym.name;
                    }
                    return !(sym instanceof AST_Destructured);
                })) return this;
                if (!args && !ignore_side_effects) return this;
                var stat = fn.first_statement();
                if (!(stat instanceof AST_Return)) {
                    if (ignore_side_effects) {
                        var found = false;
                        fn.walk(new TreeWalker(function(node) {
                            if (found) return true;
                            if (node instanceof AST_Return) {
                                if (node.value && node.value._eval(compressor, true, cached, depth) !== undefined) {
                                    found = true;
                                }
                                return true;
                            }
                            if (node instanceof AST_Scope && node !== fn) return true;
                        }));
                        if (!found) return;
                    }
                    return this;
                }
                var val = stat.value;
                if (!val) return;
                var cached_args = [];
                if (!args || all(fn.argnames, function(sym, i) {
                    if (sym instanceof AST_DefaultValue) sym = sym.name;
                    var def = sym.definition();
                    if (def.orig[def.orig.length - 1] !== sym) return false;
                    var value = args[i];
                    def.references.forEach(function(node) {
                        node._eval = function() {
                            return value;
                        };
                        cached_args.push(node);
                    });
                    return true;
                }) || ignore_side_effects) {
                    fn.evaluating = true;
                    val = val._eval(compressor, ignore_side_effects, cached, depth);
                    delete fn.evaluating;
                }
                cached_args.forEach(function(node) {
                    delete node._eval;
                });
                return val === stat.value ? this : val;
            } else if (compressor.option("unsafe") && exp instanceof AST_PropAccess) {
                var key = exp.property;
                if (key instanceof AST_Node) {
                    key = key._eval(compressor, ignore_side_effects, cached, depth);
                    if (key === exp.property) return this;
                }
                var val;
                var e = exp.expression;
                if (is_undeclared_ref(e)) {
                    var static_fn = static_fns[e.name];
                    if (!static_fn || !static_fn[key]) return this;
                    val = global_objs[e.name];
                } else {
                    val = e._eval(compressor, ignore_side_effects, cached, depth + 1);
                    if (val == null || val === e) return this;
                    var native_fn = native_fns[val.constructor.name];
                    if (!native_fn || !native_fn[key]) return this;
                    if (val instanceof RegExp && val.global && !(e instanceof AST_RegExp)) return this;
                }
                var args = eval_args(this.args);
                if (!args) return this;
                if (key == "replace" && typeof args[1] == "function") return this;
                try {
                    return val[key].apply(val, args);
                } catch (ex) {
                    AST_Node.warn("Error evaluating {code} [{file}:{line},{col}]", {
                        code: this,
                        file: this.start.file,
                        line: this.start.line,
                        col: this.start.col,
                    });
                } finally {
                    if (val instanceof RegExp) val.lastIndex = 0;
                }
            }
            return this;

            function eval_args(args) {
                var values = [];
                for (var i = 0; i < args.length; i++) {
                    var arg = args[i];
                    var value = arg._eval(compressor, ignore_side_effects, cached, depth);
                    if (arg === value) return;
                    values.push(value);
                }
                return values;
            }
        });
        def(AST_New, return_this);
    })(function(node, func) {
        node.DEFMETHOD("_eval", func);
    });

    // method to negate an expression
    (function(def) {
        function basic_negation(exp) {
            return make_node(AST_UnaryPrefix, exp, {
                operator: "!",
                expression: exp
            });
        }
        function best(orig, alt, first_in_statement) {
            var negated = basic_negation(orig);
            if (first_in_statement) {
                var stat = make_node(AST_SimpleStatement, alt, {
                    body: alt
                });
                return best_of_expression(negated, stat) === stat ? alt : negated;
            }
            return best_of_expression(negated, alt);
        }
        def(AST_Node, function() {
            return basic_negation(this);
        });
        def(AST_Statement, function() {
            throw new Error("Cannot negate a statement");
        });
        def(AST_Arrow, function() {
            return basic_negation(this);
        });
        def(AST_AsyncFunction, function() {
            return basic_negation(this);
        });
        def(AST_Function, function() {
            return basic_negation(this);
        });
        def(AST_UnaryPrefix, function() {
            if (this.operator == "!")
                return this.expression;
            return basic_negation(this);
        });
        def(AST_Sequence, function(compressor) {
            var expressions = this.expressions.slice();
            expressions.push(expressions.pop().negate(compressor));
            return make_sequence(this, expressions);
        });
        def(AST_Conditional, function(compressor, first_in_statement) {
            var self = this.clone();
            self.consequent = self.consequent.negate(compressor);
            self.alternative = self.alternative.negate(compressor);
            return best(this, self, first_in_statement);
        });
        def(AST_Binary, function(compressor, first_in_statement) {
            var self = this.clone(), op = this.operator;
            if (compressor.option("unsafe_comps")) {
                switch (op) {
                  case "<=" : self.operator = ">"  ; return self;
                  case "<"  : self.operator = ">=" ; return self;
                  case ">=" : self.operator = "<"  ; return self;
                  case ">"  : self.operator = "<=" ; return self;
                }
            }
            switch (op) {
              case "==" : self.operator = "!="; return self;
              case "!=" : self.operator = "=="; return self;
              case "===": self.operator = "!=="; return self;
              case "!==": self.operator = "==="; return self;
              case "&&":
                self.operator = "||";
                self.left = self.left.negate(compressor, first_in_statement);
                self.right = self.right.negate(compressor);
                return best(this, self, first_in_statement);
              case "||":
                self.operator = "&&";
                self.left = self.left.negate(compressor, first_in_statement);
                self.right = self.right.negate(compressor);
                return best(this, self, first_in_statement);
            }
            return basic_negation(this);
        });
    })(function(node, func) {
        node.DEFMETHOD("negate", function(compressor, first_in_statement) {
            return func.call(this, compressor, first_in_statement);
        });
    });

    var global_pure_fns = makePredicate("Boolean decodeURI decodeURIComponent Date encodeURI encodeURIComponent Error escape EvalError isFinite isNaN Number Object parseFloat parseInt RangeError ReferenceError String SyntaxError TypeError unescape URIError");
    AST_Call.DEFMETHOD("is_expr_pure", function(compressor) {
        if (compressor.option("unsafe")) {
            var expr = this.expression;
            if (is_undeclared_ref(expr) && global_pure_fns[expr.name]) return true;
            if (expr instanceof AST_Dot && is_undeclared_ref(expr.expression)) {
                var static_fn = static_fns[expr.expression.name];
                return static_fn && (static_fn[expr.property]
                    || expr.expression.name == "Math" && expr.property == "random");
            }
        }
        return this.pure || !compressor.pure_funcs(this);
    });
    AST_Node.DEFMETHOD("is_call_pure", return_false);
    AST_Call.DEFMETHOD("is_call_pure", function(compressor) {
        if (!compressor.option("unsafe")) return false;
        var dot = this.expression;
        if (!(dot instanceof AST_Dot)) return false;
        var exp = dot.expression;
        var map;
        var prop = dot.property;
        if (exp instanceof AST_Array) {
            map = native_fns.Array;
        } else if (exp.is_boolean(compressor)) {
            map = native_fns.Boolean;
        } else if (exp.is_number(compressor)) {
            map = native_fns.Number;
        } else if (exp instanceof AST_RegExp) {
            map = native_fns.RegExp;
        } else if (exp.is_string(compressor)) {
            map = native_fns.String;
            if (prop == "replace") {
                var arg = this.args[1];
                if (arg && !arg.is_string(compressor)) return false;
            }
        } else if (!dot.may_throw_on_access(compressor)) {
            map = native_fns.Object;
        }
        return map && map[prop];
    });

    function spread_side_effects(exp) {
        while ((exp = exp.tail_node()) instanceof AST_SymbolRef) {
            exp = exp.fixed_value();
            if (!exp) return true;
        }
        return !(exp instanceof AST_Array
            || exp.TYPE == "Binary" && !lazy_op[exp.operator]
            || exp instanceof AST_Constant
            || exp instanceof AST_Lambda
            || exp instanceof AST_Object && all(exp.properties, function(prop) {
                return !(prop instanceof AST_ObjectGetter || prop instanceof AST_Spread);
            })
            || exp instanceof AST_This
            || exp instanceof AST_Unary);
    }

    // determine if expression has side effects
    (function(def) {
        function any(list, compressor, spread) {
            return !all(list, spread ? function(node) {
                return node instanceof AST_Spread ? !spread(node, compressor) : !node.has_side_effects(compressor);
            } : function(node) {
                return !node.has_side_effects(compressor);
            });
        }
        function array_spread(node, compressor) {
            return !node.expression.is_string(compressor) || node.expression.has_side_effects(compressor);
        }
        def(AST_Node, return_true);
        def(AST_Array, function(compressor) {
            return any(this.elements, compressor, array_spread);
        });
        def(AST_Assign, function(compressor) {
            var lhs = this.left;
            if (!(lhs instanceof AST_PropAccess)) return true;
            var node = lhs.expression;
            return !(node instanceof AST_This)
                || !node.scope.new
                || lhs instanceof AST_Sub && lhs.property.has_side_effects(compressor)
                || this.right.has_side_effects(compressor);
        });
        def(AST_Binary, function(compressor) {
            return this.left.has_side_effects(compressor)
                || this.right.has_side_effects(compressor)
                || this.operator == "in" && !is_object(this.right);
        });
        def(AST_Block, function(compressor) {
            return any(this.body, compressor);
        });
        def(AST_Call, function(compressor) {
            if (!this.is_expr_pure(compressor)
                && (!this.is_call_pure(compressor) || this.expression.has_side_effects(compressor))) {
                return true;
            }
            return any(this.args, compressor, array_spread);
        });
        def(AST_Case, function(compressor) {
            return this.expression.has_side_effects(compressor)
                || any(this.body, compressor);
        });
        def(AST_Conditional, function(compressor) {
            return this.condition.has_side_effects(compressor)
                || this.consequent.has_side_effects(compressor)
                || this.alternative.has_side_effects(compressor);
        });
        def(AST_Constant, return_false);
        def(AST_Definitions, function(compressor) {
            return any(this.definitions, compressor);
        });
        def(AST_DestructuredArray, function(compressor) {
            return any(this.elements, compressor);
        });
        def(AST_DestructuredKeyVal, function(compressor) {
            return this.key instanceof AST_Node && this.key.has_side_effects(compressor)
                || this.value.has_side_effects(compressor);
        });
        def(AST_DestructuredObject, function(compressor) {
            return any(this.properties, compressor);
        });
        def(AST_Dot, function(compressor) {
            return this.expression.may_throw_on_access(compressor)
                || this.expression.has_side_effects(compressor);
        });
        def(AST_EmptyStatement, return_false);
        def(AST_If, function(compressor) {
            return this.condition.has_side_effects(compressor)
                || this.body && this.body.has_side_effects(compressor)
                || this.alternative && this.alternative.has_side_effects(compressor);
        });
        def(AST_LabeledStatement, function(compressor) {
            return this.body.has_side_effects(compressor);
        });
        def(AST_Lambda, return_false);
        def(AST_Object, function(compressor) {
            return any(this.properties, compressor, function(node, compressor) {
                var exp = node.expression;
                return spread_side_effects(exp) || exp.has_side_effects(compressor);
            });
        });
        def(AST_ObjectProperty, function(compressor) {
            return this.key instanceof AST_Node && this.key.has_side_effects(compressor)
                || this.value.has_side_effects(compressor);
        });
        def(AST_Sequence, function(compressor) {
            return any(this.expressions, compressor);
        });
        def(AST_SimpleStatement, function(compressor) {
            return this.body.has_side_effects(compressor);
        });
        def(AST_Sub, function(compressor) {
            return this.expression.may_throw_on_access(compressor)
                || this.expression.has_side_effects(compressor)
                || this.property.has_side_effects(compressor);
        });
        def(AST_Switch, function(compressor) {
            return this.expression.has_side_effects(compressor)
                || any(this.body, compressor);
        });
        def(AST_SymbolDeclaration, return_false);
        def(AST_SymbolRef, function(compressor) {
            return !this.is_declared(compressor) || !can_drop_symbol(this);
        });
        def(AST_This, return_false);
        def(AST_Try, function(compressor) {
            return any(this.body, compressor)
                || this.bcatch && this.bcatch.has_side_effects(compressor)
                || this.bfinally && this.bfinally.has_side_effects(compressor);
        });
        def(AST_Unary, function(compressor) {
            return unary_side_effects[this.operator]
                || this.expression.has_side_effects(compressor);
        });
        def(AST_VarDef, function(compressor) {
            return this.value;
        });
    })(function(node, func) {
        node.DEFMETHOD("has_side_effects", func);
    });

    // determine if expression may throw
    (function(def) {
        def(AST_Node, return_true);

        def(AST_Constant, return_false);
        def(AST_EmptyStatement, return_false);
        def(AST_Lambda, return_false);
        def(AST_SymbolDeclaration, return_false);
        def(AST_This, return_false);

        function any(list, compressor) {
            for (var i = list.length; --i >= 0;)
                if (list[i].may_throw(compressor))
                    return true;
            return false;
        }

        def(AST_Array, function(compressor) {
            return any(this.elements, compressor);
        });
        def(AST_Assign, function(compressor) {
            if (this.right.may_throw(compressor)) return true;
            if (!compressor.has_directive("use strict")
                && this.operator == "="
                && this.left instanceof AST_SymbolRef) {
                return false;
            }
            return this.left.may_throw(compressor);
        });
        def(AST_Binary, function(compressor) {
            return this.left.may_throw(compressor)
                || this.right.may_throw(compressor)
                || this.operator == "in" && !is_object(this.right);
        });
        def(AST_Block, function(compressor) {
            return any(this.body, compressor);
        });
        def(AST_Call, function(compressor) {
            if (any(this.args, compressor)) return true;
            if (this.is_expr_pure(compressor)) return false;
            if (this.expression.may_throw(compressor)) return true;
            return !(this.expression instanceof AST_Lambda)
                || any(this.expression.body, compressor);
        });
        def(AST_Case, function(compressor) {
            return this.expression.may_throw(compressor)
                || any(this.body, compressor);
        });
        def(AST_Conditional, function(compressor) {
            return this.condition.may_throw(compressor)
                || this.consequent.may_throw(compressor)
                || this.alternative.may_throw(compressor);
        });
        def(AST_Definitions, function(compressor) {
            return any(this.definitions, compressor);
        });
        def(AST_Dot, function(compressor) {
            return this.expression.may_throw_on_access(compressor)
                || this.expression.may_throw(compressor);
        });
        def(AST_If, function(compressor) {
            return this.condition.may_throw(compressor)
                || this.body && this.body.may_throw(compressor)
                || this.alternative && this.alternative.may_throw(compressor);
        });
        def(AST_LabeledStatement, function(compressor) {
            return this.body.may_throw(compressor);
        });
        def(AST_Object, function(compressor) {
            return any(this.properties, compressor);
        });
        def(AST_ObjectProperty, function(compressor) {
            return this.key instanceof AST_Node && this.key.may_throw(compressor)
                || this.value.may_throw(compressor);
        });
        def(AST_Return, function(compressor) {
            return this.value && this.value.may_throw(compressor);
        });
        def(AST_Sequence, function(compressor) {
            return any(this.expressions, compressor);
        });
        def(AST_SimpleStatement, function(compressor) {
            return this.body.may_throw(compressor);
        });
        def(AST_Sub, function(compressor) {
            return this.expression.may_throw_on_access(compressor)
                || this.expression.may_throw(compressor)
                || this.property.may_throw(compressor);
        });
        def(AST_Switch, function(compressor) {
            return this.expression.may_throw(compressor)
                || any(this.body, compressor);
        });
        def(AST_SymbolRef, function(compressor) {
            return !this.is_declared(compressor);
        });
        def(AST_Try, function(compressor) {
            return (this.bcatch ? this.bcatch.may_throw(compressor) : any(this.body, compressor))
                || this.bfinally && this.bfinally.may_throw(compressor);
        });
        def(AST_Unary, function(compressor) {
            if (this.operator == "typeof" && this.expression instanceof AST_SymbolRef)
                return false;
            return this.expression.may_throw(compressor);
        });
        def(AST_VarDef, function(compressor) {
            if (!this.value) return false;
            return this.value.may_throw(compressor);
        });
    })(function(node, func) {
        node.DEFMETHOD("may_throw", func);
    });

    // determine if expression is constant
    (function(def) {
        function all(list) {
            for (var i = list.length; --i >= 0;)
                if (!list[i].is_constant_expression())
                    return false;
            return true;
        }
        def(AST_Node, return_false);
        def(AST_Array, function() {
            return all(this.elements);
        });
        def(AST_Binary, function() {
            return this.left.is_constant_expression()
                && this.right.is_constant_expression()
                && (this.operator != "in" || is_object(this.right));
        });
        def(AST_Constant, return_true);
        def(AST_Lambda, function(scope) {
            var self = this;
            var result = true;
            var scopes = [];
            self.walk(new TreeWalker(function(node, descend) {
                if (!result) return true;
                if (node instanceof AST_BlockScope) {
                    if (node === self) return;
                    scopes.push(node);
                    descend();
                    scopes.pop();
                    return true;
                }
                if (node instanceof AST_SymbolRef) {
                    if (self.inlined || node.redef) {
                        result = false;
                        return true;
                    }
                    if (self.variables.has(node.name)) return true;
                    var def = node.definition();
                    if (member(def.scope, scopes)) return true;
                    if (scope && !def.redefined()) {
                        var scope_def = scope.find_variable(node.name);
                        if (def.undeclared ? !scope_def : scope_def === def) {
                            result = "f";
                            return true;
                        }
                    }
                    result = false;
                    return true;
                }
                if (node instanceof AST_This) {
                    if (scopes.length == 0 && self instanceof AST_Arrow) result = false;
                    return true;
                }
            }));
            return result;
        });
        def(AST_Object, function() {
            return all(this.properties);
        });
        def(AST_ObjectProperty, function() {
            return typeof this.key == "string" && this.value.is_constant_expression();
        });
        def(AST_Unary, function() {
            return this.expression.is_constant_expression();
        });
    })(function(node, func) {
        node.DEFMETHOD("is_constant_expression", func);
    });

    // tell me if a statement aborts
    function aborts(thing) {
        return thing && thing.aborts();
    }
    (function(def) {
        def(AST_Statement, return_null);
        def(AST_Jump, return_this);
        function block_aborts() {
            var n = this.body.length;
            return n > 0 && aborts(this.body[n - 1]);
        }
        def(AST_BlockStatement, block_aborts);
        def(AST_SwitchBranch, block_aborts);
        def(AST_If, function() {
            return this.alternative && aborts(this.body) && aborts(this.alternative) && this;
        });
    })(function(node, func) {
        node.DEFMETHOD("aborts", func);
    });

    /* -----[ optimizers ]----- */

    var directives = makePredicate(["use asm", "use strict"]);
    OPT(AST_Directive, function(self, compressor) {
        if (compressor.option("directives")
            && (!directives[self.value] || compressor.has_directive(self.value) !== self)) {
            return make_node(AST_EmptyStatement, self);
        }
        return self;
    });

    OPT(AST_Debugger, function(self, compressor) {
        if (compressor.option("drop_debugger"))
            return make_node(AST_EmptyStatement, self);
        return self;
    });

    OPT(AST_LabeledStatement, function(self, compressor) {
        if (compressor.option("dead_code")
            && self.body instanceof AST_Break
            && compressor.loopcontrol_target(self.body) === self.body) {
            return make_node(AST_EmptyStatement, self);
        }
        return compressor.option("unused") && self.label.references.length == 0 ? self.body : self;
    });

    OPT(AST_Block, function(self, compressor) {
        self.body = tighten_body(self.body, compressor);
        return self;
    });

    function trim_block(node) {
        switch (node.body.length) {
          case 0:
            return make_node(AST_EmptyStatement, node);
          case 1:
            var stat = node.body[0];
            if (!(stat instanceof AST_Const || stat instanceof AST_Let)) return stat;
        }
        return node;
    }

    OPT(AST_BlockStatement, function(self, compressor) {
        self.body = tighten_body(self.body, compressor);
        return trim_block(self);
    });

    OPT(AST_Arrow, function(self, compressor) {
        if (!compressor.option("arrows")) return self;
        var body = tighten_body(self.value ? [ self.first_statement() ] : self.body, compressor);
        switch (body.length) {
          case 1:
            var stat = body[0];
            if (stat instanceof AST_Return) {
                self.body.length = 0;
                self.value = stat.value;
                break;
            }
          default:
            self.body = body;
            self.value = null;
            break;
        }
        return self;
    });

    OPT(AST_Function, function(self, compressor) {
        self.body = tighten_body(self.body, compressor);
        if (compressor.option("inline")) for (var i = 0; i < self.body.length; i++) {
            var stat = self.body[i];
            if (stat instanceof AST_Directive) continue;
            if (stat instanceof AST_Return) {
                var call = stat.value;
                if (!call || call.TYPE != "Call") break;
                if (call.is_expr_pure(compressor)) break;
                var fn = call.expression;
                if (fn instanceof AST_SymbolRef) {
                    if (self.name && self.name.definition() === fn.definition()) break;
                    fn = fn.fixed_value();
                }
                if (!(fn instanceof AST_Defun || fn instanceof AST_Function)) break;
                if (fn.uses_arguments) break;
                if (fn === call.expression) {
                    if (fn.parent_scope !== self) break;
                    if (!all(fn.enclosed, function(def) {
                        return def.scope !== self;
                    })) break;
                }
                if (fn.contains_this()) break;
                var len = fn.argnames.length;
                if (len > 0 && compressor.option("inline") < 2) break;
                if (len > self.argnames.length) break;
                if (!all(self.argnames, function(argname) {
                    return argname instanceof AST_SymbolFunarg;
                })) break;
                if (!all(call.args, function(arg) {
                    return !(arg instanceof AST_Spread);
                })) break;
                for (var j = 0; j < len; j++) {
                    var arg = call.args[j];
                    if (!(arg instanceof AST_SymbolRef)) break;
                    if (arg.definition() !== self.argnames[j].definition()) break;
                }
                if (j < len) break;
                for (; j < call.args.length; j++) {
                    if (call.args[j].has_side_effects(compressor)) break;
                }
                if (j < call.args.length) break;
                if (len < self.argnames.length && !compressor.drop_fargs(self, compressor.parent())) {
                    if (!compressor.drop_fargs(fn, call)) break;
                    do {
                        fn.argnames.push(fn.make_var(AST_SymbolFunarg, fn, "argument_" + len));
                    } while (++len < self.argnames.length);
                }
                return call.expression;
            }
            break;
        }
        return self;
    });

    AST_Scope.DEFMETHOD("merge_variables", function(compressor) {
        if (!compressor.option("merge_vars")) return;
        var self = this, segment = {}, root;
        var first = [], last = [], index = 0;
        var declarations = new Dictionary();
        var references = Object.create(null);
        var prev = Object.create(null);
        var tw = new TreeWalker(function(node, descend) {
            if (node instanceof AST_Assign) {
                var lhs = node.left;
                if (lhs instanceof AST_Destructured) {
                    node.right.walk(tw);
                    var marker = new TreeWalker(function(node) {
                        if (node instanceof AST_Destructured) return;
                        if (node instanceof AST_DestructuredKeyVal) {
                            if (node.key instanceof AST_Node) {
                                push();
                                node.key.walk(tw);
                                pop();
                                push();
                                node.value.walk(marker);
                                pop();
                            } else {
                                node.value.walk(marker);
                            }
                        } else if (node instanceof AST_SymbolRef) {
                            mark(node, false, true);
                        } else {
                            node.walk(tw);
                        }
                        return true;
                    });
                    lhs.walk(marker);
                    return true;
                }
                if (lhs instanceof AST_SymbolRef) {
                    if (node.operator != "=") mark(lhs, true, false);
                    node.right.walk(tw);
                    mark(lhs, false, true);
                    return true;
                }
                return;
            }
            if (node instanceof AST_Binary) {
                if (!lazy_op[node.operator]) return;
                node.left.walk(tw);
                push();
                node.right.walk(tw);
                pop();
                return true;
            }
            if (node instanceof AST_Break) {
                var target = tw.loopcontrol_target(node);
                if (!(target instanceof AST_IterationStatement)) insert(target);
                return true;
            }
            if (node instanceof AST_Call) {
                var exp = node.expression;
                var tail = exp.tail_node();
                if (!is_function(tail)) return;
                if (exp !== tail) exp.expressions.slice(0, -1).forEach(function(node) {
                    node.walk(tw);
                });
                node.args.forEach(function(arg) {
                    arg.walk(tw);
                });
                tail.walk(tw);
                return true;
            }
            if (node instanceof AST_Conditional) {
                node.condition.walk(tw);
                push();
                node.consequent.walk(tw);
                pop();
                push();
                node.alternative.walk(tw);
                pop();
                return true;
            }
            if (node instanceof AST_Continue) {
                var target = tw.loopcontrol_target(node);
                if (target instanceof AST_Do) insert(target);
                return true;
            }
            if (node instanceof AST_Do) {
                push();
                segment.block = node;
                segment.loop = true;
                var save = segment;
                node.body.walk(tw);
                if (segment.inserted === node) segment = save;
                node.condition.walk(tw);
                pop();
                return true;
            }
            if (node instanceof AST_For) {
                if (node.init) node.init.walk(tw);
                push();
                segment.block = node;
                segment.loop = true;
                if (node.condition) node.condition.walk(tw);
                node.body.walk(tw);
                if (node.step) node.step.walk(tw);
                pop();
                return true;
            }
            if (node instanceof AST_ForIn) {
                node.object.walk(tw);
                push();
                segment.block = node;
                segment.loop = true;
                node.init.walk(tw);
                node.body.walk(tw);
                pop();
                return true;
            }
            if (node instanceof AST_If) {
                node.condition.walk(tw);
                push();
                node.body.walk(tw);
                pop();
                if (node.alternative) {
                    push();
                    node.alternative.walk(tw);
                    pop();
                }
                return true;
            }
            if (node instanceof AST_LabeledStatement) {
                push();
                segment.block = node;
                var save = segment;
                node.body.walk(tw);
                if (segment.inserted === node) segment = save;
                pop();
                return true;
            }
            if (node instanceof AST_Scope) {
                push();
                segment.block = node;
                if (node === self) root = segment;
                if (node instanceof AST_Lambda) {
                    if (node.name) references[node.name.definition().id] = false;
                    var marker = node.uses_arguments && !tw.has_directive("use strict") ? function(node) {
                        if (node instanceof AST_SymbolFunarg) references[node.definition().id] = false;
                    } : function(node) {
                        if (node instanceof AST_SymbolFunarg) mark(node, false, true);
                    };
                    var scanner = new TreeWalker(function(ref) {
                        if (ref instanceof AST_SymbolDeclaration) references[ref.definition().id] = false;
                        if (!(ref instanceof AST_SymbolRef)) return;
                        var def = ref.definition();
                        var ldef = node.variables.get(ref.name);
                        if (ldef && (ldef === def
                            || def.undeclared
                            || node.parent_scope.find_variable(ref.name) === def)) {
                            references[def.id] = false;
                            references[ldef.id] = false;
                        } else {
                            var save = segment;
                            pop();
                            mark(ref, true, false);
                            segment = save;
                        }
                        return true;
                    });
                    node.argnames.forEach(function(argname) {
                        argname.mark_symbol(marker, scanner);
                    });
                }
                if (node instanceof AST_Arrow && node.value) {
                    node.value.walk(tw);
                } else {
                    walk_body(node, tw);
                }
                pop();
                return true;
            }
            if (node instanceof AST_Switch) {
                node.expression.walk(tw);
                var save = segment;
                node.body.forEach(function(branch) {
                    if (branch instanceof AST_Default) return;
                    branch.expression.walk(tw);
                    if (save === segment) push();
                });
                segment = save;
                node.body.forEach(function(branch) {
                    push();
                    segment.block = node;
                    var save = segment;
                    walk_body(branch, tw);
                    if (segment.inserted === node) segment = save;
                    pop();
                });
                return true;
            }
            if (node instanceof AST_SymbolRef) {
                mark(node, true, false);
                return true;
            }
            if (node instanceof AST_Try) {
                push();
                segment.block = node;
                walk_body(node, tw);
                pop();
                if (node.bcatch) {
                    if (node.bcatch.argname) node.bcatch.argname.mark_symbol(function(node) {
                        if (node instanceof AST_SymbolCatch) {
                            var def = node.definition();
                            references[def.id] = false;
                            if (def = def.redefined()) references[def.id] = false;
                        }
                    }, tw);
                    push();
                    if (node.bfinally) segment.block = node.bcatch;
                    walk_body(node.bcatch, tw);
                    pop();
                }
                if (node.bfinally) node.bfinally.walk(tw);
                return true;
            }
            if (node instanceof AST_Unary) {
                if (!UNARY_POSTFIX[node.operator]) return;
                var sym = node.expression;
                if (!(sym instanceof AST_SymbolRef)) return;
                mark(sym, true, true);
                return true;
            }
            if (node instanceof AST_VarDef) {
                if (node.value) node.value.walk(tw);
                node.name.mark_symbol(node.value ? function(node) {
                    if (!(node instanceof AST_SymbolDeclaration)) return;
                    if (node instanceof AST_SymbolVar) {
                        mark(node, false, true);
                    } else {
                        references[node.definition().id] = false;
                    }
                    return true;
                } : function(node) {
                    if (!(node instanceof AST_SymbolDeclaration)) return;
                    var id = node.definition().id;
                    if (!(node instanceof AST_SymbolVar)) {
                        references[id] = false;
                    } else if (!(id in references)) {
                        declarations.add(id, node);
                    } else if (references[id]) {
                        references[id].push(node);
                    }
                    return true;
                }, tw);
                return true;
            }
            if (node instanceof AST_While) {
                push();
                segment.block = node;
                segment.loop = true;
                descend();
                pop();
                return true;
            }
        });
        tw.directives = Object.create(compressor.directives);
        self.walk(tw);
        var merged = Object.create(null);
        while (first.length && last.length) {
            var head = first.pop();
            var def = head.definition;
            if (!(def.id in prev)) continue;
            if (!references[def.id]) continue;
            var head_refs = {
                start: references[def.id].start,
            };
            while (def.id in merged) def = merged[def.id];
            head_refs.end = references[def.id].end;
            var skipped = [];
            do {
                var tail = last.pop();
                if (!tail) continue;
                if (tail.index > head.index) continue;
                var id = tail.definition.id;
                var tail_refs = references[id];
                if (!tail_refs) continue;
                if (head_refs.start.block !== tail_refs.start.block
                    || !mergeable(head_refs, tail_refs)
                    || head_refs.start.loop && !mergeable(tail_refs, head_refs)
                    || !all(tail_refs, function(sym) {
                        return sym.scope.find_variable(def.name) === def;
                    })) {
                    skipped.unshift(tail);
                    continue;
                }
                var orig = [], refs = [];
                tail_refs.forEach(function(sym) {
                    sym.thedef = def;
                    sym.name = def.name;
                    if (sym instanceof AST_SymbolRef) {
                        refs.push(sym);
                    } else {
                        orig.push(sym);
                    }
                });
                def.orig = orig.concat(def.orig);
                def.references = refs.concat(def.references);
                def.fixed = tail.definition.fixed && def.fixed;
                merged[id] = def;
                break;
            } while (last.length);
            if (skipped.length) last = last.concat(skipped);
        }

        function push() {
            segment = Object.create(segment);
        }

        function pop() {
            segment = Object.getPrototypeOf(segment);
        }

        function mark(sym, read, write) {
            var def = sym.definition(), ldef;
            if (def.id in references) {
                var refs = references[def.id];
                if (!refs) return;
                if (refs.start.block !== segment.block) return references[def.id] = false;
                refs.push(sym);
                refs.end = segment;
                if (def.id in prev) {
                    last[prev[def.id]] = null;
                } else if (!read) {
                    return;
                }
            } else if ((ldef = self.variables.get(def.name)) !== def) {
                if (ldef && root === segment) references[ldef.id] = false;
                return references[def.id] = false;
            } else if (compressor.exposed(def) || sym.name == "arguments" || sym.name == "await") {
                return references[def.id] = false;
            } else {
                var refs = declarations.get(def.id) || [];
                refs.push(sym);
                references[def.id] = refs;
                if (!read) {
                    refs.start = segment;
                    return first.push({
                        index: index++,
                        definition: def,
                    });
                }
                if (segment.block !== self) return references[def.id] = false;
                refs.start = root;
            }
            prev[def.id] = last.length;
            last.push({
                index: index++,
                definition: def,
            });
        }

        function insert(target) {
            var stack = [];
            while (true) {
                if (HOP(segment, "block")) {
                    var block = segment.block;
                    if (block instanceof AST_LabeledStatement) block = block.body;
                    if (block === target) break;
                }
                stack.push(segment);
                pop();
            }
            segment.inserted = segment.block;
            push();
            while (stack.length) {
                var seg = stack.pop();
                push();
                if (HOP(seg, "block")) segment.block = seg.block;
                if (HOP(seg, "loop")) segment.loop = seg.loop;
            }
        }

        function must_visit(base, segment) {
            return base === segment || base.isPrototypeOf(segment);
        }

        function mergeable(head, tail) {
            return must_visit(head.start, head.end) || must_visit(head.start, tail.start);
        }
    });

    AST_Scope.DEFMETHOD("drop_unused", function(compressor) {
        if (!compressor.option("unused")) return;
        var self = this;
        var drop_funcs = !(self instanceof AST_Toplevel) || compressor.toplevel.funcs;
        var drop_vars = !(self instanceof AST_Toplevel) || compressor.toplevel.vars;
        var assign_as_unused = /keep_assign/.test(compressor.option("unused")) ? return_false : function(node, props) {
            var sym, nested = false;
            if (node instanceof AST_Assign) {
                if (node.write_only || node.operator == "=") sym = node.left;
            } else if (node instanceof AST_Unary) {
                if (node.write_only) sym = node.expression;
            }
            if (/strict/.test(compressor.option("pure_getters"))) {
                while (sym instanceof AST_PropAccess && !sym.expression.may_throw_on_access(compressor)) {
                    if (sym instanceof AST_Sub) props.unshift(sym.property);
                    sym = sym.expression;
                    nested = true;
                }
            }
            if (!(sym instanceof AST_SymbolRef)) return;
            if (compressor.exposed(sym.definition())) return;
            if (!can_drop_symbol(sym, nested)) return;
            return sym;
        };
        var assign_in_use = Object.create(null);
        var find_variable = function(name) {
            find_variable = compose(self, 0, noop);
            return find_variable(name);

            function compose(child, level, find) {
                var parent = compressor.parent(level);
                if (!parent) return find;
                if (parent instanceof AST_DestructuredKeyVal) {
                    var destructured = compressor.parent(level + 1);
                    if (parent.key === child) {
                        var fn = compressor.parent(level + 2);
                        if (fn instanceof AST_Lambda) {
                            return compose(fn, level + 3, fn.argnames.indexOf(destructured) >= 0 ? function(name) {
                                var def = find(name);
                                if (def) return def;
                                def = fn.variables.get(name);
                                if (def) {
                                    var sym = def.orig[0];
                                    if (sym instanceof AST_SymbolFunarg || sym instanceof AST_SymbolLambda) return def;
                                }
                            } : function(name) {
                                return find(name) || fn.variables.get(name);
                            });
                        }
                    }
                    return compose(destructured, level + 2, find);
                }
                return compose(parent, level + 1, parent.variables ? function(name) {
                    return find(name) || parent.variables.get(name);
                } : find);
            }
        };
        var for_ins = Object.create(null);
        var in_use = [];
        var in_use_ids = Object.create(null); // avoid expensive linear scans of in_use
        var value_read = Object.create(null);
        var value_modified = Object.create(null);
        if (self instanceof AST_Toplevel && compressor.top_retain) {
            self.variables.each(function(def) {
                if (compressor.top_retain(def) && !(def.id in in_use_ids)) {
                    in_use_ids[def.id] = true;
                    in_use.push(def);
                }
            });
        }
        var assignments = new Dictionary();
        var var_defs_by_id = new Dictionary();
        var initializations = new Dictionary();
        // pass 1: find out which symbols are directly used in
        // this scope (not in nested scopes).
        var scope = this;
        var tw = new TreeWalker(function(node, descend) {
            if (node instanceof AST_Lambda && node.uses_arguments && !tw.has_directive("use strict")) {
                node.each_argname(function(argname) {
                    var def = argname.definition();
                    if (!(def.id in in_use_ids)) {
                        in_use_ids[def.id] = true;
                        in_use.push(def);
                    }
                });
            }
            if (node === self) return;
            if (scope === self) {
                if (is_defun(node)) {
                    var def = node.name.definition();
                    if (!drop_funcs && !(def.id in in_use_ids)) {
                        in_use_ids[def.id] = true;
                        in_use.push(def);
                    }
                    initializations.add(def.id, node);
                    return true; // don't go in nested scopes
                }
                if (node instanceof AST_Definitions) {
                    node.definitions.forEach(function(defn) {
                        var side_effects = defn.value
                            && (defn.name instanceof AST_Destructured || defn.value.has_side_effects(compressor));
                        defn.name.mark_symbol(function(name) {
                            if (!(name instanceof AST_SymbolDeclaration)) return;
                            var def = name.definition();
                            var_defs_by_id.add(def.id, defn);
                            if (node instanceof AST_Var && def.orig[0] instanceof AST_SymbolCatch) {
                                var redef = def.redefined();
                                if (redef) var_defs_by_id.add(redef.id, defn);
                            }
                            if (!(def.id in in_use_ids) && (!drop_vars
                                || (node instanceof AST_Const ? def.redefined() : def.const_redefs)
                                || !(node instanceof AST_Var || is_safe_lexical(def)))) {
                                in_use_ids[def.id] = true;
                                in_use.push(def);
                            }
                            if (defn.value) {
                                if (!side_effects) initializations.add(def.id, defn.value);
                                assignments.add(def.id, defn);
                            }
                            return true;
                        }, tw);
                        if (side_effects) defn.value.walk(tw);
                    });
                    return true;
                }
                if (node instanceof AST_SymbolFunarg) {
                    var def = node.definition();
                    var_defs_by_id.add(def.id, node);
                    assignments.add(def.id, node);
                    return true;
                }
            }
            return scan_ref_scoped(node, descend, true);
        });
        tw.directives = Object.create(compressor.directives);
        self.walk(tw);
        // pass 2: for every used symbol we need to walk its
        // initialization code to figure out if it uses other
        // symbols (that may not be in_use).
        tw = new TreeWalker(scan_ref_scoped);
        for (var i = 0; i < in_use.length; i++) {
            var init = initializations.get(in_use[i].id);
            if (init) init.forEach(function(init) {
                init.walk(tw);
            });
        }
        Object.keys(assign_in_use).forEach(function(id) {
            var assigns = assign_in_use[id];
            if (!assigns) {
                delete assign_in_use[id];
                return;
            }
            assigns = assigns.reduce(function(in_use, assigns) {
                assigns.forEach(function(assign) {
                    push_uniq(in_use, assign);
                });
                return in_use;
            }, []);
            var in_use = (assignments.get(id) || []).filter(function(node) {
                return find_if(node instanceof AST_Unary ? function(assign) {
                    return assign === node;
                } : function(assign) {
                    if (assign === node) return true;
                    if (assign instanceof AST_Unary) return false;
                    return get_rvalue(assign) === get_rvalue(node);
                }, assigns);
            });
            if (assigns.length == in_use.length) {
                assign_in_use[id] = in_use;
            } else {
                delete assign_in_use[id];
            }
        });
        var drop_fn_name = compressor.option("keep_fnames") ? return_false : compressor.option("ie8") ? function(def) {
            return !compressor.exposed(def) && def.references.length == def.replaced;
        } : function(def) {
            if (!(def.id in in_use_ids)) return true;
            if (def.orig.length < 2) return false;
            // function argument will always overshadow its name
            if (def.orig[1] instanceof AST_SymbolFunarg) return true;
            // retain if referenced within destructured object of argument
            return all(def.references, function(ref) {
                return !ref.in_arg;
            });
        };
        // pass 3: we should drop declarations not in_use
        var unused_fn_names = [];
        var calls_to_drop_args = [];
        var fns_with_marked_args = [];
        var trimmer = new TreeTransformer(function(node) {
            if (node instanceof AST_DefaultValue) return trim_default(trimmer, node);
            if (node instanceof AST_DestructuredArray) {
                var trim = true;
                for (var i = node.elements.length; --i >= 0;) {
                    var element = node.elements[i].transform(trimmer);
                    if (element) {
                        node.elements[i] = element;
                        trim = false;
                    } else if (trim) {
                        node.elements.pop();
                    } else {
                        node.elements[i] = make_node(AST_Hole, node.elements[i]);
                    }
                }
                return node;
            }
            if (node instanceof AST_DestructuredKeyVal) {
                var retain = false;
                if (node.key instanceof AST_Node) {
                    node.key = node.key.transform(tt);
                    retain = node.key.has_side_effects(compressor);
                }
                if (retain && is_decl(node.value)) {
                    node.value = node.value.transform(tt);
                } else {
                    var value = node.value.transform(trimmer);
                    if (!value) return List.skip;
                    node.value = value;
                }
                return node;
            }
            if (node instanceof AST_SymbolDeclaration) return node.definition().id in in_use_ids ? node : null;
        });
        var tt = new TreeTransformer(function(node, descend, in_list) {
            var parent = tt.parent();
            if (drop_vars) {
                var props = [], sym = assign_as_unused(node, props);
                if (sym) {
                    var def = sym.definition();
                    var in_use = def.id in in_use_ids;
                    var value;
                    if (node instanceof AST_Assign) {
                        if (!in_use || node.left === sym && indexOf_assign(def, node) < 0) {
                            value = get_rhs(node);
                            if (node.write_only === true) {
                                value = value.drop_side_effect_free(compressor) || make_node(AST_Number, node, {
                                    value: 0
                                });
                            }
                        }
                    } else if (!in_use || node.expression === sym && indexOf_assign(def, node) < 0) {
                        value = make_node(AST_Number, node, {
                            value: 0
                        });
                    }
                    if (value) {
                        if (parent instanceof AST_Sequence && parent.tail_node() !== node) {
                            value = value.drop_side_effect_free(compressor);
                        }
                        if (value) props.push(value);
                        switch (props.length) {
                          case 0:
                            return List.skip;
                          case 1:
                            return maintain_this_binding(compressor, parent, node, props[0].transform(tt));
                          default:
                            return make_sequence(node, props.map(function(prop) {
                                return prop.transform(tt);
                            }));
                        }
                    }
                } else if (node instanceof AST_UnaryPostfix
                    && node.expression instanceof AST_SymbolRef
                    && indexOf_assign(node.expression.definition(), node) < 0) {
                    return make_node(AST_UnaryPrefix, node, {
                        operator: "+",
                        expression: node.expression
                    });
                }
            }
            if (node instanceof AST_Call) calls_to_drop_args.push(node);
            if (scope !== self) return;
            if (node instanceof AST_Lambda) {
                if (drop_funcs && node !== self && is_defun(node)) {
                    var def = node.name.definition();
                    if (!(def.id in in_use_ids)) {
                        log(node.name, "Dropping unused function {name}");
                        def.eliminated++;
                        return in_list ? List.skip : make_node(AST_EmptyStatement, node);
                    }
                }
                if (is_function(node) && node.name && drop_fn_name(node.name.definition())) {
                    unused_fn_names.push(node);
                }
                if (!(node instanceof AST_Accessor)) {
                    var trim = compressor.drop_fargs(node, parent);
                    for (var a = node.argnames, i = a.length; --i >= 0;) {
                        var sym = a[i];
                        if (!(sym instanceof AST_SymbolFunarg)) {
                            var arg = sym.transform(trimmer);
                            if (arg) {
                                trim = false;
                            } else if (trim) {
                                log(sym.name, "Dropping unused function argument {name}");
                                a.pop();
                            } else {
                                sym.name.__unused = true;
                                a[i] = sym.name;
                            }
                            continue;
                        }
                        var def = sym.definition();
                        if (def.id in in_use_ids) {
                            trim = false;
                            if (indexOf_assign(def, sym) < 0) sym.__unused = null;
                        } else if (trim) {
                            log(sym, "Dropping unused function argument {name}");
                            a.pop();
                        } else {
                            sym.__unused = true;
                        }
                    }
                    fns_with_marked_args.push(node);
                }
            }
            if (node instanceof AST_Catch && node.argname instanceof AST_Destructured) {
                node.argname.transform(trimmer);
            }
            if (node instanceof AST_Definitions && !(parent instanceof AST_ForIn && parent.init === node)) {
                // place uninitialized names at the start
                var body = [], head = [], tail = [];
                // for unused names whose initialization has
                // side effects, we can cascade the init. code
                // into the next one, or next statement.
                var side_effects = [];
                var duplicated = 0;
                var is_var = node instanceof AST_Var;
                node.definitions.forEach(function(def) {
                    if (def.value) def.value = def.value.transform(tt);
                    if (def.name instanceof AST_Destructured) {
                        var name = trim_destructured(def.name, def.value, function(node) {
                            if (!drop_vars) return node;
                            if (node.definition().id in in_use_ids) return node;
                            if (is_catch(node)) return node;
                            if (is_var && !can_drop_symbol(node)) return node;
                            return null;
                        });
                        if (name) {
                            flush();
                        } else {
                            var value = def.value.drop_side_effect_free(compressor);
                            if (value) side_effects.push(value);
                        }
                        return;
                    }
                    var sym = def.name.definition();
                    var drop_sym = is_var ? can_drop_symbol(def.name) : is_safe_lexical(sym);
                    if (!drop_sym || !drop_vars || sym.id in in_use_ids) {
                        if (def.value && indexOf_assign(sym, def) < 0) {
                            var write_only = def.value.write_only;
                            var value = def.value.drop_side_effect_free(compressor);
                            if (def.value !== value) {
                                def.value = value && make_sequence(def.value, [
                                    value,
                                    make_node(AST_Number, def.value, {
                                        value: 0
                                    }),
                                ]);
                            } else if (def.value.write_only !== write_only) {
                                def.value.write_only = write_only;
                            }
                        }
                        var old_def, var_defs = var_defs_by_id.get(sym.id);
                        if (!def.value && !(node instanceof AST_Let)) {
                            if (drop_sym && var_defs.length > 1) {
                                AST_Node.info("Dropping declaration of variable {name} [{file}:{line},{col}]", template(def.name));
                                remove(var_defs, def);
                                sym.eliminated++;
                            } else {
                                head.push(def);
                            }
                        } else if (compressor.option("functions")
                            && !compressor.option("ie8")
                            && !(node instanceof AST_Const || node instanceof AST_Let)
                            && var_defs.length == 1
                            && sym.assignments == 0
                            && def.value instanceof AST_Function
                            && (sym.references.length ? all(sym.references, function(ref) {
                                    return def.value === ref.fixed_value();
                                }) : def.value === def.name.fixed_value())
                            && (!def.value.name || (old_def = def.value.name.definition()).assignments == 0
                                && (old_def.name == def.name.name || all(old_def.references, function(ref) {
                                    return ref.scope.find_variable(def.name.name) === def.name.definition();
                                })))
                            && can_declare_defun()
                            && can_rename(def.value, def.name.name)) {
                            AST_Node.warn("Declaring {name} as function [{file}:{line},{col}]", template(def.name));
                            var defun = make_node(AST_Defun, def, def.value);
                            defun.name = make_node(AST_SymbolDefun, def.name, def.name);
                            var name_def = def.name.scope.resolve().def_function(defun.name);
                            if (old_def) old_def.references.forEach(function(node) {
                                node.name = name_def.name;
                                node.thedef = name_def;
                                node.reference({});
                            });
                            body.push(defun);
                        } else {
                            if (drop_sym && var_defs.length > 1 && sym.orig.indexOf(def.name) > sym.eliminated) {
                                remove(var_defs, def);
                                duplicated++;
                            }
                            flush();
                        }
                    } else if (is_catch(def.name)) {
                        var value = def.value && def.value.drop_side_effect_free(compressor);
                        if (value) side_effects.push(value);
                        var var_defs = var_defs_by_id.get(sym.id);
                        if (var_defs.length > 1) {
                            AST_Node.warn("Dropping duplicated declaration of variable {name} [{file}:{line},{col}]", template(def.name));
                            remove(var_defs, def);
                            sym.eliminated++;
                        } else {
                            def.value = null;
                            head.push(def);
                        }
                    } else {
                        var value = def.value && !def.value.single_use && def.value.drop_side_effect_free(compressor);
                        if (value) {
                            AST_Node.warn("Side effects in initialization of unused variable {name} [{file}:{line},{col}]", template(def.name));
                            side_effects.push(value);
                        } else {
                            log(def.name, "Dropping unused variable {name}");
                        }
                        sym.eliminated++;
                    }

                    function is_catch(node) {
                        var sym = node.definition();
                        return sym.orig[0] instanceof AST_SymbolCatch && sym.scope.resolve() === node.scope.resolve();
                    }

                    function can_rename(fn, name) {
                        var def = fn.variables.get(name);
                        return !def || fn.name && def === fn.name.definition();
                    }

                    function can_declare_defun() {
                        if (compressor.has_directive("use strict")) return parent instanceof AST_Scope;
                        return parent instanceof AST_Block
                            || parent instanceof AST_For && parent.init === node
                            || parent instanceof AST_If;
                    }

                    function flush() {
                        if (side_effects.length > 0) {
                            if (tail.length == 0) {
                                body.push(make_node(AST_SimpleStatement, node, {
                                    body: make_sequence(node, side_effects)
                                }));
                            } else if (def.value) {
                                side_effects.push(def.value);
                                def.value = make_sequence(def.value, side_effects);
                            } else {
                                def.value = make_node(AST_UnaryPrefix, def, {
                                    operator: "void",
                                    expression: make_sequence(def, side_effects)
                                });
                            }
                            side_effects = [];
                        }
                        tail.push(def);
                    }
                });
                switch (head.length) {
                  case 0:
                    if (tail.length == 0) break;
                    if (tail.length == duplicated) {
                        [].unshift.apply(side_effects, tail.map(function(def) {
                            AST_Node.warn("Dropping duplicated definition of variable {name} [{file}:{line},{col}]", template(def.name));
                            var sym = def.name.definition();
                            var ref = make_node(AST_SymbolRef, def.name, def.name);
                            sym.references.push(ref);
                            var assign = make_node(AST_Assign, def, {
                                operator: "=",
                                left: ref,
                                right: def.value
                            });
                            var index = indexOf_assign(sym, def);
                            if (index >= 0) assign_in_use[sym.id][index] = assign;
                            sym.eliminated++;
                            return assign;
                        }));
                        break;
                    }
                  case 1:
                    if (tail.length == 0) {
                        var id = head[0].name.definition().id;
                        if (id in for_ins) {
                            node.definitions = head;
                            for_ins[id].init = node;
                            break;
                        }
                    }
                  default:
                    node.definitions = head.concat(tail);
                    body.push(node);
                }
                if (side_effects.length > 0) {
                    body.push(make_node(AST_SimpleStatement, node, {
                        body: make_sequence(node, side_effects)
                    }));
                }
                return insert_statements(body, node, in_list);
            }
            if (node instanceof AST_Assign) {
                descend(node, tt);
                if (node.left instanceof AST_Destructured) {
                    var lhs = trim_destructured(node.left, node.right, function(node) {
                        return node;
                    });
                    if (!lhs) return node.right;
                    node.left = lhs;
                }
                return node;
            }
            if (node instanceof AST_LabeledStatement && node.body instanceof AST_For) {
                // Certain combination of unused name + side effect leads to invalid AST:
                //    https://github.com/mishoo/UglifyJS/issues/1830
                // We fix it at this stage by moving the label inwards, back to the `for`.
                descend(node, tt);
                if (node.body instanceof AST_BlockStatement) {
                    var block = node.body;
                    node.body = block.body.pop();
                    block.body.push(node);
                    return in_list ? List.splice(block.body) : block;
                }
                return node;
            }
            if (node instanceof AST_Scope) {
                var save_scope = scope;
                scope = node;
                descend(node, tt);
                scope = save_scope;
                return node;
            }
        }, function(node, in_list) {
            if (node instanceof AST_BlockStatement) switch (node.body.length) {
              case 0:
                return in_list ? List.skip : make_node(AST_EmptyStatement, node);
              case 1:
                var stat = node.body[0];
                if (!(stat instanceof AST_Const || stat instanceof AST_Let)) return stat;
            } else if (node instanceof AST_For) {
                // Certain combination of unused name + side effect leads to invalid AST:
                //    https://github.com/mishoo/UglifyJS/issues/44
                //    https://github.com/mishoo/UglifyJS/issues/1838
                //    https://github.com/mishoo/UglifyJS/issues/3371
                // We fix it at this stage by moving the `var` outside the `for`.
                var block;
                if (node.init instanceof AST_BlockStatement) {
                    block = node.init;
                    node.init = block.body.pop();
                    block.body.push(node);
                }
                if (node.init instanceof AST_Defun) {
                    if (!block) {
                        block = make_node(AST_BlockStatement, node, {
                            body: [ node ]
                        });
                    }
                    block.body.splice(-1, 0, node.init);
                    node.init = null;
                } else if (node.init instanceof AST_SimpleStatement) {
                    node.init = node.init.body;
                } else if (is_empty(node.init)) {
                    node.init = null;
                }
                return !block ? node : in_list ? List.splice(block.body) : block;
            } else if (node instanceof AST_ForIn) {
                if (!drop_vars || !compressor.option("loops")) return;
                if (!is_empty(node.body)) return;
                var sym = get_init_symbol(node);
                if (!sym) return;
                var def = sym.definition();
                if (def.id in in_use_ids) return;
                log(sym, "Dropping unused loop variable {name}");
                if (for_ins[def.id] === node) delete for_ins[def.id];
                var body = [];
                var value = node.object.drop_side_effect_free(compressor);
                if (value) {
                    AST_Node.warn("Side effects in object of for-in loop [{file}:{line},{col}]", value.start);
                    body.push(make_node(AST_SimpleStatement, node, {
                        body: value
                    }));
                }
                if (node.init instanceof AST_Definitions && def.orig[0] instanceof AST_SymbolCatch) {
                    body.push(node.init);
                }
                return insert_statements(body, node, in_list);
            } else if (node instanceof AST_Sequence) {
                if (node.expressions.length == 1) return node.expressions[0];
            }
        });
        tt.push(compressor.parent());
        self.transform(tt);
        if (self instanceof AST_Lambda
            && self.body.length == 1
            && self.body[0] instanceof AST_Directive
            && self.body[0].value == "use strict") {
            self.body.length = 0;
        }
        unused_fn_names.forEach(function(fn) {
            fn.name = null;
        });
        calls_to_drop_args.forEach(function(call) {
            drop_unused_call_args(call, compressor, fns_with_marked_args);
        });

        function log(sym, text) {
            AST_Node[sym.definition().references.length > 0 ? "info" : "warn"](text + " [{file}:{line},{col}]", template(sym));
        }

        function template(sym) {
            return {
                name: sym.name,
                file: sym.start.file,
                line: sym.start.line,
                col : sym.start.col,
            };
        }

        function insert_statements(body, orig, in_list) {
            switch (body.length) {
              case 0:
                return in_list ? List.skip : make_node(AST_EmptyStatement, orig);
              case 1:
                return body[0];
              default:
                return in_list ? List.splice(body) : make_node(AST_BlockStatement, orig, {
                    body: body
                });
            }
        }

        function track_assigns(def, node) {
            if (def.scope !== self) return false;
            if (!def.fixed || !node.fixed) assign_in_use[def.id] = false;
            return assign_in_use[def.id] !== false;
        }

        function add_assigns(def, node) {
            if (!assign_in_use[def.id]) assign_in_use[def.id] = [];
            if (node.fixed.assigns) push_uniq(assign_in_use[def.id], node.fixed.assigns);
        }

        function indexOf_assign(def, node) {
            var nodes = assign_in_use[def.id];
            return nodes && nodes.indexOf(node);
        }

        function verify_safe_usage(def, read, modified) {
            if (def.id in in_use_ids) return;
            if (read && modified) {
                in_use_ids[def.id] = true;
                in_use.push(def);
            } else {
                value_read[def.id] = read;
                value_modified[def.id] = modified;
            }
        }

        function get_rhs(assign) {
            var rhs = assign.right;
            if (!assign.write_only) return rhs;
            if (!(rhs instanceof AST_Binary && lazy_op[rhs.operator])) return rhs;
            if (!(rhs.left instanceof AST_SymbolRef)) return rhs;
            if (!(assign.left instanceof AST_SymbolRef)) return rhs;
            var def = assign.left.definition();
            if (rhs.left.definition() !== def) return rhs;
            if (rhs.right.has_side_effects(compressor)) return rhs;
            if (track_assigns(def, rhs.left)) add_assigns(def, rhs.left);
            return rhs.right;
        }

        function get_init_symbol(for_in) {
            var init = for_in.init;
            if (init instanceof AST_Definitions) {
                init = init.definitions[0].name;
                return init instanceof AST_SymbolDeclaration && init;
            }
            while (init instanceof AST_PropAccess) init = init.expression.tail_node();
            if (init instanceof AST_SymbolRef) return init;
        }

        function scan_ref_scoped(node, descend, init) {
            if (node instanceof AST_Assign && node.left instanceof AST_SymbolRef) {
                var def = node.left.definition();
                if (def.scope === self) assignments.add(def.id, node);
            }
            if (node instanceof AST_Unary && node.expression instanceof AST_SymbolRef) {
                var def = node.expression.definition();
                if (def.scope === self) assignments.add(def.id, node);
            }
            var node_def, props = [], sym = assign_as_unused(node, props);
            if (sym && self.variables.get(sym.name) === (node_def = sym.definition())
                && !(is_arguments(node_def) && !all(self.argnames, function(argname) {
                    return !argname.match_symbol(function(node) {
                        if (node instanceof AST_SymbolFunarg) {
                            var def = node.definition();
                            return def.references.length > def.replaced;
                        }
                    }, true);
                }))) {
                props.forEach(function(prop) {
                    prop.walk(tw);
                });
                if (node instanceof AST_Assign) {
                    if (node.write_only === "p" && node.right.may_throw_on_access(compressor)) return;
                    var right = get_rhs(node);
                    if (init && node.write_only === true && node_def.scope === self && !right.has_side_effects(compressor)) {
                        initializations.add(node_def.id, right);
                    } else {
                        right.walk(tw);
                    }
                    if (node.left === sym) {
                        if (!node.write_only) {
                            verify_safe_usage(node_def, true, value_modified[node_def.id]);
                        }
                    } else {
                        var fixed = sym.fixed_value();
                        if (!fixed || !fixed.is_constant()) {
                            verify_safe_usage(node_def, value_read[node_def.id], true);
                        }
                    }
                }
                if (track_assigns(node_def, sym) && is_lhs(sym, node) !== sym) add_assigns(node_def, sym);
                return true;
            }
            if (node instanceof AST_ForIn) {
                if (node.init instanceof AST_SymbolRef && scope === self) {
                    var id = node.init.definition().id;
                    if (!(id in for_ins)) for_ins[id] = node;
                }
                if (!drop_vars || !compressor.option("loops")) return;
                if (!is_empty(node.body)) return;
                if (node.init.has_side_effects(compressor)) return;
                var sym = get_init_symbol(node);
                if (!sym) return;
                var def = sym.definition();
                if (def.scope !== self) {
                    var d = find_variable(sym.name);
                    if ((d && d.redefined() || d) === def) return;
                }
                node.object.walk(tw);
                return true;
            }
            if (node instanceof AST_SymbolRef) {
                node_def = node.definition();
                if (!(node_def.id in in_use_ids)) {
                    in_use_ids[node_def.id] = true;
                    in_use.push(node_def);
                }
                if (cross_scope(node_def.scope, node.scope)) {
                    var redef = node_def.redefined();
                    if (redef && !(redef.id in in_use_ids)) {
                        in_use_ids[redef.id] = true;
                        in_use.push(redef);
                    }
                }
                if (track_assigns(node_def, node)) add_assigns(node_def, node);
                return true;
            }
            if (node instanceof AST_Scope) {
                var save_scope = scope;
                scope = node;
                descend();
                scope = save_scope;
                return true;
            }
        }

        function is_decl(node) {
            return (node instanceof AST_DefaultValue ? node.name : node) instanceof AST_SymbolDeclaration;
        }

        function trim_default(trimmer, node) {
            node.value = node.value.transform(tt);
            var name = node.name.transform(trimmer);
            if (!name) {
                var value = node.value.drop_side_effect_free(compressor);
                if (!value) return null;
                name = node.name;
                if (name instanceof AST_Destructured) {
                    name = name.clone();
                    name[name instanceof AST_DestructuredArray ? "elements" : "properties"] = [];
                    if (!(value instanceof AST_Array || value.is_string(compressor)
                        || name instanceof AST_DestructuredObject
                            && (value instanceof AST_Object
                                || value.is_boolean(compressor)
                                || value.is_number(compressor)))) {
                        value = make_node(AST_Array, value, {
                            elements: [ value ],
                        });
                    }
                    node.name = name;
                } else {
                    log(name, "Side effects in default value of unused variable {name}");
                }
                node.value = value;
            }
            return node;
        }

        function trim_destructured(node, value, process) {
            var trimmer = new TreeTransformer(function(node) {
                if (node instanceof AST_DefaultValue) {
                    if (compressor.option("default_values") && value && value.is_defined(compressor)) {
                        node = node.name;
                    } else {
                        return trim_default(trimmer, node);
                    }
                }
                if (node instanceof AST_DestructuredArray) {
                    var save = value;
                    if (value instanceof AST_SymbolRef) value = value.fixed_value();
                    var values = value instanceof AST_Array && value.elements;
                    var elements = [];
                    node.elements.forEach(function(element, index) {
                        if (element instanceof AST_Hole) return;
                        value = values && values[index];
                        element = element.transform(trimmer);
                        if (element) elements[index] = element;
                    });
                    value = save;
                    if (values && elements.length == 0) return null;
                    for (var i = elements.length; --i >= 0;) {
                        if (!elements[i]) elements[i] = make_node(AST_Hole, node.elements[i] || node);
                    }
                    node.elements = elements;
                    return node;
                }
                if (node instanceof AST_DestructuredObject) {
                    var save = value;
                    if (value instanceof AST_SymbolRef) value = value.fixed_value();
                    var values;
                    if (value instanceof AST_Object) {
                        values = Object.create(null);
                        for (var i = 0; i < value.properties.length; i++) {
                            var prop = value.properties[i];
                            if (typeof prop.key != "string") {
                                values = null;
                                break;
                            }
                            values[prop.key] = prop.value;
                        }
                    }
                    var properties = [];
                    node.properties.forEach(function(prop) {
                        var retain;
                        if (prop.key instanceof AST_Node) {
                            prop.key = prop.key.transform(tt);
                            value = null;
                            retain = prop.key.has_side_effects(compressor);
                        } else {
                            value = values && values[prop.key];
                            retain = false;
                        }
                        if (retain && is_decl(prop.value)) {
                            prop.value = prop.value.transform(tt);
                            properties.push(prop);
                        } else {
                            var newValue = prop.value.transform(trimmer);
                            if (newValue) {
                                prop.value = newValue;
                                properties.push(prop);
                            }
                        }
                    });
                    value = save;
                    if (properties.length == 0 && value && !value.may_throw_on_access(compressor)) {
                        return null;
                    }
                    node.properties = properties;
                    return node;
                }
                return process(node);
            });
            return node.transform(trimmer);
        }
    });

    AST_Scope.DEFMETHOD("hoist_declarations", function(compressor) {
        if (compressor.has_directive("use asm")) return;
        var hoist_funs = compressor.option("hoist_funs");
        var hoist_vars = compressor.option("hoist_vars");
        var self = this;
        if (hoist_vars) {
            // let's count var_decl first, we seem to waste a lot of
            // space if we hoist `var` when there's only one.
            var var_decl = 0;
            self.walk(new TreeWalker(function(node) {
                if (var_decl > 1) return true;
                if (node instanceof AST_Scope && node !== self) return true;
                if (node instanceof AST_Var) {
                    var_decl++;
                    return true;
                }
            }));
            if (var_decl <= 1) hoist_vars = false;
        }
        if (!hoist_funs && !hoist_vars) return;
        var consts = Object.create(null);
        var dirs = [];
        var hoisted = [];
        var vars = new Dictionary(), vars_found = 0;
        var tt = new TreeTransformer(function(node) {
            if (node === self) return;
            if (node instanceof AST_Directive) {
                dirs.push(node);
                return make_node(AST_EmptyStatement, node);
            }
            if (hoist_funs && node instanceof AST_Defun
                && (tt.parent() === self || !compressor.has_directive("use strict"))) {
                hoisted.push(node);
                return make_node(AST_EmptyStatement, node);
            }
            if (hoist_vars && node instanceof AST_Var) {
                if (!all(node.definitions, function(defn) {
                    var sym = defn.name;
                    return sym instanceof AST_SymbolVar
                        && !consts[sym.name]
                        && self.find_variable(sym.name) === sym.definition();
                })) return node;
                node.definitions.forEach(function(def) {
                    vars.set(def.name.name, def);
                    ++vars_found;
                });
                var seq = node.to_assignments();
                var p = tt.parent();
                if (p instanceof AST_ForIn && p.init === node) {
                    if (seq) return seq;
                    var def = node.definitions[0].name;
                    return make_node(AST_SymbolRef, def, def);
                }
                if (p instanceof AST_For && p.init === node) return seq;
                if (!seq) return make_node(AST_EmptyStatement, node);
                return make_node(AST_SimpleStatement, node, {
                    body: seq
                });
            }
            if (node instanceof AST_Scope) return node;
            if (node instanceof AST_SymbolConst) {
                consts[node.name] = true;
                return node;
            }
        });
        self.transform(tt);
        if (vars_found > 0) {
            // collect only vars which don't show up in self's arguments list
            var defs = [];
            vars.each(function(def, name) {
                if (self instanceof AST_Lambda
                    && !all(self.argnames, function(argname) {
                        return argname.name != name;
                    })) {
                    vars.del(name);
                } else {
                    def = def.clone();
                    def.value = null;
                    defs.push(def);
                    vars.set(name, def);
                }
            });
            if (defs.length > 0) {
                // try to merge in assignments
                insert_vars(self.body);
                defs = make_node(AST_Var, self, {
                    definitions: defs
                });
                hoisted.push(defs);
            }
        }
        self.body = dirs.concat(hoisted, self.body);

        function insert_vars(body) {
            while (body.length) {
                var stat = body[0];
                if (stat instanceof AST_SimpleStatement) {
                    var expr = stat.body, sym, assign;
                    if (expr instanceof AST_Assign
                        && expr.operator == "="
                        && (sym = expr.left) instanceof AST_Symbol
                        && vars.has(sym.name)) {
                        var def = vars.get(sym.name);
                        if (def.value) break;
                        def.value = expr.right;
                        remove(defs, def);
                        defs.push(def);
                        body.shift();
                        continue;
                    }
                    if (expr instanceof AST_Sequence
                        && (assign = expr.expressions[0]) instanceof AST_Assign
                        && assign.operator == "="
                        && (sym = assign.left) instanceof AST_Symbol
                        && vars.has(sym.name)) {
                        var def = vars.get(sym.name);
                        if (def.value) break;
                        def.value = assign.right;
                        remove(defs, def);
                        defs.push(def);
                        stat.body = make_sequence(expr, expr.expressions.slice(1));
                        continue;
                    }
                }
                if (stat instanceof AST_EmptyStatement) {
                    body.shift();
                    continue;
                }
                if (stat instanceof AST_BlockStatement && !insert_vars(stat.body)) {
                    body.shift();
                    continue;
                }
                break;
            }
            return body.length;
        }
    });

    function scan_local_returns(fn, transform) {
        fn.walk(new TreeWalker(function(node) {
            if (node instanceof AST_Return) {
                transform(node);
                return true;
            }
            if (node instanceof AST_Scope && node !== fn) return true;
        }));
    }

    function map_bool_returns(fn) {
        var map = Object.create(null);
        scan_local_returns(fn, function(node) {
            var value = node.value;
            if (value) value = value.tail_node();
            if (value instanceof AST_SymbolRef) {
                var id = value.definition().id;
                map[id] = (map[id] || 0) + 1;
            }
        });
        return map;
    }

    function all_bool(def, bool_returns, compressor) {
        return def.bool_fn + (bool_returns[def.id] || 0) === def.references.length - def.replaced
            && !compressor.exposed(def);
    }

    function process_boolean_returns(fn, compressor) {
        scan_local_returns(fn, function(node) {
            node.in_bool = true;
            var value = node.value;
            if (value) {
                var ev = value.is_truthy() || value.evaluate(compressor, true);
                if (!ev) {
                    value = value.drop_side_effect_free(compressor);
                    node.value = value ? make_sequence(node.value, [
                        value,
                        make_node(AST_Number, node.value, {
                            value: 0
                        })
                    ]) : null;
                } else if (ev && !(ev instanceof AST_Node)) {
                    value = value.drop_side_effect_free(compressor);
                    node.value = value ? make_sequence(node.value, [
                        value,
                        make_node(AST_Number, node.value, {
                            value: 1
                        })
                    ]) : make_node(AST_Number, node.value, {
                        value: 1
                    });
                }
            }
        });
    }

    AST_Scope.DEFMETHOD("process_boolean_returns", noop);
    AST_Defun.DEFMETHOD("process_boolean_returns", function(compressor) {
        if (!compressor.option("booleans")) return;
        var bool_returns = map_bool_returns(this);
        if (!all_bool(this.name.definition(), bool_returns, compressor)) return;
        process_boolean_returns(this, compressor);
    });
    AST_Function.DEFMETHOD("process_boolean_returns", function(compressor) {
        if (!compressor.option("booleans")) return;
        var bool_returns = map_bool_returns(this);
        if (this.name && !all_bool(this.name.definition(), bool_returns, compressor)) return;
        var parent = compressor.parent();
        if (parent instanceof AST_Assign) {
            if (parent.operator != "=") return;
            var sym = parent.left;
            if (!(sym instanceof AST_SymbolRef)) return;
            if (!all_bool(sym.definition(), bool_returns, compressor)) return;
        } else if (parent instanceof AST_Call && parent.expression !== this) {
            var exp = parent.expression;
            if (exp instanceof AST_SymbolRef) exp = exp.fixed_value();
            if (!(exp instanceof AST_Lambda)) return;
            if (exp.uses_arguments || exp.pinned()) return;
            var sym = exp.argnames[parent.args.indexOf(this)];
            if (sym instanceof AST_DefaultValue) sym = sym.name;
            if (sym instanceof AST_SymbolFunarg && !all_bool(sym.definition(), bool_returns, compressor)) return;
        } else if (parent.TYPE == "Call") {
            compressor.pop();
            var in_bool = compressor.in_boolean_context();
            compressor.push(this);
            if (!in_bool) return;
        } else return;
        process_boolean_returns(this, compressor);
    });

    AST_BlockScope.DEFMETHOD("var_names", function() {
        var var_names = this._var_names;
        if (!var_names) {
            this._var_names = var_names = Object.create(null);
            this.enclosed.forEach(function(def) {
                var_names[def.name] = true;
            });
            this.variables.each(function(def, name) {
                var_names[name] = true;
            });
        }
        return var_names;
    });

    AST_Scope.DEFMETHOD("make_var", function(type, orig, prefix) {
        var scopes = [ this ];
        if (orig instanceof AST_SymbolDeclaration) orig.definition().references.forEach(function(ref) {
            var s = ref.scope;
            if (member(s, scopes)) return;
            do {
                push_uniq(scopes, s);
                s = s.parent_scope;
            } while (s && s !== this);
        });
        prefix = prefix.replace(/(?:^[^a-z_$]|[^a-z0-9_$])/ig, "_");
        var name = prefix;
        for (var i = 0; !all(scopes, function(scope) {
            return !scope.var_names()[name];
        }); i++) name = prefix + "$" + i;
        var sym = make_node(type, orig, {
            name: name,
            scope: this,
        });
        var def = this.def_variable(sym);
        scopes.forEach(function(scope) {
            scope.enclosed.push(def);
            scope.var_names()[name] = true;
        });
        return sym;
    });

    AST_Scope.DEFMETHOD("hoist_properties", function(compressor) {
        if (!compressor.option("hoist_props") || compressor.has_directive("use asm")) return;
        var self = this;
        var top_retain = self instanceof AST_Toplevel && compressor.top_retain || return_false;
        var defs_by_id = Object.create(null);
        self.transform(new TreeTransformer(function(node, descend) {
            if (node instanceof AST_Assign) {
                if (node.operator != "=") return;
                if (!node.write_only) return;
                if (node.left.scope !== self) return;
                if (!can_hoist(node.left, node.right, 1)) return;
                descend(node, this);
                var defs = new Dictionary();
                var assignments = [];
                var decls = [];
                node.right.properties.forEach(function(prop) {
                    var decl = make_sym(node.left, prop.key);
                    decls.push(make_node(AST_VarDef, node, {
                        name: decl,
                        value: null
                    }));
                    var sym = make_node(AST_SymbolRef, node, {
                        name: decl.name,
                        scope: self,
                        thedef: decl.definition()
                    });
                    sym.reference({});
                    assignments.push(make_node(AST_Assign, node, {
                        operator: "=",
                        left: sym,
                        right: prop.value
                    }));
                });
                defs_by_id[node.left.definition().id] = defs;
                self.body.splice(self.body.indexOf(this.stack[1]) + 1, 0, make_node(AST_Var, node, {
                    definitions: decls
                }));
                return make_sequence(node, assignments);
            }
            if (node instanceof AST_Scope) return node === self ? undefined : node;
            if (node instanceof AST_VarDef) {
                if (!can_hoist(node.name, node.value, 0)) return;
                descend(node, this);
                var defs = new Dictionary();
                var var_defs = [];
                node.value.properties.forEach(function(prop) {
                    var_defs.push(make_node(AST_VarDef, node, {
                        name: make_sym(node.name, prop.key),
                        value: prop.value
                    }));
                });
                defs_by_id[node.name.definition().id] = defs;
                return List.splice(var_defs);
            }

            function make_sym(sym, key) {
                var new_var = self.make_var(AST_SymbolVar, sym, sym.name + "_" + key);
                defs.set(key, new_var.definition());
                return new_var;
            }
        }));
        self.transform(new TreeTransformer(function(node, descend) {
            if (node instanceof AST_Binary) return replace("right");
            if (node instanceof AST_PropAccess) {
                if (!(node.expression instanceof AST_SymbolRef)) return;
                var defs = defs_by_id[node.expression.definition().id];
                if (!defs) return;
                var def = defs.get(node.getProperty());
                var sym = make_node(AST_SymbolRef, node, {
                    name: def.name,
                    scope: node.expression.scope,
                    thedef: def
                });
                sym.reference({});
                return sym;
            }
            if (node instanceof AST_Unary) {
                if (unary_side_effects[node.operator]) return;
                return replace("expression");
            }

            function replace(prop) {
                var sym = node[prop];
                if (!(sym instanceof AST_SymbolRef)) return;
                if (!(sym.definition().id in defs_by_id)) return;
                var opt = node.clone();
                opt[prop] = make_node(AST_Object, sym, {
                    properties: []
                });
                return opt;
            }
        }));

        function can_hoist(sym, right, count) {
            if (!(sym instanceof AST_Symbol)) return;
            var def = sym.definition();
            if (def.assignments != count) return;
            if (def.direct_access) return;
            if (def.escaped.depth == 1) return;
            if (def.references.length - def.replaced == count) return;
            if (def.single_use) return;
            if (top_retain(def)) return;
            if (sym.fixed_value() !== right) return;
            return right instanceof AST_Object
                && right.properties.length > 0
                && all(right.properties, function(prop) {
                    return prop instanceof AST_ObjectKeyVal && typeof prop.key == "string";
                })
                && all(def.references, function(ref) {
                    return ref.fixed_value() === right;
                })
                && can_drop_symbol(sym);
        }
    });

    function fn_name_unused(fn, compressor) {
        if (!fn.name || !compressor.option("ie8")) return true;
        var def = fn.name.definition();
        if (compressor.exposed(def)) return false;
        return all(def.references, function(sym) {
            return !(sym instanceof AST_SymbolRef);
        });
    }

    // drop_side_effect_free()
    // remove side-effect-free parts which only affects return value
    (function(def) {
        // Drop side-effect-free elements from an array of expressions.
        // Returns an array of expressions with side-effects or null
        // if all elements were dropped. Note: original array may be
        // returned if nothing changed.
        function trim(nodes, compressor, first_in_statement, spread) {
            var len = nodes.length;
            if (!len) return null;
            var ret = [], changed = false;
            for (var i = 0; i < len; i++) {
                var node = nodes[i];
                var trimmed;
                if (spread && node instanceof AST_Spread) {
                    trimmed = spread(node, compressor, first_in_statement);
                } else {
                    trimmed = node.drop_side_effect_free(compressor, first_in_statement);
                }
                if (trimmed !== node) changed = true;
                if (trimmed) {
                    ret.push(trimmed);
                    first_in_statement = false;
                }
            }
            return changed ? ret.length ? ret : null : nodes;
        }
        function array_spread(node, compressor, first_in_statement) {
            var exp = node.expression;
            if (!exp.is_string(compressor)) return node;
            return exp.drop_side_effect_free(compressor, first_in_statement);
        }
        function convert_spread(node) {
            return node instanceof AST_Spread ? make_node(AST_Array, node, {
                elements: [ node ]
            }) : node;
        }
        def(AST_Node, return_this);
        def(AST_Accessor, return_null);
        def(AST_Array, function(compressor, first_in_statement) {
            var values = trim(this.elements, compressor, first_in_statement, array_spread);
            if (!values) return null;
            if (values === this.elements && all(values, function(node) {
                return node instanceof AST_Spread;
            })) return this;
            return make_sequence(this, values.map(convert_spread));
        });
        def(AST_Arrow, return_null);
        def(AST_Assign, function(compressor) {
            var left = this.left;
            if (left instanceof AST_PropAccess) {
                var expr = left.expression;
                if (expr instanceof AST_Assign && expr.operator == "=" && !expr.may_throw_on_access(compressor)) {
                    expr.write_only = "p";
                }
                if (compressor.has_directive("use strict") && expr.is_constant()) return this;
            }
            if (left.has_side_effects(compressor)) return this;
            this.write_only = true;
            if (root_expr(left).is_constant_expression(compressor.find_parent(AST_Scope))) {
                return this.right.drop_side_effect_free(compressor);
            }
            return this;
        });
        def(AST_AsyncFunction, return_null);
        def(AST_Binary, function(compressor, first_in_statement) {
            if (this.operator == "in" && !is_object(this.right)) {
                var left = this.left.drop_side_effect_free(compressor, first_in_statement);
                if (left === this.left) return this;
                var node = this.clone();
                node.left = left || make_node(AST_Number, this.left, {
                    value: 0
                });
                return node;
            }
            var right = this.right.drop_side_effect_free(compressor, first_in_statement);
            if (!right) return this.left.drop_side_effect_free(compressor, first_in_statement);
            if (lazy_op[this.operator] && !(right instanceof AST_Function)) {
                var node = this;
                if (right !== node.right) {
                    node = this.clone();
                    node.right = right.drop_side_effect_free(compressor);
                }
                return (first_in_statement ? best_of_statement : best_of_expression)(node, make_node(AST_Binary, this, {
                    operator: node.operator == "&&" ? "||" : "&&",
                    left: node.left.negate(compressor, first_in_statement),
                    right: node.right
                }));
            } else {
                var left = this.left.drop_side_effect_free(compressor, first_in_statement);
                if (!left) return right;
                return make_sequence(this, [ left, right.drop_side_effect_free(compressor) ]);
            }
        });
        def(AST_Call, function(compressor, first_in_statement) {
            var self = this;
            if (self.is_expr_pure(compressor)) {
                if (self.pure) AST_Node.warn("Dropping __PURE__ call [{file}:{line},{col}]", self.start);
                var args = trim(self.args, compressor, first_in_statement, array_spread);
                return args && make_sequence(self, args.map(convert_spread));
            }
            var exp = self.expression;
            if (self.is_call_pure(compressor)) {
                var exprs = self.args.slice();
                exprs.unshift(exp.expression);
                exprs = trim(exprs, compressor, first_in_statement, array_spread);
                return exprs && make_sequence(self, exprs.map(convert_spread));
            }
            var def;
            if (exp instanceof AST_Function
                && !(exp.name && (def = exp.name.definition()).references.length > def.replaced)) {
                exp.process_expression(false, function(node) {
                    var value = node.value && node.value.drop_side_effect_free(compressor, true);
                    return value ? make_node(AST_SimpleStatement, node, {
                        body: value
                    }) : make_node(AST_EmptyStatement, node);
                });
                scan_local_returns(exp, function(node) {
                    if (node.value) node.value = node.value.drop_side_effect_free(compressor);
                });
                // always shallow clone to ensure stripping of negated IIFEs
                self = self.clone();
                self.expression = exp.clone();
            }
            if (self instanceof AST_New) {
                var fn = exp;
                if (fn instanceof AST_SymbolRef) fn = fn.fixed_value();
                if (fn instanceof AST_Lambda) {
                    fn.new = true;
                    var assign_this_only = all(fn.body, function(stat) {
                        return !stat.has_side_effects(compressor);
                    });
                    delete fn.new;
                    if (assign_this_only) {
                        var exprs = self.args.slice();
                        exprs.unshift(exp);
                        exprs = trim(exprs, compressor, first_in_statement, array_spread);
                        return exprs && make_sequence(self, exprs.map(convert_spread));
                    }
                    if (!fn.contains_this()) return make_node(AST_Call, self, self);
                }
            }
            return self;
        });
        def(AST_Conditional, function(compressor) {
            var consequent = this.consequent.drop_side_effect_free(compressor);
            var alternative = this.alternative.drop_side_effect_free(compressor);
            if (consequent === this.consequent && alternative === this.alternative) return this;
            var exprs;
            if (compressor.option("ie8")) {
                exprs = [];
                if (consequent instanceof AST_Function) {
                    exprs.push(consequent);
                    consequent = null;
                }
                if (alternative instanceof AST_Function) {
                    exprs.push(alternative);
                    alternative = null;
                }
            }
            var node;
            if (!consequent) {
                node = alternative ? make_node(AST_Binary, this, {
                    operator: "||",
                    left: this.condition,
                    right: alternative
                }) : this.condition.drop_side_effect_free(compressor);
            } else if (!alternative) {
                node = make_node(AST_Binary, this, {
                    operator: "&&",
                    left: this.condition,
                    right: consequent
                });
            } else {
                node = this.clone();
                node.consequent = consequent;
                node.alternative = alternative;
            }
            if (!compressor.option("ie8")) return node;
            if (node) exprs.push(node);
            return exprs.length == 0 ? null : make_sequence(this, exprs);
        });
        def(AST_Constant, return_null);
        def(AST_Dot, function(compressor, first_in_statement) {
            var expr = this.expression;
            if (expr.may_throw_on_access(compressor)) return this;
            return expr.drop_side_effect_free(compressor, first_in_statement);
        });
        def(AST_Function, function(compressor) {
            return fn_name_unused(this, compressor) ? null : this;
        });
        def(AST_Object, function(compressor, first_in_statement) {
            var exprs = [];
            this.properties.forEach(function(prop) {
                if (prop instanceof AST_Spread) {
                    exprs.push(prop);
                } else {
                    if (prop.key instanceof AST_Node) exprs.push(prop.key);
                    exprs.push(prop.value);
                }
            });
            var values = trim(exprs, compressor, first_in_statement, function(node, compressor, first_in_statement) {
                var exp = node.expression;
                return spread_side_effects(exp) ? node : exp.drop_side_effect_free(compressor, first_in_statement);
            });
            if (!values) return null;
            if (values === exprs && !all(values, function(node) {
                return !(node instanceof AST_Spread);
            })) return this;
            return make_sequence(this, values.map(function(node) {
                return node instanceof AST_Spread ? make_node(AST_Object, node, {
                    properties: [ node ],
                }) : node;
            }));
        });
        def(AST_Sequence, function(compressor, first_in_statement) {
            var expressions = trim(this.expressions, compressor, first_in_statement);
            if (!expressions) return null;
            var end = expressions.length - 1;
            var assign, cond, lhs;
            if (compressor.option("conditionals")
                && end > 0
                && (assign = expressions[end - 1]) instanceof AST_Assign
                && assign.operator == "="
                && (lhs = assign.left) instanceof AST_SymbolRef
                && (cond = to_conditional_assignment(compressor, lhs.definition(), assign.right, expressions[end]))) {
                assign = assign.clone();
                assign.right = cond;
                expressions = expressions.slice(0, -2);
                expressions.push(assign);
            }
            return expressions === this.expressions ? this : make_sequence(this, expressions);
        });
        def(AST_Sub, function(compressor, first_in_statement) {
            if (this.expression.may_throw_on_access(compressor)) return this;
            var expression = this.expression.drop_side_effect_free(compressor, first_in_statement);
            if (!expression) return this.property.drop_side_effect_free(compressor, first_in_statement);
            var property = this.property.drop_side_effect_free(compressor);
            if (!property) return expression;
            return make_sequence(this, [ expression, property ]);
        });
        def(AST_SymbolRef, function(compressor) {
            return this.is_declared(compressor) && can_drop_symbol(this) ? null : this;
        });
        def(AST_This, return_null);
        def(AST_Unary, function(compressor, first_in_statement) {
            var exp = this.expression;
            if (unary_side_effects[this.operator]) {
                this.write_only = !exp.has_side_effects(compressor);
                return this;
            }
            if (this.operator == "typeof" && exp instanceof AST_SymbolRef && can_drop_symbol(exp)) return null;
            var node = exp.drop_side_effect_free(compressor, first_in_statement);
            if (first_in_statement && node && is_iife_call(node)) {
                if (node === exp && this.operator == "!") return this;
                return node.negate(compressor, first_in_statement);
            }
            return node;
        });
    })(function(node, func) {
        node.DEFMETHOD("drop_side_effect_free", func);
    });

    OPT(AST_SimpleStatement, function(self, compressor) {
        if (compressor.option("side_effects")) {
            var body = self.body;
            var node = body.drop_side_effect_free(compressor, true);
            if (!node) {
                AST_Node.warn("Dropping side-effect-free statement [{file}:{line},{col}]", self.start);
                return make_node(AST_EmptyStatement, self);
            }
            if (node !== body) {
                return make_node(AST_SimpleStatement, self, { body: node });
            }
        }
        return self;
    });

    OPT(AST_While, function(self, compressor) {
        return compressor.option("loops") ? make_node(AST_For, self, self).optimize(compressor) : self;
    });

    function has_loop_control(loop, parent, type) {
        if (!type) type = AST_LoopControl;
        var found = false;
        var tw = new TreeWalker(function(node) {
            if (found || node instanceof AST_Scope) return true;
            if (node instanceof type && tw.loopcontrol_target(node) === loop) {
                return found = true;
            }
        });
        if (parent instanceof AST_LabeledStatement) tw.push(parent);
        tw.push(loop);
        loop.body.walk(tw);
        return found;
    }

    OPT(AST_Do, function(self, compressor) {
        if (!compressor.option("loops")) return self;
        var cond = self.condition.is_truthy() || self.condition.evaluate(compressor, true);
        if (!(cond instanceof AST_Node)) {
            if (cond && !has_loop_control(self, compressor.parent(), AST_Continue)) return make_node(AST_For, self, {
                body: make_node(AST_BlockStatement, self.body, {
                    body: [
                        self.body,
                        make_node(AST_SimpleStatement, self.condition, {
                            body: self.condition
                        }),
                    ]
                })
            }).optimize(compressor);
            if (!has_loop_control(self, compressor.parent())) return make_node(AST_BlockStatement, self.body, {
                body: [
                    self.body,
                    make_node(AST_SimpleStatement, self.condition, {
                        body: self.condition
                    }),
                ]
            }).optimize(compressor);
        }
        if (self.body instanceof AST_BlockStatement && !has_loop_control(self, compressor.parent(), AST_Continue)) {
            var body = self.body.body;
            for (var i = body.length; --i >= 0;) {
                var stat = body[i];
                if (stat instanceof AST_If
                    && !stat.alternative
                    && stat.body instanceof AST_Break
                    && compressor.loopcontrol_target(stat.body) === self) {
                    if (has_block_scope_refs(stat.condition)) break;
                    self.condition = make_node(AST_Binary, self, {
                        operator: "&&",
                        left: stat.condition.negate(compressor),
                        right: self.condition,
                    });
                    body.splice(i, 1);
                } else if (stat instanceof AST_SimpleStatement) {
                    if (has_block_scope_refs(stat.body)) break;
                    self.condition = make_sequence(self, [
                        stat.body,
                        self.condition,
                    ]);
                    body.splice(i, 1);
                } else if (!is_declaration(stat)) {
                    break;
                }
            }
            self.body = trim_block(self.body);
        }
        if (self.body instanceof AST_EmptyStatement) return make_node(AST_For, self, self).optimize(compressor);
        if (self.body instanceof AST_SimpleStatement) return make_node(AST_For, self, {
            condition: make_sequence(self.condition, [
                self.body.body,
                self.condition
            ]),
            body: make_node(AST_EmptyStatement, self)
        }).optimize(compressor);
        return self;

        function has_block_scope_refs(node) {
            var found = false;
            node.walk(new TreeWalker(function(node) {
                if (found) return true;
                if (node instanceof AST_SymbolRef) {
                    if (!member(node.definition(), self.enclosed)) found = true;
                    return true;
                }
            }));
            return found;
        }
    });

    function if_break_in_loop(self, compressor) {
        var first = first_statement(self.body);
        if (compressor.option("dead_code")
            && (first instanceof AST_Break
                || first instanceof AST_Continue && external_target(first)
                || first instanceof AST_Exit)) {
            var body = [];
            if (self.init instanceof AST_Statement) {
                body.push(self.init);
            } else if (self.init) {
                body.push(make_node(AST_SimpleStatement, self.init, {
                    body: self.init
                }));
            }
            var retain = external_target(first) || first instanceof AST_Exit;
            if (self.condition && retain) {
                body.push(make_node(AST_If, self, {
                    condition: self.condition,
                    body: first,
                    alternative: null
                }));
            } else if (self.condition) {
                body.push(make_node(AST_SimpleStatement, self.condition, {
                    body: self.condition
                }));
            } else if (retain) {
                body.push(first);
            }
            extract_declarations_from_unreachable_code(compressor, self.body, body);
            return make_node(AST_BlockStatement, self, {
                body: body
            });
        }
        if (first instanceof AST_If) {
            var ab = first_statement(first.body);
            if (ab instanceof AST_Break && !external_target(ab)) {
                if (self.condition) {
                    self.condition = make_node(AST_Binary, self.condition, {
                        left: self.condition,
                        operator: "&&",
                        right: first.condition.negate(compressor),
                    });
                } else {
                    self.condition = first.condition.negate(compressor);
                }
                var body = as_statement_array(first.alternative);
                extract_declarations_from_unreachable_code(compressor, first.body, body);
                return drop_it(body);
            }
            ab = first_statement(first.alternative);
            if (ab instanceof AST_Break && !external_target(ab)) {
                if (self.condition) {
                    self.condition = make_node(AST_Binary, self.condition, {
                        left: self.condition,
                        operator: "&&",
                        right: first.condition,
                    });
                } else {
                    self.condition = first.condition;
                }
                var body = as_statement_array(first.body);
                extract_declarations_from_unreachable_code(compressor, first.alternative, body);
                return drop_it(body);
            }
        }
        return self;

        function first_statement(body) {
            return body instanceof AST_BlockStatement ? body.body[0] : body;
        }

        function external_target(node) {
            return compressor.loopcontrol_target(node) !== compressor.self();
        }

        function drop_it(rest) {
            if (self.body instanceof AST_BlockStatement) {
                self.body = self.body.clone();
                self.body.body = rest.concat(self.body.body.slice(1));
                self.body = self.body.transform(compressor);
            } else {
                self.body = make_node(AST_BlockStatement, self.body, {
                    body: rest
                }).transform(compressor);
            }
            return if_break_in_loop(self, compressor);
        }
    }

    OPT(AST_For, function(self, compressor) {
        if (!compressor.option("loops")) return self;
        if (compressor.option("side_effects")) {
            if (self.init) self.init = self.init.drop_side_effect_free(compressor);
            if (self.step) self.step = self.step.drop_side_effect_free(compressor);
        }
        if (self.condition) {
            var cond = self.condition.evaluate(compressor);
            if (cond instanceof AST_Node) {
                cond = self.condition.is_truthy() || self.condition.evaluate(compressor, true);
            } else if (cond) {
                self.condition = null;
            } else if (!compressor.option("dead_code")) {
                var orig = self.condition;
                self.condition = make_node_from_constant(cond, self.condition);
                self.condition = best_of_expression(self.condition.transform(compressor), orig);
            }
            if (!cond) {
                if (compressor.option("dead_code")) {
                    var body = [];
                    if (self.init instanceof AST_Statement) {
                        body.push(self.init);
                    } else if (self.init) {
                        body.push(make_node(AST_SimpleStatement, self.init, {
                            body: self.init
                        }));
                    }
                    body.push(make_node(AST_SimpleStatement, self.condition, {
                        body: self.condition
                    }));
                    extract_declarations_from_unreachable_code(compressor, self.body, body);
                    return make_node(AST_BlockStatement, self, { body: body }).optimize(compressor);
                }
            } else if (self.condition && !(cond instanceof AST_Node)) {
                self.body = make_node(AST_BlockStatement, self.body, {
                    body: [
                        make_node(AST_SimpleStatement, self.condition, {
                            body: self.condition
                        }),
                        self.body
                    ]
                });
                self.condition = null;
            }
        }
        return if_break_in_loop(self, compressor);
    });

    OPT(AST_ForIn, function(self, compressor) {
        if (compressor.option("varify") && (self.init instanceof AST_Const || self.init instanceof AST_Let)) {
            var name = self.init.definitions[0].name;
            if ((name instanceof AST_Destructured || name instanceof AST_SymbolLet)
                && !name.match_symbol(function(node) {
                    if (node instanceof AST_SymbolDeclaration) return may_overlap(compressor, node.definition());
                }, true)) {
                self.init = to_var(self.init);
            }
        }
        return self;
    });

    function mark_locally_defined(condition, consequent, alternative) {
        if (!(condition instanceof AST_Binary)) return;
        if (!(condition.left instanceof AST_String)) {
            switch (condition.operator) {
              case "&&":
                mark_locally_defined(condition.left, consequent);
                mark_locally_defined(condition.right, consequent);
                break;
              case "||":
                mark_locally_defined(negate(condition.left), alternative);
                mark_locally_defined(negate(condition.right), alternative);
                break;
            }
            return;
        }
        if (!(condition.right instanceof AST_UnaryPrefix)) return;
        if (condition.right.operator != "typeof") return;
        var sym = condition.right.expression;
        if (!is_undeclared_ref(sym)) return;
        var body;
        var undef = condition.left.value == "undefined";
        switch (condition.operator) {
          case "==":
            body = undef ? alternative : consequent;
            break;
          case "!=":
            body = undef ? consequent : alternative;
            break;
          default:
            return;
        }
        if (!body) return;
        var def = sym.definition();
        var tw = new TreeWalker(function(node) {
            if (node instanceof AST_Scope) {
                var parent = tw.parent();
                if (parent instanceof AST_Call && parent.expression === node) return;
                return true;
            }
            if (node instanceof AST_SymbolRef && node.definition() === def) node.defined = true;
        });
        body.walk(tw);

        function negate(node) {
            if (!(node instanceof AST_Binary)) return;
            switch (node.operator) {
              case "==":
                node = node.clone();
                node.operator = "!=";
                return node;
              case "!=":
                node = node.clone();
                node.operator = "==";
                return node;
            }
        }
    }

    OPT(AST_If, function(self, compressor) {
        if (is_empty(self.alternative)) self.alternative = null;

        if (!compressor.option("conditionals")) return self;
        // if condition can be statically determined, warn and drop
        // one of the blocks.  note, statically determined implies
        // “has no side effects”; also it doesn't work for cases like
        // `x && true`, though it probably should.
        var cond = self.condition.evaluate(compressor);
        if (!compressor.option("dead_code") && !(cond instanceof AST_Node)) {
            var orig = self.condition;
            self.condition = make_node_from_constant(cond, orig);
            self.condition = best_of_expression(self.condition.transform(compressor), orig);
        }
        if (compressor.option("dead_code")) {
            if (cond instanceof AST_Node) {
                cond = self.condition.is_truthy() || self.condition.evaluate(compressor, true);
            }
            if (!cond) {
                AST_Node.warn("Condition always false [{file}:{line},{col}]", self.condition.start);
                var body = [
                    make_node(AST_SimpleStatement, self.condition, {
                        body: self.condition
                    }),
                ];
                extract_declarations_from_unreachable_code(compressor, self.body, body);
                if (self.alternative) body.push(self.alternative);
                return make_node(AST_BlockStatement, self, { body: body }).optimize(compressor);
            } else if (!(cond instanceof AST_Node)) {
                AST_Node.warn("Condition always true [{file}:{line},{col}]", self.condition.start);
                var body = [
                    make_node(AST_SimpleStatement, self.condition, {
                        body: self.condition
                    }),
                    self.body,
                ];
                if (self.alternative) extract_declarations_from_unreachable_code(compressor, self.alternative, body);
                return make_node(AST_BlockStatement, self, { body: body }).optimize(compressor);
            }
        }
        var negated = self.condition.negate(compressor);
        var self_condition_length = self.condition.print_to_string().length;
        var negated_length = negated.print_to_string().length;
        var negated_is_best = negated_length < self_condition_length;
        if (self.alternative && negated_is_best) {
            negated_is_best = false; // because we already do the switch here.
            // no need to swap values of self_condition_length and negated_length
            // here because they are only used in an equality comparison later on.
            self.condition = negated;
            var tmp = self.body;
            self.body = self.alternative || make_node(AST_EmptyStatement, self);
            self.alternative = tmp;
        }
        var body = [], var_defs = [], refs = [];
        var body_exprs = sequencesize(self.body, body, var_defs, refs);
        var alt_exprs = sequencesize(self.alternative, body, var_defs, refs);
        if (body_exprs && alt_exprs) {
            if (var_defs.length > 0) body.push(make_node(AST_Var, self, {
                definitions: var_defs
            }));
            if (body_exprs.length == 0) {
                body.push(make_node(AST_SimpleStatement, self.condition, {
                    body: alt_exprs.length > 0 ? make_node(AST_Binary, self, {
                        operator : "||",
                        left     : self.condition,
                        right    : make_sequence(self.alternative, alt_exprs)
                    }).transform(compressor) : self.condition.clone()
                }).optimize(compressor));
            } else if (alt_exprs.length == 0) {
                if (self_condition_length === negated_length && !negated_is_best
                    && self.condition instanceof AST_Binary && self.condition.operator == "||") {
                    // although the code length of self.condition and negated are the same,
                    // negated does not require additional surrounding parentheses.
                    // see https://github.com/mishoo/UglifyJS/issues/979
                    negated_is_best = true;
                }
                body.push(make_node(AST_SimpleStatement, self, {
                    body: make_node(AST_Binary, self, {
                        operator : negated_is_best ? "||" : "&&",
                        left     : negated_is_best ? negated : self.condition,
                        right    : make_sequence(self.body, body_exprs)
                    }).transform(compressor)
                }).optimize(compressor));
            } else {
                body.push(make_node(AST_SimpleStatement, self, {
                    body: make_node(AST_Conditional, self, {
                        condition   : self.condition,
                        consequent  : make_sequence(self.body, body_exprs),
                        alternative : make_sequence(self.alternative, alt_exprs)
                    })
                }).optimize(compressor));
            }
            refs.forEach(function(ref) {
                ref.definition().references.push(ref);
            });
            return make_node(AST_BlockStatement, self, {
                body: body
            }).optimize(compressor);
        }
        if (is_empty(self.body)) {
            self = make_node(AST_If, self, {
                condition: negated,
                body: self.alternative,
                alternative: null
            });
        }
        if (self.body instanceof AST_Exit
            && self.alternative instanceof AST_Exit
            && self.body.TYPE == self.alternative.TYPE) {
            var exit = make_node(self.body.CTOR, self, {
                value: make_node(AST_Conditional, self, {
                    condition   : self.condition,
                    consequent  : self.body.value || make_node(AST_Undefined, self.body).transform(compressor),
                    alternative : self.alternative.value || make_node(AST_Undefined, self.alternative).transform(compressor)
                })
            });
            if (exit instanceof AST_Return) {
                exit.in_bool = self.body.in_bool || self.alternative.in_bool;
            }
            return exit;
        }
        if (self.body instanceof AST_If
            && !self.body.alternative
            && !self.alternative) {
            self = make_node(AST_If, self, {
                condition: make_node(AST_Binary, self.condition, {
                    operator: "&&",
                    left: self.condition,
                    right: self.body.condition
                }),
                body: self.body.body,
                alternative: null
            });
        }
        if (aborts(self.body)) {
            if (self.alternative) {
                var alt = self.alternative;
                self.alternative = null;
                return make_node(AST_BlockStatement, self, {
                    body: [ self, alt ]
                }).optimize(compressor);
            }
        }
        if (aborts(self.alternative)) {
            var body = self.body;
            self.body = self.alternative;
            self.condition = negated_is_best ? negated : self.condition.negate(compressor);
            self.alternative = null;
            return make_node(AST_BlockStatement, self, {
                body: [ self, body ]
            }).optimize(compressor);
        }
        if (compressor.option("typeofs")) mark_locally_defined(self.condition, self.body, self.alternative);
        return self;

        function sequencesize(stat, defuns, var_defs, refs) {
            if (stat == null) return [];
            if (stat instanceof AST_BlockStatement) {
                var exprs = [];
                for (var i = 0; i < stat.body.length; i++) {
                    var line = stat.body[i];
                    if (line instanceof AST_Defun) {
                        defuns.push(line);
                    } else if (line instanceof AST_EmptyStatement) {
                        continue;
                    } else if (line instanceof AST_SimpleStatement) {
                        if (!compressor.option("sequences") && exprs.length > 0) return;
                        exprs.push(line.body);
                    } else if (line instanceof AST_Var) {
                        if (!compressor.option("sequences") && exprs.length > 0) return;
                        line.remove_initializers(compressor, var_defs);
                        line.definitions.forEach(process_var_def);
                    } else {
                        return;
                    }
                }
                return exprs;
            }
            if (stat instanceof AST_Defun) {
                defuns.push(stat);
                return [];
            }
            if (stat instanceof AST_EmptyStatement) return [];
            if (stat instanceof AST_SimpleStatement) return [ stat.body ];
            if (stat instanceof AST_Var) {
                var exprs = [];
                stat.remove_initializers(compressor, var_defs);
                stat.definitions.forEach(process_var_def);
                return exprs;
            }

            function process_var_def(var_def) {
                if (!var_def.value) return;
                exprs.push(make_node(AST_Assign, var_def, {
                    operator: "=",
                    left: var_def.name.convert_symbol(AST_SymbolRef, function(ref) {
                        refs.push(ref);
                    }),
                    right: var_def.value
                }));
            }
        }
    });

    OPT(AST_Switch, function(self, compressor) {
        if (!compressor.option("switches")) return self;
        var branch;
        var value = self.expression.evaluate(compressor);
        if (!(value instanceof AST_Node)) {
            var orig = self.expression;
            self.expression = make_node_from_constant(value, orig);
            self.expression = best_of_expression(self.expression.transform(compressor), orig);
        }
        if (!compressor.option("dead_code")) return self;
        if (value instanceof AST_Node) {
            value = self.expression.evaluate(compressor, true);
        }
        var decl = [];
        var body = [];
        var default_branch;
        var exact_match;
        for (var i = 0, len = self.body.length; i < len && !exact_match; i++) {
            branch = self.body[i];
            if (branch instanceof AST_Default) {
                var prev = body[body.length - 1];
                if (default_branch || is_break(branch.body[0], compressor) && (!prev || aborts(prev))) {
                    eliminate_branch(branch, prev);
                    continue;
                } else {
                    default_branch = branch;
                }
            } else if (!(value instanceof AST_Node)) {
                var exp = branch.expression.evaluate(compressor);
                if (!(exp instanceof AST_Node) && exp !== value) {
                    eliminate_branch(branch, body[body.length - 1]);
                    continue;
                }
                if (exp instanceof AST_Node) exp = branch.expression.evaluate(compressor, true);
                if (exp === value) {
                    exact_match = branch;
                    if (default_branch) {
                        var default_index = body.indexOf(default_branch);
                        body.splice(default_index, 1);
                        eliminate_branch(default_branch, body[default_index - 1]);
                        default_branch = null;
                    }
                }
            }
            if (aborts(branch)) {
                var prev = body[body.length - 1];
                if (aborts(prev) && prev.body.length == branch.body.length
                    && make_node(AST_BlockStatement, prev, prev).equivalent_to(make_node(AST_BlockStatement, branch, branch))) {
                    prev.body = [];
                }
            }
            body.push(branch);
        }
        while (i < len) eliminate_branch(self.body[i++], body[body.length - 1]);
        while (branch = body[body.length - 1]) {
            var stat = branch.body[branch.body.length - 1];
            if (is_break(stat, compressor)) branch.body.pop();
            if (branch === default_branch) {
                if (!has_declarations_only(branch)) break;
            } else if (branch.expression.has_side_effects(compressor)) {
                break;
            } else if (default_branch) {
                if (!has_declarations_only(default_branch)) break;
                if (body[body.length - 2] !== default_branch) break;
                default_branch.body = default_branch.body.concat(branch.body);
                branch.body = [];
            } else if (!has_declarations_only(branch)) break;
            eliminate_branch(branch);
            if (body.pop() === default_branch) default_branch = null;
        }
        if (body.length == 0) {
            return make_node(AST_BlockStatement, self, {
                body: decl.concat(make_node(AST_SimpleStatement, self.expression, {
                    body: self.expression
                }))
            }).optimize(compressor);
        }
        body[0].body = decl.concat(body[0].body);
        self.body = body;
        if (compressor.option("conditionals")) switch (body.length) {
          case 1:
            if (!no_break(body[0])) break;
            var exp = body[0].expression;
            var statements = body[0].body.slice();
            if (body[0] !== default_branch && body[0] !== exact_match) return make_node(AST_If, self, {
                condition: make_node(AST_Binary, self, {
                    operator: "===",
                    left: self.expression,
                    right: exp,
                }),
                body: make_node(AST_BlockStatement, self, {
                    body: statements,
                }),
                alternative: null,
            }).optimize(compressor);
            if (exp) statements.unshift(make_node(AST_SimpleStatement, exp, {
                body: exp,
            }));
            statements.unshift(make_node(AST_SimpleStatement, self.expression, {
                body:self.expression,
            }));
            return make_node(AST_BlockStatement, self, {
                body: statements,
            }).optimize(compressor);
          case 2:
            if (!member(default_branch, body) || !no_break(body[1])) break;
            var statements = body[0].body.slice();
            var exclusive = statements.length && is_break(statements[statements.length - 1], compressor);
            if (exclusive) statements.pop();
            if (!all(statements, no_break)) break;
            var alternative = body[1].body.length && make_node(AST_BlockStatement, body[1], body[1]);
            var node = make_node(AST_If, self, {
                condition: make_node(AST_Binary, self, body[0] === default_branch ? {
                    operator: "!==",
                    left: self.expression,
                    right: body[1].expression,
                } : {
                    operator: "===",
                    left: self.expression,
                    right: body[0].expression,
                }),
                body: make_node(AST_BlockStatement, body[0], {
                    body: statements,
                }),
                alternative: exclusive && alternative || null,
            });
            if (!exclusive && alternative) node = make_node(AST_BlockStatement, self, {
                body: [ node, alternative ],
            });
            return node.optimize(compressor);
        }
        return self;

        function is_break(node, tw) {
            return node instanceof AST_Break && tw.loopcontrol_target(node) === self;
        }

        function no_break(node) {
            var found = false;
            var tw = new TreeWalker(function(node) {
                if (found
                    || node instanceof AST_Lambda
                    || node instanceof AST_SimpleStatement) return true;
                if (is_break(node, tw)) found = true;
            });
            tw.push(self);
            node.walk(tw);
            return !found;
        }

        function eliminate_branch(branch, prev) {
            if (prev && !aborts(prev)) {
                prev.body = prev.body.concat(branch.body);
            } else {
                extract_declarations_from_unreachable_code(compressor, branch, decl);
            }
        }
    });

    OPT(AST_Try, function(self, compressor) {
        self.body = tighten_body(self.body, compressor);
        if (compressor.option("dead_code")) {
            if (has_declarations_only(self)
                && !(self.bcatch && self.bcatch.argname && self.bcatch.argname.match_symbol(function(node) {
                    return node instanceof AST_SymbolCatch && !can_drop_symbol(node);
                }, true))) {
                var body = [];
                if (self.bcatch) {
                    extract_declarations_from_unreachable_code(compressor, self.bcatch, body);
                    body.forEach(function(stat) {
                        if (!(stat instanceof AST_Var)) return;
                        stat.definitions.forEach(function(var_def) {
                            var def = var_def.name.definition().redefined();
                            if (!def) return;
                            var_def.name = var_def.name.clone();
                            var_def.name.thedef = def;
                        });
                    });
                }
                body.unshift(make_node(AST_BlockStatement, self, self).optimize(compressor));
                if (self.bfinally) {
                    body.push(make_node(AST_BlockStatement, self.bfinally, self.bfinally).optimize(compressor));
                }
                return make_node(AST_BlockStatement, self, {
                    body: body
                }).optimize(compressor);
            }
            if (self.bfinally && has_declarations_only(self.bfinally)) {
                var body = make_node(AST_BlockStatement, self.bfinally, self.bfinally).optimize(compressor);
                body = self.body.concat(body);
                if (!self.bcatch) return make_node(AST_BlockStatement, self, {
                    body: body
                }).optimize(compressor);
                self.body = body;
                self.bfinally = null;
            }
        }
        return self;
    });

    function remove_initializers(make_value) {
        return function(compressor, defns) {
            var dropped = false;
            this.definitions.forEach(function(defn) {
                if (defn.value) dropped = true;
                defn.name.match_symbol(function(node) {
                    if (node instanceof AST_SymbolDeclaration) defns.push(make_node(AST_VarDef, node, {
                        name: node,
                        value: make_value(compressor, node)
                    }));
                }, true);
            });
            return dropped;
        };
    }

    AST_Const.DEFMETHOD("remove_initializers", remove_initializers(function(compressor, node) {
        return make_node(AST_Undefined, node).optimize(compressor);
    }));
    AST_Let.DEFMETHOD("remove_initializers", remove_initializers(return_null));
    AST_Var.DEFMETHOD("remove_initializers", remove_initializers(return_null));

    AST_Definitions.DEFMETHOD("to_assignments", function() {
        var assignments = this.definitions.reduce(function(a, defn) {
            var def = defn.name.definition();
            if (defn.value) {
                var name = make_node(AST_SymbolRef, defn.name, defn.name);
                a.push(make_node(AST_Assign, defn, {
                    operator : "=",
                    left     : name,
                    right    : defn.value
                }));
                def.references.push(name);
            }
            def.eliminated++;
            return a;
        }, []);
        if (assignments.length == 0) return null;
        return make_sequence(this, assignments);
    });

    function is_safe_lexical(def) {
        return def.name != "arguments" && def.orig.length < (def.orig[0] instanceof AST_SymbolLambda ? 3 : 2);
    }

    function may_overlap(compressor, def) {
        if (compressor.exposed(def)) return true;
        var scope = def.scope.resolve();
        for (var s = def.scope; s !== scope;) {
            s = s.parent_scope;
            if (s.var_names()[def.name]) return true;
        }
    }

    function to_var(stat) {
        return make_node(AST_Var, stat, {
            definitions: stat.definitions.map(function(defn) {
                return make_node(AST_VarDef, defn, {
                    name: defn.name.convert_symbol(AST_SymbolVar, function(name, node) {
                        var def = name.definition();
                        def.orig[def.orig.indexOf(node)] = name;
                        var scope = def.scope.resolve();
                        if (def.scope === scope) return;
                        def.scope = scope;
                        scope.variables.set(def.name, def);
                    }),
                    value: defn.value
                });
            })
        });
    }

    function varify(self, compressor) {
        return compressor.option("varify") && all(self.definitions, function(defn) {
            return !defn.name.match_symbol(function(node) {
                if (node instanceof AST_SymbolDeclaration) {
                    var def = node.definition();
                    return !node.fixed_value() || !is_safe_lexical(def) || may_overlap(compressor, def);
                }
            }, true);
        }) ? to_var(self) : self;
    }

    OPT(AST_Const, varify);
    OPT(AST_Let, varify);

    function lift_sequence_in_expression(node, compressor) {
        var exp = node.expression;
        if (!(exp instanceof AST_Sequence)) return node;
        var x = exp.expressions.slice();
        var e = node.clone();
        e.expression = x.pop();
        x.push(e);
        return make_sequence(node, x);
    }

    function drop_unused_call_args(call, compressor, fns_with_marked_args) {
        var exp = call.expression;
        var fn = exp instanceof AST_SymbolRef ? exp.fixed_value() : exp;
        if (!(fn instanceof AST_Lambda)) return;
        if (fn.uses_arguments) return;
        if (fn.pinned()) return;
        if (fns_with_marked_args && fns_with_marked_args.indexOf(fn) < 0) return;
        var args = call.args;
        if (!all(args, function(arg) {
            return !(arg instanceof AST_Spread);
        })) return;
        var pos = 0, last = 0;
        var drop_fargs = fn === exp && !fn.name && compressor.drop_fargs(fn, call) ? function(argname, arg) {
            if (!argname) return true;
            if (argname instanceof AST_DestructuredArray) {
                return argname.elements.length == 0 && arg instanceof AST_Array;
            }
            if (argname instanceof AST_DestructuredObject) {
                return argname.properties.length == 0 && arg && !arg.may_throw_on_access(compressor);
            }
            return argname.__unused;
        } : return_false;
        var side_effects = [];
        for (var i = 0; i < args.length; i++) {
            var argname = fn.argnames[i];
            if (compressor.option("default_values")
                && argname instanceof AST_DefaultValue
                && args[i].is_defined(compressor)) {
                fn.argnames[i] = argname = argname.name;
            }
            if (!argname || "__unused" in argname) {
                var node = args[i].drop_side_effect_free(compressor);
                if (drop_fargs(argname)) {
                    if (argname) fn.argnames.splice(i, 1);
                    args.splice(i, 1);
                    if (node) side_effects.push(node);
                    i--;
                    continue;
                } else if (node) {
                    side_effects.push(node);
                    args[pos++] = make_sequence(call, side_effects);
                    side_effects = [];
                } else if (argname) {
                    if (side_effects.length) {
                        args[pos++] = make_sequence(call, side_effects);
                        side_effects = [];
                    } else {
                        args[pos++] = make_node(AST_Number, args[i], {
                            value: 0
                        });
                        continue;
                    }
                }
            } else if (argname && drop_fargs(argname, args[i])) {
                var node = args[i].drop_side_effect_free(compressor);
                fn.argnames.splice(i, 1);
                args.splice(i, 1);
                if (node) side_effects.push(node);
                i--;
                continue;
            } else {
                side_effects.push(args[i]);
                args[pos++] = make_sequence(call, side_effects);
                side_effects = [];
            }
            last = pos;
        }
        for (; i < fn.argnames.length; i++) {
            if (drop_fargs(fn.argnames[i])) fn.argnames.splice(i--, 1);
        }
        args.length = last;
        if (!side_effects.length) return;
        var arg = make_sequence(call, side_effects);
        args.push(args.length < fn.argnames.length ? make_node(AST_UnaryPrefix, call, {
            operator: "void",
            expression: arg
        }) : arg);
    }

    OPT(AST_Call, function(self, compressor) {
        var exp = self.expression;
        if (compressor.option("sequences")) {
            if (exp instanceof AST_PropAccess) {
                var seq = lift_sequence_in_expression(exp, compressor);
                if (seq !== exp) {
                    var call = self.clone();
                    call.expression = seq.expressions.pop();
                    seq.expressions.push(call);
                    return seq.optimize(compressor);
                }
            } else if (!needs_unbinding(compressor, exp.tail_node())) {
                var seq = lift_sequence_in_expression(self, compressor);
                if (seq !== self) return seq.optimize(compressor);
            }
        }
        if (compressor.option("unused")) drop_unused_call_args(self, compressor);
        if (compressor.option("unsafe")) {
            if (is_undeclared_ref(exp)) switch (exp.name) {
              case "Array":
                if (self.args.length == 1) {
                    var first = self.args[0];
                    if (first instanceof AST_Number) try {
                        var length = first.value;
                        if (length > 6) break;
                        var elements = Array(length);
                        for (var i = 0; i < length; i++) elements[i] = make_node(AST_Hole, self);
                        return make_node(AST_Array, self, {
                            elements: elements
                        });
                    } catch (ex) {
                        AST_Node.warn("Invalid array length: {length} [{file}:{line},{col}]", {
                            length: length,
                            file: self.start.file,
                            line: self.start.line,
                            col: self.start.col,
                        });
                        break;
                    }
                    if (!first.is_boolean(compressor) && !first.is_string(compressor)) break;
                }
                return make_node(AST_Array, self, {
                    elements: self.args
                });
              case "Object":
                if (self.args.length == 0) {
                    return make_node(AST_Object, self, {
                        properties: []
                    });
                }
                break;
              case "String":
                if (self.args.length == 0) return make_node(AST_String, self, {
                    value: ""
                });
                if (self.args.length <= 1) return make_node(AST_Binary, self, {
                    left: self.args[0],
                    operator: "+",
                    right: make_node(AST_String, self, { value: "" })
                }).optimize(compressor);
                break;
              case "Number":
                if (self.args.length == 0) return make_node(AST_Number, self, {
                    value: 0
                });
                if (self.args.length == 1) return make_node(AST_UnaryPrefix, self, {
                    expression: self.args[0],
                    operator: "+"
                }).optimize(compressor);
              case "Boolean":
                if (self.args.length == 0) return make_node(AST_False, self);
                if (self.args.length == 1) return make_node(AST_UnaryPrefix, self, {
                    expression: make_node(AST_UnaryPrefix, self, {
                        expression: self.args[0],
                        operator: "!"
                    }),
                    operator: "!"
                }).optimize(compressor);
                break;
              case "RegExp":
                var params = [];
                if (all(self.args, function(arg) {
                    var value = arg.evaluate(compressor);
                    params.unshift(value);
                    return arg !== value;
                })) {
                    try {
                        return best_of(compressor, self, make_node(AST_RegExp, self, {
                            value: RegExp.apply(RegExp, params),
                        }));
                    } catch (ex) {
                        AST_Node.warn("Error converting {expr} [{file}:{line},{col}]", {
                            expr: self,
                            file: self.start.file,
                            line: self.start.line,
                            col: self.start.col,
                        });
                    }
                }
                break;
            } else if (exp instanceof AST_Dot) switch(exp.property) {
              case "toString":
                if (self.args.length == 0 && !exp.expression.may_throw_on_access(compressor)) {
                    return make_node(AST_Binary, self, {
                        left: make_node(AST_String, self, { value: "" }),
                        operator: "+",
                        right: exp.expression
                    }).optimize(compressor);
                }
                break;
              case "join":
                if (exp.expression instanceof AST_Array) EXIT: {
                    var separator;
                    if (self.args.length > 0) {
                        separator = self.args[0].evaluate(compressor);
                        if (separator === self.args[0]) break EXIT; // not a constant
                    }
                    var elements = [];
                    var consts = [];
                    exp.expression.elements.forEach(function(el) {
                        var value = el.evaluate(compressor);
                        if (value !== el) {
                            consts.push(value);
                        } else {
                            if (consts.length > 0) {
                                elements.push(make_node(AST_String, self, {
                                    value: consts.join(separator)
                                }));
                                consts.length = 0;
                            }
                            elements.push(el);
                        }
                    });
                    if (consts.length > 0) {
                        elements.push(make_node(AST_String, self, {
                            value: consts.join(separator)
                        }));
                    }
                    if (elements.length == 0) return make_node(AST_String, self, { value: "" });
                    if (elements.length == 1) {
                        if (elements[0].is_string(compressor)) {
                            return elements[0];
                        }
                        return make_node(AST_Binary, elements[0], {
                            operator : "+",
                            left     : make_node(AST_String, self, { value: "" }),
                            right    : elements[0]
                        });
                    }
                    if (separator == "") {
                        var first;
                        if (elements[0].is_string(compressor)
                            || elements[1].is_string(compressor)) {
                            first = elements.shift();
                        } else {
                            first = make_node(AST_String, self, { value: "" });
                        }
                        return elements.reduce(function(prev, el) {
                            return make_node(AST_Binary, el, {
                                operator : "+",
                                left     : prev,
                                right    : el
                            });
                        }, first).optimize(compressor);
                    }
                    // need this awkward cloning to not affect original element
                    // best_of will decide which one to get through.
                    var node = self.clone();
                    node.expression = node.expression.clone();
                    node.expression.expression = node.expression.expression.clone();
                    node.expression.expression.elements = elements;
                    return best_of(compressor, self, node);
                }
                break;
              case "charAt":
                if (self.args.length < 2) {
                    var node = make_node(AST_Sub, self, {
                        expression: exp.expression,
                        property: self.args.length ? make_node(AST_Binary, self.args[0], {
                            operator: "|",
                            left: make_node(AST_Number, self, {
                                value: 0
                            }),
                            right: self.args[0]
                        }) : make_node(AST_Number, self, {
                            value: 0
                        })
                    });
                    node.is_string = return_true;
                    return node.optimize(compressor);
                }
                break;
              case "apply":
                if (self.args.length == 2 && self.args[1] instanceof AST_Array) {
                    var args = self.args[1].elements.slice();
                    args.unshift(self.args[0]);
                    return make_node(AST_Call, self, {
                        expression: make_node(AST_Dot, exp, {
                            expression: exp.expression,
                            property: "call"
                        }),
                        args: args
                    }).optimize(compressor);
                }
                break;
              case "call":
                var func = exp.expression;
                if (func instanceof AST_SymbolRef) {
                    func = func.fixed_value();
                }
                if (func instanceof AST_Lambda && !func.contains_this()) {
                    return (self.args.length ? make_sequence(this, [
                        self.args[0],
                        make_node(AST_Call, self, {
                            expression: exp.expression,
                            args: self.args.slice(1)
                        })
                    ]) : make_node(AST_Call, self, {
                        expression: exp.expression,
                        args: []
                    })).optimize(compressor);
                }
                break;
            }
        }
        if (compressor.option("unsafe_Function")
            && is_undeclared_ref(exp)
            && exp.name == "Function") {
            // new Function() => function(){}
            if (self.args.length == 0) return make_node(AST_Function, self, {
                argnames: [],
                body: []
            }).init_vars(exp.scope);
            if (all(self.args, function(x) {
                return x instanceof AST_String;
            })) {
                // quite a corner-case, but we can handle it:
                //   https://github.com/mishoo/UglifyJS/issues/203
                // if the code argument is a constant, then we can minify it.
                try {
                    var code = "n(function(" + self.args.slice(0, -1).map(function(arg) {
                        return arg.value;
                    }).join(",") + "){" + self.args[self.args.length - 1].value + "})";
                    var ast = parse(code);
                    var mangle = { ie8: compressor.option("ie8") };
                    ast.figure_out_scope(mangle);
                    var comp = new Compressor(compressor.options);
                    ast = ast.transform(comp);
                    ast.figure_out_scope(mangle);
                    ast.compute_char_frequency(mangle);
                    ast.mangle_names(mangle);
                    var fun;
                    ast.walk(new TreeWalker(function(node) {
                        if (fun) return true;
                        if (node instanceof AST_Lambda) {
                            fun = node;
                            return true;
                        }
                    }));
                    var code = OutputStream();
                    AST_BlockStatement.prototype._codegen.call(fun, code);
                    self.args = [
                        make_node(AST_String, self, {
                            value: fun.argnames.map(function(arg) {
                                return arg.print_to_string();
                            }).join(",")
                        }),
                        make_node(AST_String, self.args[self.args.length - 1], {
                            value: code.get().replace(/^\{|\}$/g, "")
                        })
                    ];
                    return self;
                } catch (ex) {
                    if (ex instanceof JS_Parse_Error) {
                        AST_Node.warn("Error parsing code passed to new Function [{file}:{line},{col}]", self.args[self.args.length - 1].start);
                        AST_Node.warn(ex.toString());
                    } else {
                        throw ex;
                    }
                }
            }
        }
        var fn = exp instanceof AST_SymbolRef ? exp.fixed_value() : exp;
        var is_func = fn instanceof AST_Arrow || fn instanceof AST_Defun || fn instanceof AST_Function;
        var stat = is_func && fn.first_statement();
        var has_default = false;
        var can_drop = is_func && all(fn.argnames, function(argname, index) {
            if (argname instanceof AST_DefaultValue) {
                has_default = true;
                var arg = self.args[index];
                if (arg && !is_undefined(arg)) return false;
                var abort = false;
                argname.value.walk(new TreeWalker(function(node) {
                    if (abort) return true;
                    if (node instanceof AST_SymbolRef && fn.find_variable(node.name) === node.definition()) {
                        return abort = true;
                    }
                }));
                if (abort) return false;
                argname = argname.name;
            }
            return !(argname instanceof AST_Destructured);
        });
        var can_inline = can_drop && compressor.option("inline") && !self.is_expr_pure(compressor);
        if (can_inline && stat instanceof AST_Return) {
            var value = stat.value;
            if (exp === fn && (!value || value.is_constant_expression() && safe_from_await(value))) {
                return make_sequence(self, convert_args(value)).optimize(compressor);
            }
        }
        if (is_func) {
            var def, value, var_assigned = false;
            if (can_inline
                && !fn.uses_arguments
                && !fn.pinned()
                && !(fn.name && fn instanceof AST_Function)
                && (exp === fn || !recursive_ref(compressor, def = exp.definition())
                    && fn.is_constant_expression(find_scope(compressor)))
                && all(self.args, function(arg) {
                    return !(arg instanceof AST_Spread);
                })
                && (value = can_flatten_body(stat))
                && !fn.contains_this()) {
                var replacing = exp === fn || def.single_use && def.references.length - def.replaced == 1;
                if (can_substitute_directly()) {
                    var args = self.args.slice();
                    var refs = [];
                    args.push(value.clone(true).transform(new TreeTransformer(function(node) {
                        if (node instanceof AST_SymbolRef) {
                            var def = node.definition();
                            if (fn.variables.get(node.name) !== def) {
                                refs.push(node);
                                return node;
                            }
                            var index = resolve_index(def);
                            var arg = args[index];
                            if (!arg) return make_node(AST_Undefined, self);
                            args[index] = null;
                            var parent = this.parent();
                            return parent ? maintain_this_binding(compressor, parent, node, arg) : arg;
                        }
                    })));
                    var node = make_sequence(self, args.filter(function(arg) {
                        return arg;
                    })).optimize(compressor);
                    node = maintain_this_binding(compressor, compressor.parent(), compressor.self(), node);
                    if (replacing || best_of_expression(node, self) === node) {
                        refs.forEach(function(ref) {
                            var def = ref.definition();
                            def.references.push(ref);
                            if (replacing) {
                                def.replaced++;
                            } else {
                                def.single_use = false;
                            }
                        });
                        return node;
                    }
                }
                var insert, in_loop, scope;
                if (replacing && can_inject_symbols()) {
                    fn._squeezed = true;
                    if (exp !== fn) fn.parent_scope = exp.scope;
                    var node = make_sequence(self, flatten_fn()).optimize(compressor);
                    return maintain_this_binding(compressor, compressor.parent(), compressor.self(), node);
                }
            }
            if (compressor.option("side_effects")
                && can_drop
                && all(fn.body, is_empty)
                && (fn !== exp || fn_name_unused(fn, compressor))
                && !(fn instanceof AST_Arrow && fn.value)) {
                return make_sequence(self, convert_args()).optimize(compressor);
            }
        }
        if (compressor.option("drop_console")) {
            if (exp instanceof AST_PropAccess) {
                var name = exp.expression;
                while (name.expression) {
                    name = name.expression;
                }
                if (is_undeclared_ref(name) && name.name == "console") {
                    return make_node(AST_Undefined, self).optimize(compressor);
                }
            }
        }
        if (compressor.option("negate_iife")
            && compressor.parent() instanceof AST_SimpleStatement
            && is_iife_call(self)) {
            return self.negate(compressor, true);
        }
        return try_evaluate(compressor, self);

        function convert_args(value) {
            var args = self.args.map(function(arg) {
                return arg instanceof AST_Spread ? make_node(AST_Array, arg, {
                    elements: [ arg ],
                }) : arg;
            });
            fn.argnames.forEach(function(argname, index) {
                if (argname instanceof AST_DefaultValue) args.push(argname.value);
            });
            args.push(value || make_node(AST_Undefined, self));
            return args;
        }

        function safe_from_await(node) {
            if (!is_async(scope || compressor.find_parent(AST_Scope))) return true;
            var safe = true;
            var tw = new TreeWalker(function(node) {
                if (!safe) return true;
                if (node instanceof AST_Scope) {
                    if (node === fn) return;
                    if (node instanceof AST_Arrow) {
                        for (var i = 0; safe && i < node.argnames.length; i++) node.argnames[i].walk(tw);
                    } else if (is_defun(node) && node.name.name == "await") {
                        safe = false;
                    }
                    return true;
                }
                if (node instanceof AST_Symbol && node.name == "await" && node !== fn.name) safe = false;
            });
            node.walk(tw);
            return safe;
        }

        function return_value(stat) {
            if (!stat) return make_node(AST_Undefined, self);
            if (stat instanceof AST_Return) return stat.value || make_node(AST_Undefined, self);
            if (stat instanceof AST_SimpleStatement) return make_node(AST_UnaryPrefix, stat, {
                operator: "void",
                expression: stat.body
            });
        }

        function can_flatten_body(stat) {
            var len = fn.body.length;
            if (len < 2) {
                stat = return_value(stat);
                if (stat) return stat;
            }
            if (compressor.option("inline") < 3) return false;
            stat = null;
            for (var i = 0; i < len; i++) {
                var line = fn.body[i];
                if (line instanceof AST_Var) {
                    var assigned = var_assigned || !all(line.definitions, function(var_def) {
                        return !var_def.value;
                    });
                    if (assigned) {
                        var_assigned = true;
                        if (stat) return false;
                    }
                } else if (line instanceof AST_AsyncDefun
                    || line instanceof AST_Defun
                    || line instanceof AST_EmptyStatement) {
                    continue;
                } else if (stat) {
                    return false;
                } else {
                    stat = line;
                }
            }
            return return_value(stat);
        }

        function resolve_index(def) {
            for (var i = fn.argnames.length; --i >= 0;) {
                if (fn.argnames[i].definition() === def) return i;
            }
        }

        function can_substitute_directly() {
            if (has_default) return;
            if (var_assigned) return;
            if (compressor.option("inline") < 2 && fn.argnames.length) return;
            if (!fn.variables.all(function(def) {
                return def.references.length - def.replaced < 2 && def.orig[0] instanceof AST_SymbolFunarg;
            })) return;
            var abort = false;
            var begin;
            var in_order = [];
            var side_effects = false;
            var verify_await = true;
            value.walk(new TreeWalker(function(node, descend) {
                if (abort) return true;
                if (node instanceof AST_Binary && lazy_op[node.operator]
                    || node instanceof AST_Conditional) {
                    in_order = null;
                    return;
                }
                if (node instanceof AST_Scope) return abort = true;
                if (verify_await && node instanceof AST_Symbol && node.name == "await") {
                    if (is_async(compressor.find_parent(AST_Scope))) return abort = true;
                    verify_await = false;
                }
                if (node instanceof AST_SymbolRef) {
                    var def = node.definition();
                    if (fn.variables.get(node.name) !== def) {
                        in_order = null;
                        return;
                    }
                    if (is_defun(def.init)) return abort = true;
                    if (is_lhs(node, this.parent())) return abort = true;
                    var index = resolve_index(def);
                    if (!(begin < index)) begin = index;
                    if (!in_order) return;
                    if (side_effects) {
                        in_order = null;
                    } else {
                        in_order.push(fn.argnames[index]);
                    }
                    return;
                }
                if (node.has_side_effects(compressor)) {
                    descend();
                    side_effects = true;
                    return true;
                }
            }));
            if (abort) return;
            var end = self.args.length;
            if (in_order && fn.argnames.length >= end) {
                end = fn.argnames.length;
                while (end-- > begin && fn.argnames[end] === in_order.pop());
                end++;
            }
            var scope = side_effects && !in_order && compressor.find_parent(AST_Scope);
            return end <= begin || all(self.args.slice(begin, end), scope ? function(funarg) {
                return funarg.is_constant_expression(scope);
            } : function(funarg) {
                return !funarg.has_side_effects(compressor);
            });
        }

        function var_exists(defined, name) {
            return defined[name] || identifier_atom[name] || scope.var_names()[name];
        }

        function can_inject_args(defined, used, safe_to_inject) {
            for (var i = 0; i < fn.argnames.length; i++) {
                var arg = fn.argnames[i];
                if (arg.__unused) continue;
                if (arg instanceof AST_DefaultValue) arg = arg.name;
                if (!safe_to_inject || var_exists(defined, arg.name)) return false;
                used[arg.name] = true;
                if (in_loop) in_loop.push(arg.definition());
            }
            return true;
        }

        function can_inject_vars(defined, used, safe_to_inject) {
            for (var i = 0; i < fn.body.length; i++) {
                var stat = fn.body[i];
                if (is_defun(stat)) {
                    if (!safe_to_inject || var_exists(used, stat.name.name)) return false;
                    if (!all(stat.enclosed, function(def) {
                        return def.scope === stat || !defined[def.name];
                    })) return false;
                    continue;
                }
                if (!(stat instanceof AST_Var)) continue;
                if (!safe_to_inject) return false;
                for (var j = stat.definitions.length; --j >= 0;) {
                    var name = stat.definitions[j].name;
                    if (var_exists(defined, name.name)) return false;
                    if (in_loop) in_loop.push(name.definition());
                }
            }
            return true;
        }

        function can_inject_symbols() {
            var defined = Object.create(null);
            var level = 0, child;
            scope = compressor.self();
            do {
                if (scope.variables) scope.variables.each(function(def) {
                    defined[def.name] = true;
                });
                child = scope;
                scope = compressor.parent(level++);
                if (scope instanceof AST_DWLoop) {
                    in_loop = [];
                } else if (scope instanceof AST_For) {
                    if (scope.init === child) continue;
                    in_loop = [];
                } else if (scope instanceof AST_ForIn) {
                    if (scope.init === child) continue;
                    if (scope.object === child) continue;
                    in_loop = [];
                } else if (scope instanceof AST_SymbolRef) {
                    if (scope.fixed_value() instanceof AST_Scope) return false;
                }
            } while (!(scope instanceof AST_Scope));
            insert = scope.body.indexOf(child) + 1;
            if (!insert) return false;
            if (!safe_from_await(fn)) return false;
            var safe_to_inject = exp !== fn || fn.parent_scope.resolve() === scope;
            if (scope instanceof AST_Toplevel) {
                if (compressor.toplevel.vars) {
                    defined["arguments"] = true;
                } else {
                    safe_to_inject = false;
                }
            }
            var inline = compressor.option("inline");
            var used = Object.create(defined);
            if (!can_inject_args(defined, used, inline >= 2 && safe_to_inject)) return false;
            if (!can_inject_vars(defined, used, inline >= 3 && safe_to_inject)) return false;
            return !in_loop || in_loop.length == 0 || !is_reachable(fn, in_loop);
        }

        function append_var(decls, expressions, name, value) {
            var def = name.definition();
            scope.variables.set(name.name, def);
            scope.enclosed.push(def);
            if (!scope.var_names()[name.name]) {
                scope.var_names()[name.name] = true;
                decls.push(make_node(AST_VarDef, name, {
                    name: name,
                    value: null
                }));
            }
            if (!value) return;
            var sym = make_node(AST_SymbolRef, name, name);
            def.references.push(sym);
            expressions.push(make_node(AST_Assign, self, {
                operator: "=",
                left: sym,
                right: value
            }));
        }

        function flatten_args(decls, expressions) {
            var len = fn.argnames.length;
            for (var i = self.args.length; --i >= len;) {
                expressions.push(self.args[i]);
            }
            for (i = len; --i >= 0;) {
                var name = fn.argnames[i];
                var value = self.args[i];
                if (name instanceof AST_DefaultValue) {
                    value = value ? make_sequence(self, [ value, name.value ]) : name.value;
                    name = name.name;
                }
                if (name.__unused || scope.var_names()[name.name]) {
                    if (value) expressions.push(value);
                } else {
                    var symbol = make_node(AST_SymbolVar, name, name);
                    name.definition().orig.push(symbol);
                    if (!value && in_loop) value = make_node(AST_Undefined, self);
                    if ("__unused" in name) {
                        append_var(decls, expressions, symbol);
                        if (value) expressions.push(value);
                    } else {
                        append_var(decls, expressions, symbol, value);
                    }
                }
            }
            decls.reverse();
            expressions.reverse();
        }

        function flatten_vars(decls, expressions) {
            var pos = expressions.length;
            for (var i = 0; i < fn.body.length; i++) {
                var stat = fn.body[i];
                if (!(stat instanceof AST_Var)) continue;
                for (var j = 0; j < stat.definitions.length; j++) {
                    var var_def = stat.definitions[j];
                    var name = var_def.name;
                    var redef = name.definition().redefined();
                    if (redef) {
                        name = name.clone();
                        name.thedef = redef;
                    }
                    append_var(decls, expressions, name, var_def.value);
                    if (in_loop && all(fn.argnames, function(argname) {
                        if (argname instanceof AST_DefaultValue) argname = argname.name;
                        return argname.name != name.name;
                    })) {
                        var def = fn.variables.get(name.name);
                        var sym = make_node(AST_SymbolRef, name, name);
                        def.references.push(sym);
                        expressions.splice(pos++, 0, make_node(AST_Assign, var_def, {
                            operator: "=",
                            left: sym,
                            right: make_node(AST_Undefined, name)
                        }));
                    }
                }
            }
        }

        function flatten_fn() {
            var decls = [];
            var expressions = [];
            flatten_args(decls, expressions);
            flatten_vars(decls, expressions);
            expressions.push(value);
            var args = fn.body.filter(function(stat) {
                if (is_defun(stat)) {
                    var def = stat.name.definition();
                    scope.functions.set(def.name, def);
                    scope.variables.set(def.name, def);
                    scope.enclosed.push(def);
                    scope.var_names()[def.name] = true;
                    return true;
                }
            });
            args.unshift(insert, 0);
            if (decls.length) args.push(make_node(AST_Var, fn, {
                definitions: decls
            }));
            [].splice.apply(scope.body, args);
            fn.enclosed.forEach(function(def) {
                if (scope.var_names()[def.name]) return;
                scope.enclosed.push(def);
                scope.var_names()[def.name] = true;
            });
            return expressions;
        }
    });

    OPT(AST_New, function(self, compressor) {
        if (compressor.option("sequences")) {
            var seq = lift_sequence_in_expression(self, compressor);
            if (seq !== self) return seq.optimize(compressor);
        }
        if (compressor.option("unsafe")) {
            var exp = self.expression;
            if (is_undeclared_ref(exp)) {
                switch (exp.name) {
                  case "Object":
                  case "RegExp":
                  case "Function":
                  case "Error":
                  case "Array":
                    return make_node(AST_Call, self, self).transform(compressor);
                }
            }
        }
        return self;
    });

    // (a = b, x && a = c) => a = x ? c : b
    // (a = b, x || a = c) => a = x ? b : c
    function to_conditional_assignment(compressor, def, value, node) {
        if (!(node instanceof AST_Binary)) return;
        if (!lazy_op[node.operator]) return;
        if (!(node.right instanceof AST_Assign)) return;
        if (node.right.operator != "=") return;
        if (!(node.right.left instanceof AST_SymbolRef)) return;
        if (node.right.left.definition() !== def) return;
        if (value.has_side_effects(compressor)) return;
        if (!safe_from_assignment(node.left)) return;
        if (!safe_from_assignment(node.right.right)) return;
        def.replaced++;
        return node.operator == "&&" ? make_node(AST_Conditional, node, {
            condition: node.left,
            consequent: node.right.right,
            alternative: value
        }) : make_node(AST_Conditional, node, {
            condition: node.left,
            consequent: value,
            alternative: node.right.right
        });

        function safe_from_assignment(node) {
            if (node.has_side_effects(compressor)) return;
            var hit = false;
            node.walk(new TreeWalker(function(node) {
                if (hit) return true;
                if (node instanceof AST_SymbolRef && node.definition() === def) return hit = true;
            }));
            return !hit;
        }
    }

    OPT(AST_Sequence, function(self, compressor) {
        var expressions = filter_for_side_effects();
        var end = expressions.length - 1;
        merge_conditional_assignments();
        trim_right_for_undefined();
        if (end == 0) {
            self = maintain_this_binding(compressor, compressor.parent(), compressor.self(), expressions[0]);
            if (!(self instanceof AST_Sequence)) self = self.optimize(compressor);
            return self;
        }
        self.expressions = expressions;
        return self;

        function filter_for_side_effects() {
            if (!compressor.option("side_effects")) return self.expressions;
            var expressions = [];
            var first = first_in_statement(compressor);
            var last = self.expressions.length - 1;
            self.expressions.forEach(function(expr, index) {
                if (index < last) expr = expr.drop_side_effect_free(compressor, first);
                if (expr) {
                    merge_sequence(expressions, expr);
                    first = false;
                }
            });
            return expressions;
        }

        function trim_right_for_undefined() {
            if (!compressor.option("side_effects")) return;
            while (end > 0 && is_undefined(expressions[end], compressor)) end--;
            if (end < expressions.length - 1) {
                expressions[end] = make_node(AST_UnaryPrefix, self, {
                    operator   : "void",
                    expression : expressions[end]
                });
                expressions.length = end + 1;
            }
        }

        function merge_conditional_assignments() {
            if (!compressor.option("conditionals")) return;
            for (var i = 1; i < end; i++) {
                var assign = expressions[i - 1];
                if (!(assign instanceof AST_Assign)) continue;
                if (assign.operator != "=") continue;
                if (!(assign.left instanceof AST_SymbolRef)) continue;
                var def = assign.left.definition();
                var cond = to_conditional_assignment(compressor, def, assign.right, expressions[i]);
                if (!cond) continue;
                assign.right = cond;
                expressions.splice(i, 1);
                end--;
            }
        }
    });

    OPT(AST_UnaryPostfix, function(self, compressor) {
        if (compressor.option("sequences")) {
            var seq = lift_sequence_in_expression(self, compressor);
            if (seq !== self) return seq.optimize(compressor);
        }
        return try_evaluate(compressor, self);
    });

    var SIGN_OPS = makePredicate("+ -");
    var MULTIPLICATIVE_OPS = makePredicate("* / %");
    OPT(AST_UnaryPrefix, function(self, compressor) {
        var op = self.operator;
        var exp = self.expression;
        if (compressor.option("evaluate")
            && op == "delete"
            && !(exp instanceof AST_SymbolRef
                || exp instanceof AST_PropAccess
                || is_identifier_atom(exp))) {
            if (exp instanceof AST_Sequence) {
                exp = exp.expressions.slice();
                exp.push(make_node(AST_True, self));
                return make_sequence(self, exp).optimize(compressor);
            }
            return make_sequence(self, [ exp, make_node(AST_True, self) ]).optimize(compressor);
        }
        if (compressor.option("sequences") && !(op == "typeof" && is_undeclared_ref(exp.tail_node()))) {
            var seq = lift_sequence_in_expression(self, compressor);
            if (seq !== self) return seq.optimize(compressor);
        }
        if (compressor.option("side_effects") && op == "void") {
            exp = exp.drop_side_effect_free(compressor);
            if (!exp) return make_node(AST_Undefined, self).optimize(compressor);
            self.expression = exp;
            return self;
        }
        if (compressor.option("booleans")) {
            if (op == "!" && exp.is_truthy()) {
                return make_sequence(self, [ exp, make_node(AST_False, self) ]).optimize(compressor);
            } else if (compressor.in_boolean_context()) switch (op) {
              case "!":
                if (exp instanceof AST_UnaryPrefix && exp.operator == "!") {
                    // !!foo => foo, if we're in boolean context
                    return exp.expression;
                }
                if (exp instanceof AST_Binary) {
                    self = best_of(compressor, self, exp.negate(compressor, first_in_statement(compressor)));
                }
                break;
              case "typeof":
                // typeof always returns a non-empty string, thus it's
                // always true in booleans
                AST_Node.warn("Boolean expression always true [{file}:{line},{col}]", self.start);
                var exprs = [ make_node(AST_True, self) ];
                if (!(exp instanceof AST_SymbolRef && can_drop_symbol(exp))) exprs.unshift(exp);
                return make_sequence(self, exprs).optimize(compressor);
            }
        }
        if (op == "-" && exp instanceof AST_Infinity) exp = exp.transform(compressor);
        if (compressor.option("evaluate")
            && exp instanceof AST_Binary
            && SIGN_OPS[op]
            && MULTIPLICATIVE_OPS[exp.operator]
            && (exp.left.is_constant() || !exp.right.has_side_effects(compressor))) {
            return make_node(AST_Binary, self, {
                operator: exp.operator,
                left: make_node(AST_UnaryPrefix, exp.left, {
                    operator: op,
                    expression: exp.left
                }),
                right: exp.right
            });
        }
        // avoids infinite recursion of numerals
        return op == "-" && (exp instanceof AST_Number || exp instanceof AST_Infinity)
            ? self : try_evaluate(compressor, self);
    });

    AST_Binary.DEFMETHOD("lift_sequences", function(compressor) {
        if (this.left instanceof AST_PropAccess) {
            if (!(this.left.expression instanceof AST_Sequence)) return this;
            var x = this.left.expression.expressions.slice();
            var e = this.clone();
            e.left = e.left.clone();
            e.left.expression = x.pop();
            x.push(e);
            return make_sequence(this, x);
        }
        if (this.left instanceof AST_Sequence) {
            var x = this.left.expressions.slice();
            var e = this.clone();
            e.left = x.pop();
            x.push(e);
            return make_sequence(this, x);
        }
        if (this.right instanceof AST_Sequence) {
            if (this.left.has_side_effects(compressor)) return this;
            var assign = this.operator == "=" && this.left instanceof AST_SymbolRef;
            var x = this.right.expressions;
            var last = x.length - 1;
            for (var i = 0; i < last; i++) {
                if (!assign && x[i].has_side_effects(compressor)) break;
            }
            if (i == last) {
                x = x.slice();
                var e = this.clone();
                e.right = x.pop();
                x.push(e);
                return make_sequence(this, x);
            }
            if (i > 0) {
                var e = this.clone();
                e.right = make_sequence(this.right, x.slice(i));
                x = x.slice(0, i);
                x.push(e);
                return make_sequence(this, x);
            }
        }
        return this;
    });

    var indexFns = makePredicate("indexOf lastIndexOf");
    var commutativeOperators = makePredicate("== === != !== * & | ^");
    function is_object(node) {
        if (node instanceof AST_Assign) return node.operator == "=" && is_object(node.right);
        if (node instanceof AST_Sequence) return is_object(node.tail_node());
        if (node instanceof AST_SymbolRef) return is_object(node.fixed_value());
        return node instanceof AST_Array
            || node instanceof AST_Lambda
            || node instanceof AST_New
            || node instanceof AST_Object;
    }

    function repeatable(compressor, node) {
        if (node instanceof AST_Dot) return repeatable(compressor, node.expression);
        if (node instanceof AST_Sub) {
            return repeatable(compressor, node.expression) && repeatable(compressor, node.property);
        }
        if (node instanceof AST_Symbol) return true;
        return !node.has_side_effects(compressor);
    }

    OPT(AST_Binary, function(self, compressor) {
        function reversible() {
            return self.left.is_constant()
                || self.right.is_constant()
                || !self.left.has_side_effects(compressor)
                    && !self.right.has_side_effects(compressor);
        }
        function reverse(op) {
            if (reversible()) {
                if (op) self.operator = op;
                var tmp = self.left;
                self.left = self.right;
                self.right = tmp;
            }
        }
        function swap_chain() {
            var rhs = self.right;
            self.left = make_node(AST_Binary, self, {
                operator: self.operator,
                left: self.left,
                right: rhs.left,
                start: self.left.start,
                end: rhs.left.end
            });
            self.right = rhs.right;
            self.left = self.left.transform(compressor);
        }
        if (commutativeOperators[self.operator]
            && self.right.is_constant()
            && !self.left.is_constant()
            && !(self.left instanceof AST_Binary
                && PRECEDENCE[self.left.operator] >= PRECEDENCE[self.operator])) {
            // if right is a constant, whatever side effects the
            // left side might have could not influence the
            // result.  hence, force switch.
            reverse();
        }
        if (compressor.option("sequences")) {
            var seq = self.lift_sequences(compressor);
            if (seq !== self) return seq.optimize(compressor);
        }
        if (compressor.option("assignments") && lazy_op[self.operator]) {
            var assign = self.right;
            // a || (a = x) => a = a || x
            // a && (a = x) => a = a && x
            if (self.left instanceof AST_SymbolRef
                && assign instanceof AST_Assign
                && assign.operator == "="
                && self.left.equivalent_to(assign.left)) {
                self.right = assign.right;
                assign.right = self;
                return assign;
            }
        }
        if (compressor.option("comparisons")) switch (self.operator) {
          case "===":
          case "!==":
            if (is_undefined(self.left, compressor) && self.right.is_defined(compressor)) {
                AST_Node.warn("Expression always defined [{file}:{line},{col}]", self.start);
                return make_sequence(self, [
                    self.right,
                    make_node(self.operator == "===" ? AST_False : AST_True, self)
                ]).optimize(compressor);
            }
            var is_strict_comparison = true;
            if ((self.left.is_string(compressor) && self.right.is_string(compressor)) ||
                (self.left.is_number(compressor) && self.right.is_number(compressor)) ||
                (self.left.is_boolean(compressor) && self.right.is_boolean(compressor)) ||
                repeatable(compressor, self.left) && self.left.equivalent_to(self.right)) {
                self.operator = self.operator.slice(0, 2);
            }
            // XXX: intentionally falling down to the next case
          case "==":
          case "!=":
            // void 0 == x => null == x
            if (!is_strict_comparison && is_undefined(self.left, compressor)) {
                self.left = make_node(AST_Null, self.left);
            }
            // "undefined" == typeof x => undefined === x
            else if (compressor.option("typeofs")
                && self.left instanceof AST_String
                && self.left.value == "undefined"
                && self.right instanceof AST_UnaryPrefix
                && self.right.operator == "typeof") {
                var expr = self.right.expression;
                if (expr instanceof AST_SymbolRef ? expr.is_declared(compressor)
                    : !(expr instanceof AST_PropAccess && compressor.option("ie8"))) {
                    self.right = expr;
                    self.left = make_node(AST_Undefined, self.left).optimize(compressor);
                    if (self.operator.length == 2) self.operator += "=";
                }
            }
            // obj !== obj => false
            else if (self.left instanceof AST_SymbolRef
                && self.right instanceof AST_SymbolRef
                && self.left.definition() === self.right.definition()
                && is_object(self.left)) {
                return make_node(self.operator[0] == "=" ? AST_True : AST_False, self).optimize(compressor);
            }
            break;
          case "&&":
          case "||":
            // void 0 !== x && null !== x => null != x
            // void 0 === x || null === x => null == x
            var lhs = self.left;
            if (lhs.operator == self.operator) {
                lhs = lhs.right;
            }
            if (lhs instanceof AST_Binary
                && lhs.operator == (self.operator == "&&" ? "!==" : "===")
                && self.right instanceof AST_Binary
                && lhs.operator == self.right.operator
                && (is_undefined(lhs.left, compressor) && self.right.left instanceof AST_Null
                    || lhs.left instanceof AST_Null && is_undefined(self.right.left, compressor))
                && !lhs.right.has_side_effects(compressor)
                && lhs.right.equivalent_to(self.right.right)) {
                var combined = make_node(AST_Binary, self, {
                    operator: lhs.operator.slice(0, -1),
                    left: make_node(AST_Null, self),
                    right: lhs.right
                });
                if (lhs !== self.left) {
                    combined = make_node(AST_Binary, self, {
                        operator: self.operator,
                        left: self.left.left,
                        right: combined
                    });
                }
                return combined;
            }
            break;
        }
        var in_bool = compressor.option("booleans") && compressor.in_boolean_context();
        if (in_bool) switch (self.operator) {
          case "+":
            var ll = self.left.evaluate(compressor);
            var rr = self.right.evaluate(compressor);
            if (ll && typeof ll == "string") {
                AST_Node.warn("+ in boolean context always true [{file}:{line},{col}]", self.start);
                return make_sequence(self, [
                    self.right,
                    make_node(AST_True, self)
                ]).optimize(compressor);
            }
            if (rr && typeof rr == "string") {
                AST_Node.warn("+ in boolean context always true [{file}:{line},{col}]", self.start);
                return make_sequence(self, [
                    self.left,
                    make_node(AST_True, self)
                ]).optimize(compressor);
            }
            break;
          case "==":
            if (self.left instanceof AST_String && self.left.value == "" && self.right.is_string(compressor)) {
                return make_node(AST_UnaryPrefix, self, {
                    operator: "!",
                    expression: self.right
                }).optimize(compressor);
            }
            break;
          case "!=":
            if (self.left instanceof AST_String && self.left.value == "" && self.right.is_string(compressor)) {
                return self.right.optimize(compressor);
            }
            break;
        }
        var parent = compressor.parent();
        if (compressor.option("comparisons") && self.is_boolean(compressor)) {
            if (!(parent instanceof AST_Binary) || parent instanceof AST_Assign) {
                var negated = best_of(compressor, self, make_node(AST_UnaryPrefix, self, {
                    operator: "!",
                    expression: self.negate(compressor, first_in_statement(compressor))
                }));
                if (negated !== self) return negated;
            }
            switch (self.operator) {
              case ">": reverse("<"); break;
              case ">=": reverse("<="); break;
            }
        }
        // x && (y && z) => x && y && z
        // x || (y || z) => x || y || z
        if (compressor.option("conditionals")
            && lazy_op[self.operator]
            && self.right instanceof AST_Binary
            && self.operator == self.right.operator) {
            swap_chain();
        }
        if (compressor.option("strings") && self.operator == "+") {
            // "foo" + 42 + "" => "foo" + 42
            if (self.right instanceof AST_String
                && self.right.value == ""
                && self.left.is_string(compressor)) {
                return self.left.optimize(compressor);
            }
            // "" + ("foo" + 42) => "foo" + 42
            if (self.left instanceof AST_String
                && self.left.value == ""
                && self.right.is_string(compressor)) {
                return self.right.optimize(compressor);
            }
            // "" + 42 + "foo" => 42 + "foo"
            if (self.left instanceof AST_Binary
                && self.left.operator == "+"
                && self.left.left instanceof AST_String
                && self.left.left.value == ""
                && self.right.is_string(compressor)) {
                self.left = self.left.right;
                return self.optimize(compressor);
            }
            // "x" + (y + "z") => "x" + y + "z"
            // x + ("y" + z) => x + "y" + z
            if (self.right instanceof AST_Binary
                && self.operator == self.right.operator
                && (self.left.is_string(compressor) && self.right.is_string(compressor)
                    || self.right.left.is_string(compressor)
                        && (self.left.is_constant() || !self.right.right.has_side_effects(compressor)))) {
                swap_chain();
            }
        }
        if (compressor.option("evaluate")) {
            var associative = true;
            switch (self.operator) {
              case "&&":
                var ll = fuzzy_eval(self.left);
                if (!ll) {
                    AST_Node.warn("Condition left of && always false [{file}:{line},{col}]", self.start);
                    return maintain_this_binding(compressor, parent, compressor.self(), self.left).optimize(compressor);
                } else if (!(ll instanceof AST_Node)) {
                    AST_Node.warn("Condition left of && always true [{file}:{line},{col}]", self.start);
                    return make_sequence(self, [ self.left, self.right ]).optimize(compressor);
                }
                var rr = self.right.evaluate(compressor);
                if (!rr) {
                    if (in_bool) {
                        AST_Node.warn("Boolean && always false [{file}:{line},{col}]", self.start);
                        return make_sequence(self, [
                            self.left,
                            make_node(AST_False, self)
                        ]).optimize(compressor);
                    } else self.falsy = true;
                } else if (!(rr instanceof AST_Node)) {
                    if (in_bool || parent.operator == "&&" && parent.left === compressor.self()) {
                        AST_Node.warn("Dropping side-effect-free && [{file}:{line},{col}]", self.start);
                        return self.left.optimize(compressor);
                    }
                }
                // (x || false) && y => x ? y : false
                if (self.left.operator == "||") {
                    var lr = self.left.right.evaluate(compressor, true);
                    if (!lr) return make_node(AST_Conditional, self, {
                        condition: self.left.left,
                        consequent: self.right,
                        alternative: self.left.right
                    }).optimize(compressor);
                }
                break;
              case "||":
                var ll = fuzzy_eval(self.left);
                if (!ll) {
                    AST_Node.warn("Condition left of || always false [{file}:{line},{col}]", self.start);
                    return make_sequence(self, [ self.left, self.right ]).optimize(compressor);
                } else if (!(ll instanceof AST_Node)) {
                    AST_Node.warn("Condition left of || always true [{file}:{line},{col}]", self.start);
                    return maintain_this_binding(compressor, parent, compressor.self(), self.left).optimize(compressor);
                }
                var rr = self.right.evaluate(compressor);
                if (!rr) {
                    if (in_bool || parent.operator == "||" && parent.left === compressor.self()) {
                        AST_Node.warn("Dropping side-effect-free || [{file}:{line},{col}]", self.start);
                        return self.left.optimize(compressor);
                    }
                } else if (!(rr instanceof AST_Node)) {
                    if (in_bool) {
                        AST_Node.warn("Boolean || always true [{file}:{line},{col}]", self.start);
                        return make_sequence(self, [
                            self.left,
                            make_node(AST_True, self)
                        ]).optimize(compressor);
                    } else self.truthy = true;
                }
                // x && true || y => x ? true : y
                if (self.left.operator == "&&") {
                    var lr = self.left.right.is_truthy() || self.left.right.evaluate(compressor, true);
                    if (lr && !(lr instanceof AST_Node)) return make_node(AST_Conditional, self, {
                        condition: self.left.left,
                        consequent: self.left.right,
                        alternative: self.right
                    }).optimize(compressor);
                }
                break;
              case "+":
                // "foo" + ("bar" + x) => "foobar" + x
                if (self.left instanceof AST_Constant
                    && self.right instanceof AST_Binary
                    && self.right.operator == "+"
                    && self.right.left instanceof AST_Constant
                    && self.right.is_string(compressor)) {
                    self = make_node(AST_Binary, self, {
                        operator: "+",
                        left: make_node(AST_String, self.left, {
                            value: "" + self.left.value + self.right.left.value,
                            start: self.left.start,
                            end: self.right.left.end
                        }),
                        right: self.right.right
                    });
                }
                // (x + "foo") + "bar" => x + "foobar"
                if (self.right instanceof AST_Constant
                    && self.left instanceof AST_Binary
                    && self.left.operator == "+"
                    && self.left.right instanceof AST_Constant
                    && self.left.is_string(compressor)) {
                    self = make_node(AST_Binary, self, {
                        operator: "+",
                        left: self.left.left,
                        right: make_node(AST_String, self.right, {
                            value: "" + self.left.right.value + self.right.value,
                            start: self.left.right.start,
                            end: self.right.end
                        })
                    });
                }
                // a + -b => a - b
                if (self.right instanceof AST_UnaryPrefix
                    && self.right.operator == "-"
                    && self.left.is_number(compressor)) {
                    self = make_node(AST_Binary, self, {
                        operator: "-",
                        left: self.left,
                        right: self.right.expression
                    });
                    break;
                }
                // -a + b => b - a
                if (self.left instanceof AST_UnaryPrefix
                    && self.left.operator == "-"
                    && reversible()
                    && self.right.is_number(compressor)) {
                    self = make_node(AST_Binary, self, {
                        operator: "-",
                        left: self.right,
                        right: self.left.expression
                    });
                    break;
                }
                // (a + b) + 3 => 3 + (a + b)
                if (compressor.option("unsafe_math")
                    && self.left instanceof AST_Binary
                    && PRECEDENCE[self.left.operator] == PRECEDENCE[self.operator]
                    && self.right.is_constant()
                    && (self.right.is_boolean(compressor) || self.right.is_number(compressor))
                    && self.left.is_number(compressor)
                    && !self.left.right.is_constant()
                    && (self.left.left.is_boolean(compressor) || self.left.left.is_number(compressor))) {
                    self = make_node(AST_Binary, self, {
                        operator: self.left.operator,
                        left: make_node(AST_Binary, self, {
                            operator: self.operator,
                            left: self.right,
                            right: self.left.left
                        }),
                        right: self.left.right
                    });
                    break;
                }
              case "-":
                // a - -b => a + b
                if (self.right instanceof AST_UnaryPrefix
                    && self.right.operator == "-"
                    && self.left.is_number(compressor)
                    && self.right.expression.is_number(compressor)) {
                    self = make_node(AST_Binary, self, {
                        operator: "+",
                        left: self.left,
                        right: self.right.expression
                    });
                    break;
                }
              case "*":
              case "/":
                associative = compressor.option("unsafe_math");
                // +a - b => a - b
                // a - +b => a - b
                if (self.operator != "+") [ "left", "right" ].forEach(function(operand) {
                    var node = self[operand];
                    if (node instanceof AST_UnaryPrefix && node.operator == "+") {
                        var exp = node.expression;
                        if (exp.is_boolean(compressor) || exp.is_number(compressor) || exp.is_string(compressor)) {
                            self[operand] = exp;
                        }
                    }
                });
              case "&":
              case "|":
              case "^":
                // a + +b => +b + a
                if (self.operator != "-"
                    && self.operator != "/"
                    && (self.left.is_boolean(compressor) || self.left.is_number(compressor))
                    && (self.right.is_boolean(compressor) || self.right.is_number(compressor))
                    && reversible()
                    && !(self.left instanceof AST_Binary
                        && self.left.operator != self.operator
                        && PRECEDENCE[self.left.operator] >= PRECEDENCE[self.operator])) {
                    var reversed = make_node(AST_Binary, self, {
                        operator: self.operator,
                        left: self.right,
                        right: self.left
                    });
                    if (self.right instanceof AST_Constant
                        && !(self.left instanceof AST_Constant)) {
                        self = best_of(compressor, reversed, self);
                    } else {
                        self = best_of(compressor, self, reversed);
                    }
                }
                if (!associative || !self.is_number(compressor)) break;
                // a + (b + c) => (a + b) + c
                if (self.right instanceof AST_Binary
                    && self.right.operator != "%"
                    && PRECEDENCE[self.right.operator] == PRECEDENCE[self.operator]
                    && self.right.is_number(compressor)
                    && (self.operator != "+"
                        || self.right.left.is_boolean(compressor)
                        || self.right.left.is_number(compressor))
                    && (self.operator != "-" || !self.left.is_negative_zero())
                    && (self.right.left.is_constant_expression()
                        || !self.right.right.has_side_effects(compressor))) {
                    self = make_node(AST_Binary, self, {
                        operator: align(self.operator, self.right.operator),
                        left: make_node(AST_Binary, self.left, {
                            operator: self.operator,
                            left: self.left,
                            right: self.right.left,
                            start: self.left.start,
                            end: self.right.left.end
                        }),
                        right: self.right.right
                    });
                    if (self.operator == "+"
                        && !self.right.is_boolean(compressor)
                        && !self.right.is_number(compressor)) {
                        self.right = make_node(AST_UnaryPrefix, self.right, {
                            operator: "+",
                            expression: self.right
                        });
                    }
                }
                // (2 * n) * 3 => 6 * n
                // (n + 2) + 3 => n + 5
                if (self.right instanceof AST_Constant
                    && self.left instanceof AST_Binary
                    && self.left.operator != "%"
                    && PRECEDENCE[self.left.operator] == PRECEDENCE[self.operator]
                    && self.left.is_number(compressor)) {
                    if (self.left.left instanceof AST_Constant) {
                        var lhs = make_binary(self.left, self.operator, self.left.left, self.right, self.left.left.start, self.right.end);
                        self = make_binary(self, self.left.operator, try_evaluate(compressor, lhs), self.left.right);
                    } else if (self.left.right instanceof AST_Constant) {
                        var op = align(self.left.operator, self.operator);
                        var rhs = try_evaluate(compressor, make_binary(self.left, op, self.left.right, self.right));
                        if (rhs.is_constant()
                            && !(self.left.operator == "-"
                                && self.right.value != 0
                                && +rhs.value == 0
                                && self.left.left.is_negative_zero())) {
                            self = make_binary(self, self.left.operator, self.left.left, rhs);
                        }
                    }
                }
                break;
            }
            if (!(parent instanceof AST_UnaryPrefix && parent.operator == "delete")) {
                if (self.left instanceof AST_Number && !self.right.is_constant()) switch (self.operator) {
                  // 0 + n => n
                  case "+":
                    if (self.left.value == 0) {
                        if (self.right.is_boolean(compressor)) return make_node(AST_UnaryPrefix, self, {
                            operator: "+",
                            expression: self.right
                        }).optimize(compressor);
                        if (self.right.is_number(compressor) && !self.right.is_negative_zero()) return self.right;
                    }
                    break;
                  // 1 * n => n
                  case "*":
                    if (self.left.value == 1) {
                        return self.right.is_number(compressor) ? self.right : make_node(AST_UnaryPrefix, self, {
                            operator: "+",
                            expression: self.right
                        }).optimize(compressor);
                    }
                    break;
                }
                if (self.right instanceof AST_Number && !self.left.is_constant()) switch (self.operator) {
                  // n + 0 => n
                  case "+":
                    if (self.right.value == 0) {
                        if (self.left.is_boolean(compressor)) return make_node(AST_UnaryPrefix, self, {
                            operator: "+",
                            expression: self.left
                        }).optimize(compressor);
                        if (self.left.is_number(compressor) && !self.left.is_negative_zero()) return self.left;
                    }
                    break;
                  // n - 0 => n
                  case "-":
                    if (self.right.value == 0) {
                        return self.left.is_number(compressor) ? self.left : make_node(AST_UnaryPrefix, self, {
                            operator: "+",
                            expression: self.left
                        }).optimize(compressor);
                    }
                    break;
                  // n / 1 => n
                  case "/":
                    if (self.right.value == 1) {
                        return self.left.is_number(compressor) ? self.left : make_node(AST_UnaryPrefix, self, {
                            operator: "+",
                            expression: self.left
                        }).optimize(compressor);
                    }
                    break;
                }
            }
        }
        if (compressor.option("typeofs")) switch (self.operator) {
          case "&&":
            mark_locally_defined(self.left, self.right, null);
            break;
          case "||":
            mark_locally_defined(self.left, null, self.right);
            break;
        }
        if (compressor.option("unsafe")) {
            var indexRight = is_indexFn(self.right);
            if (in_bool
                && indexRight
                && (self.operator == "==" || self.operator == "!=")
                && self.left instanceof AST_Number
                && self.left.value == 0) {
                return (self.operator == "==" ? make_node(AST_UnaryPrefix, self, {
                    operator: "!",
                    expression: self.right
                }) : self.right).optimize(compressor);
            }
            var indexLeft = is_indexFn(self.left);
            if (compressor.option("comparisons") && is_indexOf_match_pattern()) {
                var node = make_node(AST_UnaryPrefix, self, {
                    operator: "!",
                    expression: make_node(AST_UnaryPrefix, self, {
                        operator: "~",
                        expression: indexLeft ? self.left : self.right
                    })
                });
                switch (self.operator) {
                  case "<":
                    if (indexLeft) break;
                  case "<=":
                  case "!=":
                    node = make_node(AST_UnaryPrefix, self, {
                        operator: "!",
                        expression: node
                    });
                    break;
                }
                return node.optimize(compressor);
            }
        }
        return try_evaluate(compressor, self);

        function align(ref, op) {
            switch (ref) {
              case "-":
                return op == "+" ? "-" : "+";
              case "/":
                return op == "*" ? "/" : "*";
              default:
                return op;
            }
        }

        function make_binary(orig, op, left, right, start, end) {
            if (op == "+") {
                if (!left.is_boolean(compressor) && !left.is_number(compressor)) {
                    left = make_node(AST_UnaryPrefix, left, {
                        operator: "+",
                        expression: left
                    });
                }
                if (!right.is_boolean(compressor) && !right.is_number(compressor)) {
                    right = make_node(AST_UnaryPrefix, right, {
                        operator: "+",
                        expression: right
                    });
                }
            }
            return make_node(AST_Binary, orig, {
                operator: op,
                left: left,
                right: right,
                start: start,
                end: end
            });
        }

        function fuzzy_eval(node) {
            if (node.truthy) return true;
            if (node.falsy) return false;
            if (node.is_truthy()) return true;
            return node.evaluate(compressor, true);
        }

        function is_indexFn(node) {
            return node.TYPE == "Call"
                && node.expression instanceof AST_Dot
                && indexFns[node.expression.property];
        }

        function is_indexOf_match_pattern() {
            switch (self.operator) {
              case "<=":
                // 0 <= array.indexOf(string) => !!~array.indexOf(string)
                return indexRight && self.left instanceof AST_Number && self.left.value == 0;
              case "<":
                // array.indexOf(string) < 0 => !~array.indexOf(string)
                if (indexLeft && self.right instanceof AST_Number && self.right.value == 0) return true;
                // -1 < array.indexOf(string) => !!~array.indexOf(string)
              case "==":
              case "!=":
                // -1 == array.indexOf(string) => !~array.indexOf(string)
                // -1 != array.indexOf(string) => !!~array.indexOf(string)
                if (!indexRight) return false;
                return self.left instanceof AST_Number && self.left.value == -1
                    || self.left instanceof AST_UnaryPrefix && self.left.operator == "-"
                        && self.left.expression instanceof AST_Number && self.left.expression.value == 1;
            }
        }
    });

    function recursive_ref(compressor, def) {
        var level = 0, node = compressor.self();
        do {
            if (node instanceof AST_Lambda && node.name && node.name.definition() === def) return node;
        } while (node = compressor.parent(level++));
    }

    OPT(AST_SymbolRef, function(self, compressor) {
        if (!compressor.option("ie8")
            && is_undeclared_ref(self)
            // testing against `self.scope.uses_with` is an optimization
            && !(self.scope.resolve().uses_with && compressor.find_parent(AST_With))) {
            switch (self.name) {
              case "undefined":
                return make_node(AST_Undefined, self).optimize(compressor);
              case "NaN":
                return make_node(AST_NaN, self).optimize(compressor);
              case "Infinity":
                return make_node(AST_Infinity, self).optimize(compressor);
            }
        }
        var parent = compressor.parent();
        if (compressor.option("reduce_vars") && is_lhs(compressor.self(), parent) !== compressor.self()) {
            var def = self.definition();
            var fixed = self.fixed_value();
            var single_use = def.single_use && !(parent instanceof AST_Call && parent.is_expr_pure(compressor));
            if (single_use) {
                if (fixed instanceof AST_Lambda) {
                    if ((def.scope !== self.scope.resolve() || def.in_loop)
                        && (!compressor.option("reduce_funcs") || def.escaped.depth == 1 || fixed.inlined)) {
                        single_use = false;
                    } else if (recursive_ref(compressor, def)) {
                        single_use = false;
                    } else if (fixed.name && fixed.name.definition() !== def) {
                        single_use = false;
                    } else if (fixed.parent_scope !== self.scope.resolve() || is_funarg(def)) {
                        single_use = fixed.is_constant_expression(self.scope);
                        if (single_use == "f") {
                            var scope = self.scope;
                            do if (is_defun(scope) || is_function(scope)) {
                                scope.inlined = true;
                            } while (scope = scope.parent_scope);
                        }
                    } else if (fixed.name && fixed.name.name == "await" && is_async(fixed)) {
                        single_use = false;
                    }
                    if (single_use) fixed.parent_scope = self.scope;
                } else if (!fixed || !fixed.is_constant_expression()) {
                    single_use = false;
                }
            }
            if (single_use) {
                def.single_use = false;
                fixed._squeezed = true;
                fixed.single_use = true;
                if (fixed instanceof AST_AsyncDefun) {
                    fixed = make_node(AST_AsyncFunction, fixed, fixed);
                    fixed.name = make_node(AST_SymbolLambda, fixed.name, fixed.name);
                } else if (fixed instanceof AST_Defun) {
                    fixed = make_node(AST_Function, fixed, fixed);
                    fixed.name = make_node(AST_SymbolLambda, fixed.name, fixed.name);
                }
                if (fixed instanceof AST_Lambda) {
                    var scope = self.scope.resolve();
                    fixed.enclosed.forEach(function(def) {
                        if (fixed.variables.has(def.name)) return;
                        if (scope.var_names()[def.name]) return;
                        scope.enclosed.push(def);
                        scope.var_names()[def.name] = true;
                    });
                }
                var value;
                if (def.recursive_refs > 0) {
                    value = fixed.clone(true);
                    var defun_def = value.name.definition();
                    var lambda_def = value.variables.get(value.name.name);
                    var name = lambda_def && lambda_def.orig[0];
                    if (!(name instanceof AST_SymbolLambda)) {
                        name = make_node(AST_SymbolLambda, value.name, value.name);
                        name.scope = value;
                        value.name = name;
                        lambda_def = value.def_function(name);
                        lambda_def.recursive_refs = def.recursive_refs;
                    }
                    value.walk(new TreeWalker(function(node) {
                        if (!(node instanceof AST_SymbolRef)) return;
                        var def = node.definition();
                        if (def === defun_def) {
                            node.thedef = lambda_def;
                            lambda_def.references.push(node);
                        } else {
                            def.single_use = false;
                            var fn = node.fixed_value();
                            if (!(fn instanceof AST_Lambda)) return;
                            if (!fn.name) return;
                            if (fn.name.definition() !== def) return;
                            if (def.scope !== fn.name.scope) return;
                            if (fixed.variables.get(fn.name.name) !== def) return;
                            fn.name = fn.name.clone();
                            var value_def = value.variables.get(fn.name.name) || value.def_function(fn.name);
                            node.thedef = value_def;
                            value_def.references.push(node);
                        }
                    }));
                } else {
                    value = fixed.optimize(compressor);
                    if (value === fixed) value = value.transform(new TreeTransformer(function(node, descend) {
                        if (node instanceof AST_Scope) return node;
                        node = node.clone();
                        descend(node, this);
                        return node;
                    }));
                }
                def.replaced++;
                return value;
            }
            var local = self.fixed !== def.fixed;
            if (fixed && (local || def.should_replace !== false)) {
                var init;
                if (fixed instanceof AST_This) {
                    if (!is_funarg(def) && same_scope(def)) {
                        init = fixed;
                    }
                } else {
                    var ev = fixed.evaluate(compressor, true);
                    if (ev !== fixed
                        && typeof ev != "function"
                        && (typeof ev != "object"
                            || ev instanceof RegExp
                                && compressor.option("unsafe_regexp")
                                && !def.cross_loop && same_scope(def))) {
                        init = make_node_from_constant(ev, fixed);
                    }
                }
                if (init) {
                    if (!local && def.should_replace === undefined) {
                        var value_length = init.optimize(compressor).print_to_string().length;
                        if (!has_symbol_ref(fixed)) {
                            value_length = Math.min(value_length, fixed.print_to_string().length);
                        }
                        var name_length = def.name.length;
                        if (compressor.option("unused") && !compressor.exposed(def)) {
                            var referenced = def.references.length - def.replaced;
                            name_length += (name_length + 2 + value_length) / (referenced - def.assignments);
                        }
                        var delta = value_length - Math.floor(name_length);
                        def.should_replace = delta < compressor.eval_threshold;
                    }
                    if (local || def.should_replace) {
                        var value;
                        if (has_symbol_ref(fixed)) {
                            value = init.optimize(compressor);
                            if (value === init) value = value.clone(true);
                        } else {
                            value = best_of_expression(init.optimize(compressor), fixed);
                            if (value === init || value === fixed) value = value.clone(true);
                        }
                        def.replaced++;
                        return value;
                    }
                }
            }
        }
        return self;

        function same_scope(def) {
            var scope = def.scope.resolve();
            return all(def.references, function(ref) {
                return scope === ref.scope.resolve();
            });
        }

        function has_symbol_ref(value) {
            var found;
            value.walk(new TreeWalker(function(node) {
                if (node instanceof AST_SymbolRef) found = true;
                if (found) return true;
            }));
            return found;
        }
    });

    function is_atomic(lhs, self) {
        return lhs instanceof AST_SymbolRef || lhs.TYPE === self.TYPE;
    }

    OPT(AST_Undefined, function(self, compressor) {
        if (compressor.option("unsafe_undefined")) {
            var undef = find_scope(compressor).find_variable("undefined");
            if (undef) {
                var ref = make_node(AST_SymbolRef, self, {
                    name   : "undefined",
                    scope  : undef.scope,
                    thedef : undef
                });
                ref.is_undefined = true;
                return ref;
            }
        }
        var lhs = is_lhs(compressor.self(), compressor.parent());
        if (lhs && is_atomic(lhs, self)) return self;
        return make_node(AST_UnaryPrefix, self, {
            operator: "void",
            expression: make_node(AST_Number, self, {
                value: 0
            })
        });
    });

    OPT(AST_Infinity, function(self, compressor) {
        var lhs = is_lhs(compressor.self(), compressor.parent());
        if (lhs && is_atomic(lhs, self)) return self;
        if (compressor.option("keep_infinity") && !lhs && !find_scope(compressor).find_variable("Infinity")) {
            return self;
        }
        return make_node(AST_Binary, self, {
            operator: "/",
            left: make_node(AST_Number, self, {
                value: 1
            }),
            right: make_node(AST_Number, self, {
                value: 0
            })
        });
    });

    OPT(AST_NaN, function(self, compressor) {
        var lhs = is_lhs(compressor.self(), compressor.parent());
        if (lhs && is_atomic(lhs, self)) return self;
        if (!lhs && !find_scope(compressor).find_variable("NaN")) return self;
        return make_node(AST_Binary, self, {
            operator: "/",
            left: make_node(AST_Number, self, {
                value: 0
            }),
            right: make_node(AST_Number, self, {
                value: 0
            })
        });
    });

    function is_reachable(self, defs) {
        var reachable = false;
        var find_ref = new TreeWalker(function(node) {
            if (reachable) return true;
            if (node instanceof AST_SymbolRef && member(node.definition(), defs)) {
                return reachable = true;
            }
        });
        var scan_scope = new TreeWalker(function(node) {
            if (reachable) return true;
            if (node instanceof AST_Scope && node !== self) {
                var parent = scan_scope.parent();
                if (parent instanceof AST_Call && parent.expression === node) return;
                node.walk(find_ref);
                return true;
            }
        });
        self.walk(scan_scope);
        return reachable;
    }

    var ASSIGN_OPS = makePredicate("+ - * / % >> << >>> | ^ &");
    var ASSIGN_OPS_COMMUTATIVE = makePredicate("* | ^ &");
    OPT(AST_Assign, function(self, compressor) {
        if (compressor.option("dead_code")) {
            if (self.left instanceof AST_PropAccess) {
                if (self.operator == "=") {
                    if (self.__drop) {
                        var exprs = [ self.left.expression ];
                        if (self.left instanceof AST_Sub) exprs.push(self.left.property);
                        exprs.push(self.right);
                        return make_sequence(self, exprs).optimize(compressor);
                    }
                    if (self.left.equivalent_to(self.right) && !self.left.has_side_effects(compressor)) {
                        return self.right;
                    }
                    var exp = self.left.expression;
                    if (exp instanceof AST_Lambda
                        || !compressor.has_directive("use strict")
                            && exp instanceof AST_Constant
                            && !exp.may_throw_on_access(compressor)) {
                        return self.left instanceof AST_Dot ? self.right : make_sequence(self, [
                            self.left.property,
                            self.right
                        ]).optimize(compressor);
                    }
                }
            } else if (self.left instanceof AST_SymbolRef && all(self.left.definition().orig, function(sym) {
                return !(sym instanceof AST_SymbolConst);
            })) {
                var parent;
                if (self.operator == "=" && self.left.equivalent_to(self.right)
                    && !((parent = compressor.parent()) instanceof AST_UnaryPrefix && parent.operator == "delete")) {
                    return self.right;
                }
                if (self.left.is_immutable()) return strip_assignment();
                var def = self.left.definition();
                var scope = def.scope.resolve();
                var local = scope === compressor.find_parent(AST_Lambda);
                var level = 0, node;
                parent = self;
                do {
                    node = parent;
                    parent = compressor.parent(level++);
                    if (parent instanceof AST_Assign) {
                        var found = false;
                        if (parent.left.match_symbol(function(node) {
                            if (node instanceof AST_PropAccess) return true;
                            if (!found && node instanceof AST_SymbolRef && node.definition() === def) {
                                if (in_try(level, parent)) return true;
                                def.fixed = false;
                                found = true;
                            }
                        })) break;
                        if (found) return strip_assignment();
                    } else if (parent instanceof AST_Exit) {
                        if (!local) break;
                        if (in_try(level, parent)) break;
                        if (is_reachable(scope, [ def ])) break;
                        def.fixed = false;
                        return strip_assignment();
                    } else if (parent instanceof AST_VarDef) {
                        if (!(parent.name instanceof AST_SymbolDeclaration)) continue;
                        if (parent.name.definition() !== def) continue;
                        if (in_try(level, parent)) break;
                        def.fixed = false;
                        return strip_assignment();
                    }
                } while (parent instanceof AST_Binary && parent.right === node
                    || parent instanceof AST_Sequence && parent.tail_node() === node
                    || parent instanceof AST_UnaryPrefix);
            }
        }
        if (compressor.option("sequences")) {
            var seq = self.lift_sequences(compressor);
            if (seq !== self) return seq.optimize(compressor);
        }
        if (compressor.option("assignments")) {
            if (self.operator == "=" && self.left instanceof AST_SymbolRef && self.right instanceof AST_Binary) {
                // x = expr1 OP expr2
                if (self.right.left instanceof AST_SymbolRef
                    && self.right.left.name == self.left.name
                    && ASSIGN_OPS[self.right.operator]) {
                    // x = x - 2 => x -= 2
                    return make_node(AST_Assign, self, {
                        operator: self.right.operator + "=",
                        left: self.left,
                        right: self.right.right,
                    }).optimize(compressor);
                }
                else if (self.right.right instanceof AST_SymbolRef
                    && self.right.right.name == self.left.name
                    && ASSIGN_OPS_COMMUTATIVE[self.right.operator]
                    && !self.right.left.has_side_effects(compressor)) {
                    // x = 2 & x => x &= 2
                    return make_node(AST_Assign, self, {
                        operator: self.right.operator + "=",
                        left: self.left,
                        right: self.right.left,
                    }).optimize(compressor);
                }
            }
            if ((self.operator == "-=" || self.operator == "+="
                    && (self.left.is_boolean(compressor) || self.left.is_number(compressor)))
                && self.right instanceof AST_Number
                && self.right.value == 1) {
                var op = self.operator.slice(0, -1);
                return make_node(AST_UnaryPrefix, self, {
                    operator: op + op,
                    expression: self.left
                });
            }
        }
        return try_evaluate(compressor, self);

        function in_try(level, node) {
            var right = self.right;
            self.right = make_node(AST_Null, right);
            var may_throw = node.may_throw(compressor);
            self.right = right;
            var parent;
            while (parent = compressor.parent(level++)) {
                if (parent === scope) return false;
                if (parent instanceof AST_Try) {
                    if (parent.bfinally) return true;
                    if (may_throw && parent.bcatch) return true;
                }
            }
        }

        function strip_assignment() {
            return (self.operator != "=" ? make_node(AST_Binary, self, {
                operator: self.operator.slice(0, -1),
                left: self.left,
                right: self.right
            }) : maintain_this_binding(compressor, compressor.parent(), self, self.right)).optimize(compressor);
        }
    });

    OPT(AST_Conditional, function(self, compressor) {
        if (compressor.option("sequences") && self.condition instanceof AST_Sequence) {
            var expressions = self.condition.expressions.slice();
            self.condition = expressions.pop();
            expressions.push(self);
            return make_sequence(self, expressions);
        }
        if (!compressor.option("conditionals")) return self;
        var condition = self.condition.is_truthy() || self.condition.evaluate(compressor, true);
        if (!condition) {
            AST_Node.warn("Condition always false [{file}:{line},{col}]", self.start);
            return make_sequence(self, [ self.condition, self.alternative ]).optimize(compressor);
        } else if (!(condition instanceof AST_Node)) {
            AST_Node.warn("Condition always true [{file}:{line},{col}]", self.start);
            return make_sequence(self, [ self.condition, self.consequent ]).optimize(compressor);
        }
        var negated = condition.negate(compressor, first_in_statement(compressor));
        if (best_of(compressor, condition, negated) === negated) {
            self = make_node(AST_Conditional, self, {
                condition: negated,
                consequent: self.alternative,
                alternative: self.consequent
            });
            negated = condition;
            condition = self.condition;
        }
        var consequent = self.consequent;
        var alternative = self.alternative;
        if (repeatable(compressor, condition)) {
            // x ? x : y => x || y
            if (condition.equivalent_to(consequent)) return make_node(AST_Binary, self, {
                operator: "||",
                left: condition,
                right: alternative,
            }).optimize(compressor);
            // x ? y : x => x && y
            if (condition.equivalent_to(alternative)) return make_node(AST_Binary, self, {
                operator: "&&",
                left: condition,
                right: consequent,
            }).optimize(compressor);
        }
        // if (foo) exp = something; else exp = something_else;
        //                   |
        //                   v
        // exp = foo ? something : something_else;
        var seq_tail = consequent.tail_node();
        if (seq_tail instanceof AST_Assign) {
            var is_eq = seq_tail.operator == "=";
            var alt_tail = is_eq ? alternative.tail_node() : alternative;
            if ((is_eq || consequent === seq_tail)
                && alt_tail instanceof AST_Assign
                && seq_tail.operator == alt_tail.operator
                && seq_tail.left.equivalent_to(alt_tail.left)
                && (is_eq && seq_tail.left instanceof AST_SymbolRef
                    || !condition.has_side_effects(compressor)
                        && can_shift_lhs_of_tail(consequent)
                        && can_shift_lhs_of_tail(alternative))) {
                return make_node(AST_Assign, self, {
                    operator: seq_tail.operator,
                    left: seq_tail.left,
                    right: make_node(AST_Conditional, self, {
                        condition: condition,
                        consequent: pop_lhs(consequent),
                        alternative: pop_lhs(alternative)
                    })
                });
            }
        }
        // x ? y : y => x, y
        if (consequent.equivalent_to(alternative)) return make_sequence(self, [
            condition,
            consequent
        ]).optimize(compressor);
        // x ? y.p : z.p => (x ? y : z).p
        // x ? y(a) : z(a) => (x ? y : z)(a)
        // x ? y.f(a) : z.f(a) => (x ? y : z).f(a)
        var combined = combine_tail(consequent, alternative, true);
        if (combined) return combined;
        // x ? y(a) : y(b) => y(x ? a : b)
        var arg_index;
        if (consequent instanceof AST_Call
            && alternative.TYPE == consequent.TYPE
            && (arg_index = arg_diff(consequent, alternative)) >= 0
            && consequent.expression.equivalent_to(alternative.expression)
            && !condition.has_side_effects(compressor)
            && !consequent.expression.has_side_effects(compressor)) {
            var node = consequent.clone();
            node.args[arg_index] = make_node(AST_Conditional, self, {
                condition: condition,
                consequent: consequent.args[arg_index],
                alternative: alternative.args[arg_index]
            });
            return node;
        }
        // x ? (y ? a : b) : b => x && y ? a : b
        if (consequent instanceof AST_Conditional
            && consequent.alternative.equivalent_to(alternative)) {
            return make_node(AST_Conditional, self, {
                condition: make_node(AST_Binary, self, {
                    left: condition,
                    operator: "&&",
                    right: consequent.condition
                }),
                consequent: consequent.consequent,
                alternative: alternative
            });
        }
        // x ? (y ? a : b) : a => !x || y ? a : b
        if (consequent instanceof AST_Conditional
            && consequent.consequent.equivalent_to(alternative)) {
            return make_node(AST_Conditional, self, {
                condition: make_node(AST_Binary, self, {
                    left: negated,
                    operator: "||",
                    right: consequent.condition
                }),
                consequent: alternative,
                alternative: consequent.alternative
            });
        }
        // x ? a : (y ? a : b) => x || y ? a : b
        if (alternative instanceof AST_Conditional
            && consequent.equivalent_to(alternative.consequent)) {
            return make_node(AST_Conditional, self, {
                condition: make_node(AST_Binary, self, {
                    left: condition,
                    operator: "||",
                    right: alternative.condition
                }),
                consequent: consequent,
                alternative: alternative.alternative
            });
        }
        // x ? b : (y ? a : b) => !x && y ? a : b
        if (alternative instanceof AST_Conditional
            && consequent.equivalent_to(alternative.alternative)) {
            return make_node(AST_Conditional, self, {
                condition: make_node(AST_Binary, self, {
                    left: negated,
                    operator: "&&",
                    right: alternative.condition
                }),
                consequent: alternative.consequent,
                alternative: consequent
            });
        }
        // x ? (a, c) : (b, c) => x ? a : b, c
        if ((consequent instanceof AST_Sequence || alternative instanceof AST_Sequence)
            && consequent.tail_node().equivalent_to(alternative.tail_node())) {
            return make_sequence(self, [
                make_node(AST_Conditional, self, {
                    condition: condition,
                    consequent: pop_seq(consequent),
                    alternative: pop_seq(alternative)
                }),
                consequent.tail_node()
            ]).optimize(compressor);
        }
        // x ? y && a : a => (!x || y) && a
        if (consequent instanceof AST_Binary
            && consequent.operator == "&&"
            && consequent.right.equivalent_to(alternative)) {
            return make_node(AST_Binary, self, {
                operator: "&&",
                left: make_node(AST_Binary, self, {
                    operator: "||",
                    left: negated,
                    right: consequent.left
                }),
                right: alternative
            }).optimize(compressor);
        }
        // x ? y || a : a => x && y || a
        if (consequent instanceof AST_Binary
            && consequent.operator == "||"
            && consequent.right.equivalent_to(alternative)) {
            return make_node(AST_Binary, self, {
                operator: "||",
                left: make_node(AST_Binary, self, {
                    operator: "&&",
                    left: condition,
                    right: consequent.left
                }),
                right: alternative
            }).optimize(compressor);
        }
        // x ? a : y && a => (x || y) && a
        if (alternative instanceof AST_Binary
            && alternative.operator == "&&"
            && alternative.right.equivalent_to(consequent)) {
            return make_node(AST_Binary, self, {
                operator: "&&",
                left: make_node(AST_Binary, self, {
                    operator: "||",
                    left: condition,
                    right: alternative.left
                }),
                right: consequent
            }).optimize(compressor);
        }
        // x ? a : y || a => !x && y || a
        if (alternative instanceof AST_Binary
            && alternative.operator == "||"
            && alternative.right.equivalent_to(consequent)) {
            return make_node(AST_Binary, self, {
                operator: "||",
                left: make_node(AST_Binary, self, {
                    operator: "&&",
                    left: negated,
                    right: alternative.left
                }),
                right: consequent
            }).optimize(compressor);
        }
        var in_bool = compressor.option("booleans") && compressor.in_boolean_context();
        if (is_true(consequent)) {
            if (is_false(alternative)) {
                // c ? true : false => !!c
                return booleanize(condition);
            }
            // c ? true : x => !!c || x
            return make_node(AST_Binary, self, {
                operator: "||",
                left: booleanize(condition),
                right: alternative
            });
        }
        if (is_false(consequent)) {
            if (is_true(alternative)) {
                // c ? false : true => !c
                return booleanize(condition.negate(compressor));
            }
            // c ? false : x => !c && x
            return make_node(AST_Binary, self, {
                operator: "&&",
                left: booleanize(condition.negate(compressor)),
                right: alternative
            });
        }
        if (is_true(alternative)) {
            // c ? x : true => !c || x
            return make_node(AST_Binary, self, {
                operator: "||",
                left: booleanize(condition.negate(compressor)),
                right: consequent
            });
        }
        if (is_false(alternative)) {
            // c ? x : false => !!c && x
            return make_node(AST_Binary, self, {
                operator: "&&",
                left: booleanize(condition),
                right: consequent
            });
        }
        if (compressor.option("typeofs")) mark_locally_defined(condition, consequent, alternative);
        return self;

        function booleanize(node) {
            if (node.is_boolean(compressor)) return node;
            // !!expression
            return make_node(AST_UnaryPrefix, node, {
                operator: "!",
                expression: node.negate(compressor)
            });
        }

        // AST_True or !0
        function is_true(node) {
            return node instanceof AST_True
                || in_bool
                    && node instanceof AST_Constant
                    && node.value
                || (node instanceof AST_UnaryPrefix
                    && node.operator == "!"
                    && node.expression instanceof AST_Constant
                    && !node.expression.value);
        }
        // AST_False or !1 or void 0
        function is_false(node) {
            return node instanceof AST_False
                || in_bool
                    && (node instanceof AST_Constant
                            && !node.value
                        || node instanceof AST_UnaryPrefix
                            && node.operator == "void"
                            && !node.expression.has_side_effects(compressor))
                || (node instanceof AST_UnaryPrefix
                    && node.operator == "!"
                    && node.expression instanceof AST_Constant
                    && node.expression.value);
        }

        function arg_diff(consequent, alternative) {
            var a = consequent.args;
            var b = alternative.args;
            var len = a.length;
            if (len != b.length) return -2;
            for (var i = 0; i < len; i++) {
                if (!a[i].equivalent_to(b[i])) {
                    for (var j = i + 1; j < len; j++) {
                        if (!a[j].equivalent_to(b[j])) return -2;
                    }
                    return i;
                }
            }
            return -1;
        }

        function is_tail_equivalent(consequent, alternative) {
            if (consequent.TYPE != alternative.TYPE) return;
            if (consequent instanceof AST_Call) {
                if (arg_diff(consequent, alternative) != -1) return;
                return consequent.TYPE != "Call"
                    || !(consequent.expression instanceof AST_PropAccess
                        || alternative.expression instanceof AST_PropAccess)
                    || is_tail_equivalent(consequent.expression, alternative.expression);
            }
            if (consequent instanceof AST_Dot) return consequent.property == alternative.property;
            if (consequent instanceof AST_Sub) return consequent.property.equivalent_to(alternative.property);
        }

        function combine_tail(consequent, alternative, top) {
            if (!is_tail_equivalent(consequent, alternative)) return !top && make_node(AST_Conditional, self, {
                condition: condition,
                consequent: consequent,
                alternative: alternative
            });
            var exp = combine_tail(consequent.expression, alternative.expression);
            if (!exp) return;
            var node = consequent.clone();
            node.expression = exp;
            return node;
        }

        function can_shift_lhs_of_tail(node) {
            return node === node.tail_node() || all(node.expressions.slice(0, -1), function(expr) {
                return !expr.has_side_effects(compressor);
            });
        }

        function pop_lhs(node) {
            if (!(node instanceof AST_Sequence)) return node.right;
            var exprs = node.expressions.slice();
            exprs.push(exprs.pop().right);
            return make_sequence(node, exprs);
        }

        function pop_seq(node) {
            if (!(node instanceof AST_Sequence)) return make_node(AST_Number, node, {
                value: 0
            });
            return make_sequence(node, node.expressions.slice(0, -1));
        }
    });

    OPT(AST_Boolean, function(self, compressor) {
        if (!compressor.option("booleans")) return self;
        if (compressor.in_boolean_context()) return make_node(AST_Number, self, {
            value: +self.value
        });
        var p = compressor.parent();
        if (p instanceof AST_Binary && (p.operator == "==" || p.operator == "!=")) {
            AST_Node.warn("Non-strict equality against boolean: {operator} {value} [{file}:{line},{col}]", {
                operator : p.operator,
                value    : self.value,
                file     : p.start.file,
                line     : p.start.line,
                col      : p.start.col,
            });
            return make_node(AST_Number, self, {
                value: +self.value
            });
        }
        return make_node(AST_UnaryPrefix, self, {
            operator: "!",
            expression: make_node(AST_Number, self, {
                value: 1 - self.value
            })
        });
    });

    OPT(AST_Spread, function(self, compressor) {
        var exp = self.expression;
        if (compressor.option("spread") && exp instanceof AST_Array && !(compressor.parent() instanceof AST_Object)) {
            return List.splice(exp.elements.map(function(node) {
                return node instanceof AST_Hole ? make_node(AST_Undefined, node).optimize(compressor) : node;
            }));
        }
        return self;
    });

    function safe_to_flatten(value, compressor) {
        if (value instanceof AST_SymbolRef) {
            value = value.fixed_value();
        }
        if (!value) return false;
        if (!(value instanceof AST_Lambda)) return true;
        var parent = compressor.parent();
        if (parent.TYPE != "Call") return true;
        if (parent.expression !== compressor.self()) return true;
        return !value.contains_this();
    }

    OPT(AST_Sub, function(self, compressor) {
        var expr = self.expression;
        var prop = self.property;
        if (compressor.option("properties")) {
            var key = prop.evaluate(compressor);
            if (key !== prop) {
                if (typeof key == "string") {
                    if (key == "undefined") {
                        key = undefined;
                    } else {
                        var value = parseFloat(key);
                        if (value.toString() == key) {
                            key = value;
                        }
                    }
                }
                prop = self.property = best_of_expression(prop, make_node_from_constant(key, prop).transform(compressor));
                var property = "" + key;
                if (is_identifier_string(property)
                    && property.length <= prop.print_to_string().length + 1) {
                    return make_node(AST_Dot, self, {
                        expression: expr,
                        property: property
                    }).optimize(compressor);
                }
            }
        }
        var parent = compressor.parent();
        var assigned = is_lhs(compressor.self(), parent);
        var def, fn, fn_parent;
        if (compressor.option("arguments")
            && expr instanceof AST_SymbolRef
            && is_arguments(def = expr.definition())
            && !expr.in_arg
            && prop instanceof AST_Number
            && (fn = def.scope) === find_lambda()
            && fn.uses_arguments < (assigned ? 2 : 3)) {
            var index = prop.value;
            if (parent instanceof AST_UnaryPrefix && parent.operator == "delete") {
                if (!def.deleted) def.deleted = [];
                def.deleted[index] = true;
            }
            var argname = fn.argnames[index];
            if (def.deleted && def.deleted[index]) {
                argname = null;
            } else if (argname) {
                var arg_def;
                if (!(argname instanceof AST_SymbolFunarg)) {
                    argname = null;
                } else if (expr.scope.find_variable(argname.name) !== (arg_def = argname.definition())) {
                    argname = null;
                } else if (compressor.has_directive("use strict")
                    || fn.name
                    || !(fn_parent instanceof AST_Call && index < fn_parent.args.length)
                    || !all(fn.argnames, function(argname) {
                        return argname instanceof AST_SymbolFunarg;
                    })) {
                    if (!compressor.option("reduce_vars")
                        || def.reassigned
                        || arg_def.assignments
                        || arg_def.orig.length > 1) {
                        argname = null;
                    }
                }
            } else if (index < fn.argnames.length + 5 && compressor.drop_fargs(fn, fn_parent)) {
                while (index >= fn.argnames.length) {
                    argname = fn.make_var(AST_SymbolFunarg, fn, "argument_" + fn.argnames.length);
                    fn.argnames.push(argname);
                }
            }
            if (argname && find_if(function(node) {
                return node.name === argname.name;
            }, fn.argnames) === argname) {
                def.reassigned = false;
                var sym = make_node(AST_SymbolRef, self, argname);
                sym.reference({});
                delete argname.__unused;
                return sym;
            }
        }
        if (assigned) return self;
        if (compressor.option("sequences")
            && parent.TYPE != "Call"
            && !(parent instanceof AST_ForIn && parent.init === self)) {
            var seq = lift_sequence_in_expression(self, compressor);
            if (seq !== self) return seq.optimize(compressor);
        }
        if (key !== prop) {
            var sub = self.flatten_object(property, compressor);
            if (sub) {
                expr = self.expression = sub.expression;
                prop = self.property = sub.property;
            }
        }
        var elements;
        if (compressor.option("properties")
            && compressor.option("side_effects")
            && prop instanceof AST_Number
            && expr instanceof AST_Array
            && all(elements = expr.elements, function(value) {
                return !(value instanceof AST_Spread);
            })) {
            var index = prop.value;
            var retValue = elements[index];
            if (safe_to_flatten(retValue, compressor)) {
                var is_hole = retValue instanceof AST_Hole;
                var flatten = !is_hole;
                var values = [];
                for (var i = elements.length; --i > index;) {
                    var value = elements[i].drop_side_effect_free(compressor);
                    if (value) {
                        values.unshift(value);
                        if (flatten && value.has_side_effects(compressor)) flatten = false;
                    }
                }
                if (!flatten) values.unshift(retValue);
                while (--i >= 0) {
                    var value = elements[i].drop_side_effect_free(compressor);
                    if (value) {
                        values.unshift(value);
                    } else if (is_hole) {
                        values.unshift(make_node(AST_Hole, elements[i]));
                    } else {
                        index--;
                    }
                }
                if (flatten) {
                    values.push(retValue);
                    return make_sequence(self, values).optimize(compressor);
                } else return make_node(AST_Sub, self, {
                    expression: make_node(AST_Array, expr, {
                        elements: values
                    }),
                    property: make_node(AST_Number, prop, {
                        value: index
                    })
                });
            }
        }
        return try_evaluate(compressor, self);

        function find_lambda() {
            var i = 0, p;
            while (p = compressor.parent(i++)) {
                if (p instanceof AST_Lambda) {
                    if (p instanceof AST_Accessor) return;
                    if (p instanceof AST_Arrow) continue;
                    fn_parent = compressor.parent(i);
                    return p;
                }
            }
        }
    });

    AST_Arrow.DEFMETHOD("contains_this", return_false);
    AST_Scope.DEFMETHOD("contains_this", function() {
        var result;
        var self = this;
        self.walk(new TreeWalker(function(node) {
            if (result) return true;
            if (node instanceof AST_This) return result = true;
            if (node !== self && node instanceof AST_Scope && !(node instanceof AST_Arrow)) return true;
        }));
        return result;
    });

    AST_PropAccess.DEFMETHOD("flatten_object", function(key, compressor) {
        if (!compressor.option("properties")) return;
        var expr = this.expression;
        if (expr instanceof AST_Object) {
            var props = expr.properties;
            for (var i = props.length; --i >= 0;) {
                var prop = props[i];
                if (prop.key != key) continue;
                if (!all(props, function(prop) {
                    return prop instanceof AST_ObjectKeyVal && typeof prop.key == "string";
                })) break;
                if (!safe_to_flatten(prop.value, compressor)) break;
                return make_node(AST_Sub, this, {
                    expression: make_node(AST_Array, expr, {
                        elements: props.map(function(prop) {
                            return prop.value;
                        })
                    }),
                    property: make_node(AST_Number, this, {
                        value: i
                    })
                });
            }
        }
    });

    OPT(AST_Dot, function(self, compressor) {
        if (self.property == "arguments" || self.property == "caller") {
            AST_Node.warn("Function.prototype.{prop} not supported [{file}:{line},{col}]", {
                prop: self.property,
                file: self.start.file,
                line: self.start.line,
                col: self.start.col,
            });
        }
        var parent = compressor.parent();
        if (is_lhs(compressor.self(), parent)) return self;
        if (compressor.option("sequences")
            && parent.TYPE != "Call"
            && !(parent instanceof AST_ForIn && parent.init === self)) {
            var seq = lift_sequence_in_expression(self, compressor);
            if (seq !== self) return seq.optimize(compressor);
        }
        if (compressor.option("unsafe_proto")
            && self.expression instanceof AST_Dot
            && self.expression.property == "prototype") {
            var exp = self.expression.expression;
            if (is_undeclared_ref(exp)) switch (exp.name) {
              case "Array":
                self.expression = make_node(AST_Array, self.expression, {
                    elements: []
                });
                break;
              case "Function":
                self.expression = make_node(AST_Function, self.expression, {
                    argnames: [],
                    body: []
                }).init_vars(exp.scope);
                break;
              case "Number":
                self.expression = make_node(AST_Number, self.expression, {
                    value: 0
                });
                break;
              case "Object":
                self.expression = make_node(AST_Object, self.expression, {
                    properties: []
                });
                break;
              case "RegExp":
                self.expression = make_node(AST_RegExp, self.expression, {
                    value: /t/
                });
                break;
              case "String":
                self.expression = make_node(AST_String, self.expression, {
                    value: ""
                });
                break;
            }
        }
        var sub = self.flatten_object(self.property, compressor);
        if (sub) return sub.optimize(compressor);
        return try_evaluate(compressor, self);
    });

    OPT(AST_DestructuredKeyVal, function(self, compressor) {
        if (compressor.option("objects")) {
            var key = self.key;
            if (key instanceof AST_Node) {
                key = key.evaluate(compressor);
                if (key !== self.key) self.key = "" + key;
            }
        }
        return self;
    });

    OPT(AST_Object, function(self, compressor) {
        if (!compressor.option("objects")) return self;
        var changed = false;
        var found = false;
        var generated = false;
        var keep_duplicate = compressor.has_directive("use strict");
        var keys = new Dictionary();
        var values = [];
        self.properties.forEach(function(prop) {
            if (!(prop instanceof AST_Spread)) return process(prop);
            found = true;
            var exp = prop.expression;
            if (compressor.option("spread") && exp instanceof AST_Object && all(exp.properties, function(prop) {
                return !(prop instanceof AST_ObjectGetter || prop instanceof AST_Spread);
            })) {
                changed = true;
                exp.properties.forEach(function(prop) {
                    process(prop instanceof AST_ObjectSetter ? make_node(AST_ObjectKeyVal, prop, {
                        key: prop.key,
                        value: make_node(AST_Undefined, prop).optimize(compressor)
                    }) : prop);
                });
            } else {
                generated = true;
                flush();
                values.push(prop);
            }
        });
        flush();
        if (!changed) return self;
        if (found && generated && values.length == 1) {
            var value = values[0];
            if (value instanceof AST_ObjectProperty && value.key instanceof AST_Number) {
                value.key = "" + value.key.value;
            }
        }
        return changed ? make_node(AST_Object, self, {
            properties: values
        }) :  self;

        function flush() {
            keys.each(function(props) {
                if (props.length == 1) return values.push(props[0]);
                changed = true;
                var tail = keep_duplicate && !generated && props.pop();
                values.push(props.length == 1 ? props[0] : make_node(AST_ObjectKeyVal, self, {
                    key: props[0].key,
                    value: make_sequence(self, props.map(function(prop) {
                        return prop.value;
                    }))
                }));
                if (tail) values.push(tail);
            });
            keys = new Dictionary();
        }

        function process(prop) {
            var key = prop.key;
            if (key instanceof AST_Node) {
                found = true;
                key = key.evaluate(compressor);
                if (key === prop.key) {
                    generated = true;
                } else {
                    key = prop.key = "" + key;
                }
            }
            if (prop instanceof AST_ObjectKeyVal && typeof key == "string") {
                if (prop.value.has_side_effects(compressor)) flush();
                keys.add(key, prop);
            } else {
                flush();
                values.push(prop);
            }
            if (found && !generated && typeof key == "string" && /^[1-9]*[0-9]$/.test(key)) {
                generated = true;
                if (keys.has(key)) prop = keys.get(key)[0];
                prop.key = make_node(AST_Number, prop, {
                    value: +key
                });
            }
        }
    });

    OPT(AST_Return, function(self, compressor) {
        if (self.value && is_undefined(self.value, compressor)) {
            self.value = null;
        }
        return self;
    });
})(function(node, optimizer) {
    node.DEFMETHOD("optimize", function(compressor) {
        var self = this;
        if (self._optimized) return self;
        if (compressor.has_directive("use asm")) return self;
        var opt = optimizer(self, compressor);
        opt._optimized = true;
        return opt;
    });
});
/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

var vlq_char = characters("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
var vlq_bits = vlq_char.reduce(function(map, ch, bits) {
    map[ch] = bits;
    return map;
}, Object.create(null));

function vlq_decode(indices, str) {
    var value = 0;
    var shift = 0;
    for (var i = 0, j = 0; i < str.length; i++) {
        var bits = vlq_bits[str[i]];
        value += (bits & 31) << shift;
        if (bits & 32) {
            shift += 5;
        } else {
            indices[j++] += value & 1 ? 0x80000000 | -(value >> 1) : value >> 1;
            value = shift = 0;
        }
    }
    return j;
}

function vlq_encode(num) {
    var result = "";
    num = Math.abs(num) << 1 | num >>> 31;
    do {
        var bits = num & 31;
        if (num >>>= 5) bits |= 32;
        result += vlq_char[bits];
    } while (num);
    return result;
}

function create_array_map() {
    var map = Object.create(null);
    var array = [];
    array.index = function(name) {
        if (!HOP(map, name)) {
            map[name] = array.length;
            array.push(name);
        }
        return map[name];
    };
    return array;
}

function SourceMap(options) {
    var sources = create_array_map();
    var sources_content = options.includeSources && Object.create(null);
    var names = create_array_map();
    var mappings = "";
    if (options.orig) Object.keys(options.orig).forEach(function(name) {
        var map = options.orig[name];
        var indices = [ 0, 0, 1, 0, 0 ];
        options.orig[name] = {
            names: map.names,
            mappings: map.mappings.split(/;/).map(function(line) {
                indices[0] = 0;
                return line.split(/,/).map(function(segment) {
                    return indices.slice(0, vlq_decode(indices, segment));
                });
            }),
            sources: map.sources,
        };
        if (!sources_content || !map.sourcesContent) return;
        for (var i = 0; i < map.sources.length; i++) {
            var content = map.sourcesContent[i];
            if (content) sources_content[map.sources[i]] = content;
        }
    });
    var prev_source;
    var generated_line = 1;
    var generated_column = 0;
    var source_index = 0;
    var original_line = 1;
    var original_column = 0;
    var name_index = 0;
    return {
        add: options.orig ? function(source, gen_line, gen_col, orig_line, orig_col, name) {
            var map = options.orig[source];
            if (map) {
                var segments = map.mappings[orig_line - 1];
                if (!segments) return;
                var indices;
                for (var i = 0; i < segments.length; i++) {
                    var col = segments[i][0];
                    if (orig_col >= col) indices = segments[i];
                    if (orig_col <= col) break;
                }
                if (!indices || indices.length < 4) {
                    source = null;
                } else {
                    source = map.sources[indices[1]];
                    orig_line = indices[2];
                    orig_col = indices[3];
                    if (indices.length > 4) name = map.names[indices[4]];
                }
            }
            add(source, gen_line, gen_col, orig_line, orig_col, name);
        } : add,
        setSourceContent: sources_content ? function(source, content) {
            sources_content[source] = content;
        } : noop,
        toString: function() {
            return JSON.stringify({
                version: 3,
                file: options.filename || undefined,
                sourceRoot: options.root || undefined,
                sources: sources,
                sourcesContent: sources_content ? sources.map(function(source) {
                    return sources_content[source] || null;
                }) : undefined,
                names: names,
                mappings: mappings,
            });
        }
    };

    function add(source, gen_line, gen_col, orig_line, orig_col, name) {
        if (prev_source == null && source == null) return;
        prev_source = source;
        if (generated_line < gen_line) {
            generated_column = 0;
            do {
                mappings += ";";
            } while (++generated_line < gen_line);
        } else if (mappings) {
            mappings += ",";
        }
        mappings += vlq_encode(gen_col - generated_column);
        generated_column = gen_col;
        if (source == null) return;
        var src_idx = sources.index(source);
        mappings += vlq_encode(src_idx - source_index);
        source_index = src_idx;
        mappings += vlq_encode(orig_line - original_line);
        original_line = orig_line;
        mappings += vlq_encode(orig_col - original_column);
        original_column = orig_col;
        if (options.names && name != null) {
            var name_idx = names.index(name);
            mappings += vlq_encode(name_idx - name_index);
            name_index = name_idx;
        }
    }
}
/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

(function() {
    function normalize_directives(body) {
        var in_directive = true;
        for (var i = 0; i < body.length; i++) {
            if (in_directive && body[i] instanceof AST_Statement && body[i].body instanceof AST_String) {
                body[i] = new AST_Directive({
                    start: body[i].start,
                    end: body[i].end,
                    value: body[i].body.value
                });
            } else if (in_directive && !(body[i] instanceof AST_Statement && body[i].body instanceof AST_String)) {
                in_directive = false;
            }
        }
        return body;
    }

    var MOZ_TO_ME = {
        Program: function(M) {
            return new AST_Toplevel({
                start: my_start_token(M),
                end: my_end_token(M),
                body: normalize_directives(M.body.map(from_moz))
            });
        },
        FunctionDeclaration: function(M) {
            return new AST_Defun({
                start: my_start_token(M),
                end: my_end_token(M),
                name: from_moz(M.id),
                argnames: M.params.map(from_moz),
                body: normalize_directives(from_moz(M.body).body)
            });
        },
        FunctionExpression: function(M) {
            return new AST_Function({
                start: my_start_token(M),
                end: my_end_token(M),
                name: from_moz(M.id),
                argnames: M.params.map(from_moz),
                body: normalize_directives(from_moz(M.body).body)
            });
        },
        ExpressionStatement: function(M) {
            return new AST_SimpleStatement({
                start: my_start_token(M),
                end: my_end_token(M),
                body: from_moz(M.expression)
            });
        },
        TryStatement: function(M) {
            var handlers = M.handlers || [M.handler];
            if (handlers.length > 1 || M.guardedHandlers && M.guardedHandlers.length) {
                throw new Error("Multiple catch clauses are not supported.");
            }
            return new AST_Try({
                start    : my_start_token(M),
                end      : my_end_token(M),
                body     : from_moz(M.block).body,
                bcatch   : from_moz(handlers[0]),
                bfinally : M.finalizer ? new AST_Finally(from_moz(M.finalizer)) : null
            });
        },
        Property: function(M) {
            var key = M.key;
            var args = {
                start    : my_start_token(key),
                end      : my_end_token(M.value),
                key      : "" + key[key.type == "Identifier" ? "name" : "value"],
                value    : from_moz(M.value)
            };
            if (M.kind == "init") return new AST_ObjectKeyVal(args);
            args.value = new AST_Accessor(args.value);
            if (M.kind == "get") return new AST_ObjectGetter(args);
            if (M.kind == "set") return new AST_ObjectSetter(args);
        },
        ArrayExpression: function(M) {
            return new AST_Array({
                start    : my_start_token(M),
                end      : my_end_token(M),
                elements : M.elements.map(function(elem) {
                    return elem === null ? new AST_Hole() : from_moz(elem);
                })
            });
        },
        ObjectExpression: function(M) {
            return new AST_Object({
                start      : my_start_token(M),
                end        : my_end_token(M),
                properties : M.properties.map(function(prop) {
                    prop.type = "Property";
                    return from_moz(prop)
                })
            });
        },
        SequenceExpression: function(M) {
            return new AST_Sequence({
                start      : my_start_token(M),
                end        : my_end_token(M),
                expressions: M.expressions.map(from_moz)
            });
        },
        MemberExpression: function(M) {
            return new (M.computed ? AST_Sub : AST_Dot)({
                start      : my_start_token(M),
                end        : my_end_token(M),
                property   : M.computed ? from_moz(M.property) : M.property.name,
                expression : from_moz(M.object)
            });
        },
        SwitchCase: function(M) {
            return new (M.test ? AST_Case : AST_Default)({
                start      : my_start_token(M),
                end        : my_end_token(M),
                expression : from_moz(M.test),
                body       : M.consequent.map(from_moz)
            });
        },
        VariableDeclaration: function(M) {
            return new AST_Var({
                start       : my_start_token(M),
                end         : my_end_token(M),
                definitions : M.declarations.map(from_moz)
            });
        },
        Literal: function(M) {
            var val = M.value, args = {
                start  : my_start_token(M),
                end    : my_end_token(M)
            };
            if (val === null) return new AST_Null(args);
            var rx = M.regex;
            if (rx && rx.pattern) {
                // RegExpLiteral as per ESTree AST spec
                args.value = new RegExp(rx.pattern, rx.flags);
                args.value.raw_source = rx.pattern;
                return new AST_RegExp(args);
            } else if (rx) {
                // support legacy RegExp
                args.value = M.regex && M.raw ? M.raw : val;
                return new AST_RegExp(args);
            }
            switch (typeof val) {
              case "string":
                args.value = val;
                return new AST_String(args);
              case "number":
                args.value = val;
                return new AST_Number(args);
              case "boolean":
                return new (val ? AST_True : AST_False)(args);
            }
        },
        Identifier: function(M) {
            var p = FROM_MOZ_STACK[FROM_MOZ_STACK.length - 2];
            return new (  p.type == "LabeledStatement" ? AST_Label
                        : p.type == "VariableDeclarator" && p.id === M ? AST_SymbolVar
                        : p.type == "FunctionExpression" ? (p.id === M ? AST_SymbolLambda : AST_SymbolFunarg)
                        : p.type == "FunctionDeclaration" ? (p.id === M ? AST_SymbolDefun : AST_SymbolFunarg)
                        : p.type == "CatchClause" ? AST_SymbolCatch
                        : p.type == "BreakStatement" || p.type == "ContinueStatement" ? AST_LabelRef
                        : AST_SymbolRef)({
                            start : my_start_token(M),
                            end   : my_end_token(M),
                            name  : M.name
                        });
        },
        ThisExpression: function(M) {
            return new AST_This({
                start : my_start_token(M),
                end   : my_end_token(M),
                name  : "this",
            });
        },
    };

    MOZ_TO_ME.UpdateExpression =
    MOZ_TO_ME.UnaryExpression = function To_Moz_Unary(M) {
        var prefix = "prefix" in M ? M.prefix
            : M.type == "UnaryExpression" ? true : false;
        return new (prefix ? AST_UnaryPrefix : AST_UnaryPostfix)({
            start      : my_start_token(M),
            end        : my_end_token(M),
            operator   : M.operator,
            expression : from_moz(M.argument)
        });
    };

    map("EmptyStatement", AST_EmptyStatement);
    map("BlockStatement", AST_BlockStatement, "body@body");
    map("IfStatement", AST_If, "test>condition, consequent>body, alternate>alternative");
    map("LabeledStatement", AST_LabeledStatement, "label>label, body>body");
    map("BreakStatement", AST_Break, "label>label");
    map("ContinueStatement", AST_Continue, "label>label");
    map("WithStatement", AST_With, "object>expression, body>body");
    map("SwitchStatement", AST_Switch, "discriminant>expression, cases@body");
    map("ReturnStatement", AST_Return, "argument>value");
    map("ThrowStatement", AST_Throw, "argument>value");
    map("WhileStatement", AST_While, "test>condition, body>body");
    map("DoWhileStatement", AST_Do, "test>condition, body>body");
    map("ForStatement", AST_For, "init>init, test>condition, update>step, body>body");
    map("ForInStatement", AST_ForIn, "left>init, right>object, body>body");
    map("DebuggerStatement", AST_Debugger);
    map("VariableDeclarator", AST_VarDef, "id>name, init>value");
    map("CatchClause", AST_Catch, "param>argname, body%body");

    map("BinaryExpression", AST_Binary, "operator=operator, left>left, right>right");
    map("LogicalExpression", AST_Binary, "operator=operator, left>left, right>right");
    map("AssignmentExpression", AST_Assign, "operator=operator, left>left, right>right");
    map("ConditionalExpression", AST_Conditional, "test>condition, consequent>consequent, alternate>alternative");
    map("NewExpression", AST_New, "callee>expression, arguments@args");
    map("CallExpression", AST_Call, "callee>expression, arguments@args");

    def_to_moz(AST_Toplevel, function To_Moz_Program(M) {
        return to_moz_scope("Program", M);
    });

    def_to_moz(AST_Defun, function To_Moz_FunctionDeclaration(M) {
        return {
            type: "FunctionDeclaration",
            id: to_moz(M.name),
            params: M.argnames.map(to_moz),
            body: to_moz_scope("BlockStatement", M)
        }
    });

    def_to_moz(AST_Function, function To_Moz_FunctionExpression(M) {
        return {
            type: "FunctionExpression",
            id: to_moz(M.name),
            params: M.argnames.map(to_moz),
            body: to_moz_scope("BlockStatement", M)
        }
    });

    def_to_moz(AST_Directive, function To_Moz_Directive(M) {
        return {
            type: "ExpressionStatement",
            expression: {
                type: "Literal",
                value: M.value
            }
        };
    });

    def_to_moz(AST_SimpleStatement, function To_Moz_ExpressionStatement(M) {
        return {
            type: "ExpressionStatement",
            expression: to_moz(M.body)
        };
    });

    def_to_moz(AST_SwitchBranch, function To_Moz_SwitchCase(M) {
        return {
            type: "SwitchCase",
            test: to_moz(M.expression),
            consequent: M.body.map(to_moz)
        };
    });

    def_to_moz(AST_Try, function To_Moz_TryStatement(M) {
        return {
            type: "TryStatement",
            block: to_moz_block(M),
            handler: to_moz(M.bcatch),
            guardedHandlers: [],
            finalizer: to_moz(M.bfinally)
        };
    });

    def_to_moz(AST_Catch, function To_Moz_CatchClause(M) {
        return {
            type: "CatchClause",
            param: to_moz(M.argname),
            guard: null,
            body: to_moz_block(M)
        };
    });

    def_to_moz(AST_Definitions, function To_Moz_VariableDeclaration(M) {
        return {
            type: "VariableDeclaration",
            kind: "var",
            declarations: M.definitions.map(to_moz)
        };
    });

    def_to_moz(AST_Sequence, function To_Moz_SequenceExpression(M) {
        return {
            type: "SequenceExpression",
            expressions: M.expressions.map(to_moz)
        };
    });

    def_to_moz(AST_PropAccess, function To_Moz_MemberExpression(M) {
        var isComputed = M instanceof AST_Sub;
        return {
            type: "MemberExpression",
            object: to_moz(M.expression),
            computed: isComputed,
            property: isComputed ? to_moz(M.property) : {type: "Identifier", name: M.property}
        };
    });

    def_to_moz(AST_Unary, function To_Moz_Unary(M) {
        return {
            type: M.operator == "++" || M.operator == "--" ? "UpdateExpression" : "UnaryExpression",
            operator: M.operator,
            prefix: M instanceof AST_UnaryPrefix,
            argument: to_moz(M.expression)
        };
    });

    def_to_moz(AST_Binary, function To_Moz_BinaryExpression(M) {
        return {
            type: M.operator == "&&" || M.operator == "||" ? "LogicalExpression" : "BinaryExpression",
            left: to_moz(M.left),
            operator: M.operator,
            right: to_moz(M.right)
        };
    });

    def_to_moz(AST_Array, function To_Moz_ArrayExpression(M) {
        return {
            type: "ArrayExpression",
            elements: M.elements.map(to_moz)
        };
    });

    def_to_moz(AST_Object, function To_Moz_ObjectExpression(M) {
        return {
            type: "ObjectExpression",
            properties: M.properties.map(to_moz)
        };
    });

    def_to_moz(AST_ObjectProperty, function To_Moz_Property(M) {
        var key = {
            type: "Literal",
            value: M.key
        };
        var kind;
        if (M instanceof AST_ObjectKeyVal) {
            kind = "init";
        } else
        if (M instanceof AST_ObjectGetter) {
            kind = "get";
        } else
        if (M instanceof AST_ObjectSetter) {
            kind = "set";
        }
        return {
            type: "Property",
            kind: kind,
            key: key,
            value: to_moz(M.value)
        };
    });

    def_to_moz(AST_Symbol, function To_Moz_Identifier(M) {
        var def = M.definition();
        return {
            type: "Identifier",
            name: def && def.mangled_name || M.name
        };
    });

    def_to_moz(AST_This, function To_Moz_ThisExpression() {
        return { type: "ThisExpression" };
    });

    def_to_moz(AST_RegExp, function To_Moz_RegExpLiteral(M) {
        var flags = M.value.toString().match(/[gimuy]*$/)[0];
        var value = "/" + M.value.raw_source + "/" + flags;
        return {
            type: "Literal",
            value: value,
            raw: value,
            regex: {
                pattern: M.value.raw_source,
                flags: flags
            }
        };
    });

    def_to_moz(AST_Constant, function To_Moz_Literal(M) {
        var value = M.value;
        if (typeof value === 'number' && (value < 0 || (value === 0 && 1 / value < 0))) {
            return {
                type: "UnaryExpression",
                operator: "-",
                prefix: true,
                argument: {
                    type: "Literal",
                    value: -value,
                    raw: M.start.raw
                }
            };
        }
        return {
            type: "Literal",
            value: value,
            raw: M.start.raw
        };
    });

    def_to_moz(AST_Atom, function To_Moz_Atom(M) {
        return {
            type: "Identifier",
            name: String(M.value)
        };
    });

    AST_Boolean.DEFMETHOD("to_mozilla_ast", AST_Constant.prototype.to_mozilla_ast);
    AST_Null.DEFMETHOD("to_mozilla_ast", AST_Constant.prototype.to_mozilla_ast);
    AST_Hole.DEFMETHOD("to_mozilla_ast", function To_Moz_ArrayHole() { return null });

    AST_Block.DEFMETHOD("to_mozilla_ast", AST_BlockStatement.prototype.to_mozilla_ast);
    AST_Lambda.DEFMETHOD("to_mozilla_ast", AST_Function.prototype.to_mozilla_ast);

    /* -----[ tools ]----- */

    function raw_token(moznode) {
        if (moznode.type == "Literal") {
            return moznode.raw != null ? moznode.raw : moznode.value + "";
        }
    }

    function my_start_token(moznode) {
        var loc = moznode.loc, start = loc && loc.start;
        var range = moznode.range;
        return new AST_Token({
            file    : loc && loc.source,
            line    : start && start.line,
            col     : start && start.column,
            pos     : range ? range[0] : moznode.start,
            endline : start && start.line,
            endcol  : start && start.column,
            endpos  : range ? range[0] : moznode.start,
            raw     : raw_token(moznode),
        });
    }

    function my_end_token(moznode) {
        var loc = moznode.loc, end = loc && loc.end;
        var range = moznode.range;
        return new AST_Token({
            file    : loc && loc.source,
            line    : end && end.line,
            col     : end && end.column,
            pos     : range ? range[1] : moznode.end,
            endline : end && end.line,
            endcol  : end && end.column,
            endpos  : range ? range[1] : moznode.end,
            raw     : raw_token(moznode),
        });
    }

    function map(moztype, mytype, propmap) {
        var moz_to_me = "function From_Moz_" + moztype + "(M){\n";
        moz_to_me += "return new U2." + mytype.name + "({\n" +
            "start: my_start_token(M),\n" +
            "end: my_end_token(M)";

        var me_to_moz = "function To_Moz_" + moztype + "(M){\n";
        me_to_moz += "return {\n" +
            "type: " + JSON.stringify(moztype);

        if (propmap) propmap.split(/\s*,\s*/).forEach(function(prop) {
            var m = /([a-z0-9$_]+)(=|@|>|%)([a-z0-9$_]+)/i.exec(prop);
            if (!m) throw new Error("Can't understand property map: " + prop);
            var moz = m[1], how = m[2], my = m[3];
            moz_to_me += ",\n" + my + ": ";
            me_to_moz += ",\n" + moz + ": ";
            switch (how) {
                case "@":
                    moz_to_me += "M." + moz + ".map(from_moz)";
                    me_to_moz += "M." +  my + ".map(to_moz)";
                    break;
                case ">":
                    moz_to_me += "from_moz(M." + moz + ")";
                    me_to_moz += "to_moz(M." + my + ")";
                    break;
                case "=":
                    moz_to_me += "M." + moz;
                    me_to_moz += "M." + my;
                    break;
                case "%":
                    moz_to_me += "from_moz(M." + moz + ").body";
                    me_to_moz += "to_moz_block(M)";
                    break;
                default:
                    throw new Error("Can't understand operator in propmap: " + prop);
            }
        });

        moz_to_me += "\n})\n}";
        me_to_moz += "\n}\n}";

        //moz_to_me = parse(moz_to_me).print_to_string({ beautify: true });
        //me_to_moz = parse(me_to_moz).print_to_string({ beautify: true });
        //console.log(moz_to_me);

        moz_to_me = new Function("U2", "my_start_token", "my_end_token", "from_moz", "return(" + moz_to_me + ")")(
            exports, my_start_token, my_end_token, from_moz
        );
        me_to_moz = new Function("to_moz", "to_moz_block", "to_moz_scope", "return(" + me_to_moz + ")")(
            to_moz, to_moz_block, to_moz_scope
        );
        MOZ_TO_ME[moztype] = moz_to_me;
        def_to_moz(mytype, me_to_moz);
    }

    var FROM_MOZ_STACK = null;

    function from_moz(node) {
        FROM_MOZ_STACK.push(node);
        var ret = node != null ? MOZ_TO_ME[node.type](node) : null;
        FROM_MOZ_STACK.pop();
        return ret;
    }

    AST_Node.from_mozilla_ast = function(node) {
        var save_stack = FROM_MOZ_STACK;
        FROM_MOZ_STACK = [];
        var ast = from_moz(node);
        FROM_MOZ_STACK = save_stack;
        ast.walk(new TreeWalker(function(node) {
            if (node instanceof AST_LabelRef) {
                for (var level = 0, parent; parent = this.parent(level); level++) {
                    if (parent instanceof AST_Scope) break;
                    if (parent instanceof AST_LabeledStatement && parent.label.name == node.name) {
                        node.thedef = parent.label;
                        break;
                    }
                }
                if (!node.thedef) {
                    var s = node.start;
                    js_error("Undefined label " + node.name, s.file, s.line, s.col, s.pos);
                }
            }
        }));
        return ast;
    };

    function set_moz_loc(mynode, moznode, myparent) {
        var start = mynode.start;
        var end = mynode.end;
        if (start.pos != null && end.endpos != null) {
            moznode.range = [start.pos, end.endpos];
        }
        if (start.line) {
            moznode.loc = {
                start: {line: start.line, column: start.col},
                end: end.endline ? {line: end.endline, column: end.endcol} : null
            };
            if (start.file) {
                moznode.loc.source = start.file;
            }
        }
        return moznode;
    }

    function def_to_moz(mytype, handler) {
        mytype.DEFMETHOD("to_mozilla_ast", function() {
            return set_moz_loc(this, handler(this));
        });
    }

    function to_moz(node) {
        return node != null ? node.to_mozilla_ast() : null;
    }

    function to_moz_block(node) {
        return {
            type: "BlockStatement",
            body: node.body.map(to_moz)
        };
    }

    function to_moz_scope(type, node) {
        var body = node.body.map(to_moz);
        if (node.body[0] instanceof AST_SimpleStatement && node.body[0].body instanceof AST_String) {
            body.unshift(to_moz(new AST_EmptyStatement(node.body[0])));
        }
        return {
            type: type,
            body: body
        };
    }
})();
/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

var builtins = function() {
    var names = [];
    // NaN will be included due to Number.NaN
    [
        "null",
        "true",
        "false",
        "Infinity",
        "-Infinity",
        "undefined",
    ].forEach(add);
    [
        Array,
        Boolean,
        Date,
        Error,
        Function,
        Math,
        Number,
        Object,
        RegExp,
        String,
    ].forEach(function(ctor) {
        Object.getOwnPropertyNames(ctor).map(add);
        if (ctor.prototype) {
            Object.getOwnPropertyNames(new ctor()).map(add);
            Object.getOwnPropertyNames(ctor.prototype).map(add);
        }
    });
    return makePredicate(names);

    function add(name) {
        names.push(name);
    }
}();

function reserve_quoted_keys(ast, reserved) {
    ast.walk(new TreeWalker(function(node) {
        if (node instanceof AST_ObjectProperty) {
            if (node.start && node.start.quote) add(node.key);
        } else if (node instanceof AST_Sub) {
            addStrings(node.property, add);
        }
    }));

    function add(name) {
        push_uniq(reserved, name);
    }
}

function addStrings(node, add) {
    if (node instanceof AST_Conditional) {
        addStrings(node.consequent, add);
        addStrings(node.alternative, add);
    } else if (node instanceof AST_Sequence) {
        addStrings(node.tail_node(), add);
    } else if (node instanceof AST_String) {
        add(node.value);
    }
}

function mangle_properties(ast, options) {
    options = defaults(options, {
        builtins: false,
        cache: null,
        debug: false,
        keep_quoted: false,
        regex: null,
        reserved: null,
    }, true);

    var reserved = Object.create(options.builtins ? null : builtins);
    if (Array.isArray(options.reserved)) options.reserved.forEach(function(name) {
        reserved[name] = true;
    });

    var cname = -1;
    var cache;
    if (options.cache) {
        cache = options.cache.props;
        cache.each(function(name) {
            reserved[name] = true;
        });
    } else {
        cache = new Dictionary();
    }

    var regex = options.regex;

    // note debug is either false (disabled), or a string of the debug suffix to use (enabled).
    // note debug may be enabled as an empty string, which is falsey. Also treat passing 'true'
    // the same as passing an empty string.
    var debug = options.debug !== false;
    var debug_suffix;
    if (debug) debug_suffix = options.debug === true ? "" : options.debug;

    var names_to_mangle = Object.create(null);
    var unmangleable = Object.create(reserved);

    // step 1: find candidates to mangle
    ast.walk(new TreeWalker(function(node) {
        if (node instanceof AST_Binary) {
            if (node.operator == "in") addStrings(node.left, add);
        } else if (node.TYPE == "Call") {
            var exp = node.expression;
            if (exp instanceof AST_Dot) switch (exp.property) {
              case "defineProperty":
              case "getOwnPropertyDescriptor":
                if (node.args.length < 2) break;
                exp = exp.expression;
                if (!(exp instanceof AST_SymbolRef)) break;
                if (exp.name != "Object") break;
                if (!exp.definition().undeclared) break;
                addStrings(node.args[1], add);
                break;
              case "hasOwnProperty":
                if (node.args.length < 1) break;
                addStrings(node.args[0], add);
                break;
            }
        } else if (node instanceof AST_Dot) {
            add(node.property);
        } else if (node instanceof AST_ObjectProperty) {
            if (typeof node.key == "string") add(node.key);
        } else if (node instanceof AST_Sub) {
            addStrings(node.property, add);
        }
    }));

    // step 2: renaming properties
    ast.walk(new TreeWalker(function(node) {
        if (node instanceof AST_Binary) {
            if (node.operator == "in") mangleStrings(node.left);
        } else if (node.TYPE == "Call") {
            var exp = node.expression;
            if (exp instanceof AST_Dot) switch (exp.property) {
              case "defineProperty":
              case "getOwnPropertyDescriptor":
                if (node.args.length < 2) break;
                exp = exp.expression;
                if (!(exp instanceof AST_SymbolRef)) break;
                if (exp.name != "Object") break;
                if (!exp.definition().undeclared) break;
                mangleStrings(node.args[1]);
                break;
              case "hasOwnProperty":
                if (node.args.length < 1) break;
                mangleStrings(node.args[0]);
                break;
            }
        } else if (node instanceof AST_Dot) {
            node.property = mangle(node.property);
        } else if (node instanceof AST_ObjectProperty) {
            if (typeof node.key == "string") node.key = mangle(node.key);
        } else if (node instanceof AST_Sub) {
            if (!options.keep_quoted) mangleStrings(node.property);
        }
    }));

    // only function declarations after this line

    function can_mangle(name) {
        if (unmangleable[name]) return false;
        if (/^-?[0-9]+(\.[0-9]+)?(e[+-][0-9]+)?$/.test(name)) return false;
        return true;
    }

    function should_mangle(name) {
        if (reserved[name]) return false;
        if (regex && !regex.test(name)) return false;
        return cache.has(name) || names_to_mangle[name];
    }

    function add(name) {
        if (can_mangle(name)) names_to_mangle[name] = true;
        if (!should_mangle(name)) unmangleable[name] = true;
    }

    function mangle(name) {
        if (!should_mangle(name)) {
            return name;
        }
        var mangled = cache.get(name);
        if (!mangled) {
            if (debug) {
                // debug mode: use a prefix and suffix to preserve readability, e.g. o.foo -> o._$foo$NNN_.
                var debug_mangled = "_$" + name + "$" + debug_suffix + "_";
                if (can_mangle(debug_mangled)) mangled = debug_mangled;
            }
            // either debug mode is off, or it is on and we could not use the mangled name
            if (!mangled) do {
                mangled = base54(++cname);
            } while (!can_mangle(mangled));
            cache.set(name, mangled);
        }
        return mangled;
    }

    function mangleStrings(node) {
        if (node instanceof AST_Sequence) {
            mangleStrings(node.expressions.tail_node());
        } else if (node instanceof AST_String) {
            node.value = mangle(node.value);
        } else if (node instanceof AST_Conditional) {
            mangleStrings(node.consequent);
            mangleStrings(node.alternative);
        }
    }
}
"use strict";

var to_ascii, to_base64;
if (typeof Buffer == "undefined") {
    to_ascii = atob;
    to_base64 = btoa;
} else if (typeof Buffer.alloc == "undefined") {
    to_ascii = function(b64) {
        return new Buffer(b64, "base64").toString();
    };
    to_base64 = function(str) {
        return new Buffer(str).toString("base64");
    };
} else {
    to_ascii = function(b64) {
        return Buffer.from(b64, "base64").toString();
    };
    to_base64 = function(str) {
        return Buffer.from(str).toString("base64");
    };
}

function read_source_map(name, toplevel) {
    var comments = toplevel.end.comments_after;
    for (var i = comments.length; --i >= 0;) {
        var comment = comments[i];
        if (comment.type != "comment1") break;
        var match = /^# ([^\s=]+)=(\S+)\s*$/.exec(comment.value);
        if (!match) break;
        if (match[1] == "sourceMappingURL") {
            match = /^data:application\/json(;.*?)?;base64,(\S+)$/.exec(match[2]);
            if (!match) break;
            return to_ascii(match[2]);
        }
    }
    AST_Node.warn("inline source map not found: {name}", {
        name: name,
    });
}

function parse_source_map(content) {
    try {
        return JSON.parse(content);
    } catch (ex) {
        throw new Error("invalid input source map: " + content);
    }
}

function set_shorthand(name, options, keys) {
    if (options[name]) {
        keys.forEach(function(key) {
            if (options[key]) {
                if (typeof options[key] != "object") options[key] = {};
                if (!(name in options[key])) options[key][name] = options[name];
            }
        });
    }
}

function init_cache(cache) {
    if (!cache) return;
    if (!("props" in cache)) {
        cache.props = new Dictionary();
    } else if (!(cache.props instanceof Dictionary)) {
        cache.props = Dictionary.fromObject(cache.props);
    }
}

function to_json(cache) {
    return {
        props: cache.props.toObject()
    };
}

function minify(files, options) {
    try {
        options = defaults(options, {
            compress: {},
            enclose: false,
            ie8: false,
            keep_fnames: false,
            mangle: {},
            nameCache: null,
            output: {},
            parse: {},
            rename: undefined,
            sourceMap: false,
            timings: false,
            toplevel: false,
            v8: false,
            validate: false,
            warnings: false,
            webkit: false,
            wrap: false,
        }, true);
        if (options.validate) AST_Node.enable_validation();
        var timings = options.timings && {
            start: Date.now()
        };
        if (options.rename === undefined) {
            options.rename = options.compress && options.mangle;
        }
        set_shorthand("ie8", options, [ "compress", "mangle", "output" ]);
        set_shorthand("keep_fnames", options, [ "compress", "mangle" ]);
        set_shorthand("toplevel", options, [ "compress", "mangle" ]);
        set_shorthand("v8", options, [ "mangle", "output" ]);
        set_shorthand("webkit", options, [ "mangle", "output" ]);
        var quoted_props;
        if (options.mangle) {
            options.mangle = defaults(options.mangle, {
                cache: options.nameCache && (options.nameCache.vars || {}),
                eval: false,
                ie8: false,
                keep_fnames: false,
                properties: false,
                reserved: [],
                toplevel: false,
                v8: false,
                webkit: false,
            }, true);
            if (options.mangle.properties) {
                if (typeof options.mangle.properties != "object") {
                    options.mangle.properties = {};
                }
                if (options.mangle.properties.keep_quoted) {
                    quoted_props = options.mangle.properties.reserved;
                    if (!Array.isArray(quoted_props)) quoted_props = [];
                    options.mangle.properties.reserved = quoted_props;
                }
                if (options.nameCache && !("cache" in options.mangle.properties)) {
                    options.mangle.properties.cache = options.nameCache.props || {};
                }
            }
            init_cache(options.mangle.cache);
            init_cache(options.mangle.properties.cache);
        }
        if (options.sourceMap) {
            options.sourceMap = defaults(options.sourceMap, {
                content: null,
                filename: null,
                includeSources: false,
                names: true,
                root: null,
                url: null,
            }, true);
        }
        var warnings = [];
        if (options.warnings) AST_Node.log_function(function(warning) {
            warnings.push(warning);
        }, options.warnings == "verbose");
        if (timings) timings.parse = Date.now();
        var toplevel;
        if (files instanceof AST_Toplevel) {
            toplevel = files;
        } else {
            if (typeof files == "string") {
                files = [ files ];
            }
            options.parse = options.parse || {};
            options.parse.toplevel = null;
            var source_map_content = options.sourceMap && options.sourceMap.content;
            if (typeof source_map_content == "string" && source_map_content != "inline") {
                source_map_content = parse_source_map(source_map_content);
            }
            if (source_map_content) options.sourceMap.orig = Object.create(null);
            for (var name in files) if (HOP(files, name)) {
                options.parse.filename = name;
                options.parse.toplevel = toplevel = parse(files[name], options.parse);
                if (source_map_content == "inline") {
                    var inlined_content = read_source_map(name, toplevel);
                    if (inlined_content) {
                        options.sourceMap.orig[name] = parse_source_map(inlined_content);
                    }
                } else if (source_map_content) {
                    options.sourceMap.orig[name] = source_map_content;
                }
            }
        }
        if (quoted_props) {
            reserve_quoted_keys(toplevel, quoted_props);
        }
        [ "enclose", "wrap" ].forEach(function(action) {
            var option = options[action];
            if (!option) return;
            var orig = toplevel.print_to_string().slice(0, -1);
            toplevel = toplevel[action](option);
            files[toplevel.start.file] = toplevel.print_to_string().replace(orig, "");
        });
        if (options.validate) toplevel.validate_ast();
        if (timings) timings.rename = Date.now();
        if (options.rename) {
            toplevel.figure_out_scope(options.mangle);
            toplevel.expand_names(options.mangle);
        }
        if (timings) timings.compress = Date.now();
        if (options.compress) {
            toplevel = new Compressor(options.compress).compress(toplevel);
            if (options.validate) toplevel.validate_ast();
        }
        if (timings) timings.scope = Date.now();
        if (options.mangle) toplevel.figure_out_scope(options.mangle);
        if (timings) timings.mangle = Date.now();
        if (options.mangle) {
            toplevel.compute_char_frequency(options.mangle);
            toplevel.mangle_names(options.mangle);
        }
        if (timings) timings.properties = Date.now();
        if (options.mangle && options.mangle.properties) mangle_properties(toplevel, options.mangle.properties);
        if (timings) timings.output = Date.now();
        var result = {};
        if (options.output.ast) {
            result.ast = toplevel;
        }
        if (!HOP(options.output, "code") || options.output.code) {
            if (options.sourceMap) {
                options.output.source_map = SourceMap(options.sourceMap);
                if (options.sourceMap.includeSources) {
                    if (files instanceof AST_Toplevel) {
                        throw new Error("original source content unavailable");
                    } else for (var name in files) if (HOP(files, name)) {
                        options.output.source_map.setSourceContent(name, files[name]);
                    }
                }
            }
            delete options.output.ast;
            delete options.output.code;
            var stream = OutputStream(options.output);
            toplevel.print(stream);
            result.code = stream.get();
            if (options.sourceMap) {
                result.map = options.output.source_map.toString();
                var url = options.sourceMap.url;
                if (url) {
                    result.code = result.code.replace(/\n\/\/# sourceMappingURL=\S+\s*$/, "");
                    if (url == "inline") {
                        result.code += "\n//# sourceMappingURL=data:application/json;charset=utf-8;base64," + to_base64(result.map);
                    } else {
                        result.code += "\n//# sourceMappingURL=" + url;
                    }
                }
            }
        }
        if (options.nameCache && options.mangle) {
            if (options.mangle.cache) options.nameCache.vars = to_json(options.mangle.cache);
            if (options.mangle.properties && options.mangle.properties.cache) {
                options.nameCache.props = to_json(options.mangle.properties.cache);
            }
        }
        if (timings) {
            timings.end = Date.now();
            result.timings = {
                parse: 1e-3 * (timings.rename - timings.parse),
                rename: 1e-3 * (timings.compress - timings.rename),
                compress: 1e-3 * (timings.scope - timings.compress),
                scope: 1e-3 * (timings.mangle - timings.scope),
                mangle: 1e-3 * (timings.properties - timings.mangle),
                properties: 1e-3 * (timings.output - timings.properties),
                output: 1e-3 * (timings.end - timings.output),
                total: 1e-3 * (timings.end - timings.start)
            };
        }
        if (warnings.length) {
            result.warnings = warnings;
        }
        return result;
    } catch (ex) {
        return { error: ex };
    } finally {
        AST_Node.log_function();
        AST_Node.disable_validation();
    }
}

// FLIBBLES Everything above this comment is 'cat'ed together from other files
// ----------------------------------------
// FLIBBLES Everything below this comment is custom'ish
/* This file was created by concatenating together the following UglifyJS files

    lib/utils.js
    lib/ast.js
    lib/parse.js
    lib/transform.js
    lib/scope.js
    lib/output.js
    lib/compress.js
    lib/sourcemap.js
    lib/mozilla-ast.js
    lib/propmangle.js
    lib/minify.js

	...or the same files (and order) as implied in tools/node.js. Then add the method(s) below.
*/

var logger = require('../logger.js');

exports.compress = function(text, title) {
	var code = {};
	code[title] = text;
	var options = {
		toplevel: true, // top level can be minified. These are modules.
		output: {quote_style: 1}}; // single quotes. Smaller in TW.
	var results = minify(code, options);
	if (results.error) {
		var err = results.error;
		logger.warn('Failed to compress', err.filename + '.\n\n    * message:', err.message, '\n    * line:', err.line, '\n    * col:', err.col, '\n    * pos:', err.pos);
		// Return the uncompressed text as a backup
		return text;
	}
	return results.code;
};
