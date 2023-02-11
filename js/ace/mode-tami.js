ace.define(
    "ace/mode/tami_highlight_rules",
    ["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"],
    function(require, exports, module) {
        "use strict";

        let oop = require("../lib/oop");
        let TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

        let TamiHighlightRules = function() {

            const abc_operators = "abs|comp|not|rand|add|sub|mul|div|pow|mod|and|or|band|bor|xor|lsh|rsh|gt|ge|lt|le|eq|ne|min|max";
            const sym_operators = "!=|:|~|!|@|\\+|\\-|\\*\\*|\\/|\\*|%|&&|\\|\\||&|\\||\\^|==|<<=|>>=|<<|>>|>=|>|<=|<";
            const variable = "[a-zA-Z_][a-zA-Z0-9_]*";

            this.$rules = {
                "start" : [
                    {
                        // comment
                        token : "comment",
                        regex : "^\\s*// .*$"
                    }, {
                        // if
                        token: "keyword.control",
                        regex: "^\\s+if (?=.+:)",
                        next: "condition"
                    }, {
                        // else
                        token: "keyword.control",
                        regex: "^\\s+else:$"
                    }, {
                        // pause
                        token: "keyword.control",
                        regex: "^\\s+\\.\\.\\.$"
                    }, {
                        // stop
                        token: "keyword.control",
                        regex: "^\\s+\\.$"
                    }, {
                        // clear
                        token: "keyword",
                        regex: "^\\s+\\[\\]$"
                    }, {
                        // location
                        token: "string",
                        regex: "^\\[[^<\\[\\]>]+\\]$"
                    }, {
                        // action
                        token: "string",
                        regex: "^\\s*\\> (.+):$"
                    }, {
                        // goto
                        token: "keyword.control",
                        regex: "^\\s*(jump|call) ",
                        next: "label"
                    }, {
                        // variable assign
                        token: "variable",
                        regex: "^\\s*(" + variable + ")(?=\\s+=\\s+)",
                        next: "expression"
                    }, {
                        // action in text
                        token: "string",
                        regex: "\\[[^[:\\]]+\\]"
                    }, {
                        // inventory add
                        token: "support.constant",
                        regex: "^\\s*\\+{[^<>{}]+}$"
                    }, {
                        // inventory remove
                        token: "support.constant",
                        regex: "^\\s+\\-{[^<>{}()]*}$"
                    }, {
                        // variable in text
                        token: "variable",
                        regex: "\\[:" + variable + ":\\]"
                    }, {
                        // person
                        token: "keyword",
                        regex: "^\\s*character (?=" + variable + "\\s+=[^=]+$)",
                        next: "person"
                    }, {
                        // menu
                        token: "keyword",
                        regex: "^\\s+\\+\\s(?=[^:]+:$)",
                        next: "menu"
                    }, {
                        // dialog
                        token: "variable",
                        regex: "^\\s+([a-zA-Z_][a-zA-Z0-9_]*)(?=:\\s(.+)$)",
                        next: "dialog"
                    }
                ],
                "expression": [
                    {
                        token: "constant.numeric",
                        regex: "\\b\\d+\\b"
                    }, {
                        token: "keyword.operator",
                        regex: "(" + sym_operators + ")(?=.)"
                    }, {
                        token: "keyword",
                        regex: "\\b(" + abc_operators + ")\\b"
                    }, {
                        token: "support.constant",
                        regex: "{[^{}]+}"
                    }, {
                        token: "variable",
                        regex: variable
                    }, {
                        token: "keyword.control",
                        regex: "$",
                        next: "start"
                    }
                ],
                "label": [
                    {
                        token: "string",
                        regex: ".+"
                    }, {
                        token: "keyword.control",
                        regex: "$",
                        next: "start"
                    }
                ],
                "person": [
                    {
                        token: "variable",
                        regex: variable + "(?=\\s+=[^=]+$)",
                    }, {
                        token: "keyword.control",
                        regex: "$",
                        next: "start"
                    }
                ],
                "condition" : [
                    {
                        include: "expression"
                    }, {
                        token: "keyword",
                        regex: ":$",
                        next: "start"
                    }
                ],
                "menu" : [
                    {
                        token: "string",
                        regex: "[^:]+",
                    }, {
                        token: "keyword",
                        regex: ":$",
                        next: "start"
                    }
                ],
                "dialog" : [
                    {
                        token: "text",
                        regex: ".+(?=$)",
                    }, {
                        token: "keyword",
                        regex: "$",
                        next: "start"
                    }
                ]
            };
            this.normalizeRules();
        };

        oop.inherits(TamiHighlightRules, TextHighlightRules);

        exports.TamiHighlightRules = TamiHighlightRules;
});

ace.define(
    "ace/mode/folding/tami",
    ["require","exports","module","ace/lib/oop","ace/mode/folding/fold_mode"],
    function(require, exports, module) {
        "use strict";
        var oop = require("../../lib/oop");
        var BaseFoldMode = require("./fold_mode").FoldMode;
        var FoldMode = exports.FoldMode = function (markers) {
            this.foldingStartMarker = new RegExp("([\\[{])(?:\\s*)$|(" + markers + ")(?:\\s*)(?:#.*)?$");
        };
        oop.inherits(FoldMode, BaseFoldMode);
        (function () {
            this.getFoldWidgetRange = function (session, foldStyle, row) {
                var line = session.getLine(row);
                var match = line.match(this.foldingStartMarker);
                if (match) {
                    if (match[1])
                        return this.openingBracketBlock(session, match[1], row, match.index);
                    if (match[2])
                        return this.indentationBlock(session, row, match.index + match[2].length);
                    return this.indentationBlock(session, row);
                }
            };
        }).call(FoldMode.prototype);
});

ace.define(
    "ace/mode/tami",
    ["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/tami_highlight_rules","ace/mode/folding/tami","ace/range"],
    function(require, exports, module) {
        "use strict";
        var oop = require("../lib/oop");
        var TextMode = require("./text").Mode;
        var TamiHighlightRules = require("./tami_highlight_rules").TamiHighlightRules;
        var TamiFoldMode = require("./folding/tami").FoldMode;
        var Range = require("../range").Range;
        var Mode = function () {
            this.HighlightRules = TamiHighlightRules;
            this.foldingRules = new TamiFoldMode("\\:");
            this.$behaviour = this.$defaultBehaviour;
        };
        oop.inherits(Mode, TextMode);
        (function () {
            this.lineCommentStart = "//";
            this.getNextLineIndent = function (state, line, tab) {
                var indent = this.$getIndent(line);
                var tokenizedLine = this.getTokenizer().getLineTokens(line, state);
                var tokens = tokenizedLine.tokens;
                if (tokens.length && tokens[tokens.length - 1].type === "comment") {
                    return indent;
                }
                if (state === "start") {
                    console.log(tokens);
                    if (line.match(/^.*:$/)) {
                        indent += tab;
                    } else if (tokens.length === 1 && tokens[0].type === "string" && line.match(/^.*]$/)) {
                        indent += tab;
                    } else if (tokens.length === 1 && line.match(/^\s+\.$/)) {
                        //indent -= tab;
                    }
                }
                return indent;
            };
            const outdents = {
                ".": 1
            };
            this.checkOutdent = function (state, line, input) {
                if (input !== "\r\n" && input !== "\r" && input !== "\n")
                    return false;
                var tokens = this.getTokenizer().getLineTokens(line.trim(), state).tokens;
                if (!tokens)
                    return false;
                do {
                    var last = tokens.pop();
                } while (last && (last.type === "comment" || (last.type === "text" && last.value.match(/^\s+$/))));
                if (!last)
                    return false;
                return (last.type === "text" && outdents[last.value]);
            };
            this.autoOutdent = function (state, doc, row) {
                row += 1;
                var indent = this.$getIndent(doc.getLine(row));
                var tab = doc.getTabString();
                if (indent.slice(-tab.length) === tab)
                    doc.remove(new Range(row, indent.length - tab.length, row, indent.length));
            };
            this.$id = "ace/mode/tami";
            this.snippetFileId = "ace/snippets/text";
        }).call(Mode.prototype);
        exports.Mode = Mode;

});

(function() {
    ace.require(["ace/mode/tami"], function(m) {
        if (typeof module === "object" && typeof exports === "object" && module) {
            module.exports = m;
        }
    });
})();
