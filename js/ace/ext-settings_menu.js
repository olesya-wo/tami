ace.define("ace/ext/menu_tools/settings_menu.css",["require","exports","module"], function(require, exports, module){module.exports = "#ace_settingsmenu, #kbshortcutmenu {\n    background-color: #F7F7F7;\n    color: black;\n    box-shadow: -5px 4px 5px rgba(126, 126, 126, 0.55);\n    padding: 1em 0.5em 2em 1em;\n    overflow: auto;\n    position: absolute;\n    margin: 0;\n    bottom: 0;\n    right: 0;\n    top: 0;\n    z-index: 9991;\n    cursor: default;\n}\n\n.ace_dark #ace_settingsmenu, .ace_dark #kbshortcutmenu {\n    box-shadow: -20px 10px 25px rgba(126, 126, 126, 0.25);\n    background-color: rgba(255, 255, 255, 0.6);\n    color: black;\n}\n\n.ace_optionsMenuEntry:hover {\n    background-color: rgba(100, 100, 100, 0.1);\n    transition: all 0.3s\n}\n\n.ace_closeButton {\n    background: rgba(245, 146, 146, 0.5);\n    border: 1px solid #F48A8A;\n    border-radius: 50%;\n    padding: 7px;\n    position: absolute;\n    right: -8px;\n    top: -8px;\n    z-index: 100000;\n}\n.ace_closeButton{\n    background: rgba(245, 146, 146, 0.9);\n}\n.ace_optionsMenuKey {\n    color: darkslateblue;\n    font-weight: bold;\n}\n.ace_optionsMenuCommand {\n    color: darkcyan;\n    font-weight: normal;\n}\n.ace_optionsMenuEntry input, .ace_optionsMenuEntry button {\n    vertical-align: middle;\n}\n\n.ace_optionsMenuEntry button[ace_selected_button=true] {\n    background: #e7e7e7;\n    box-shadow: 1px 0px 2px 0px #adadad inset;\n    border-color: #adadad;\n}\n.ace_optionsMenuEntry button {\n    background: white;\n    border: 1px solid lightgray;\n    margin: 0px;\n}\n.ace_optionsMenuEntry button:hover{\n    background: #f0f0f0;\n}";

});

ace.define("ace/ext/menu_tools/overlay_page",["require","exports","module","ace/lib/dom","ace/ext/menu_tools/settings_menu.css"], function(require, exports, module){/*jslint indent: 4, maxerr: 50, white: true, browser: true, vars: true*/
'use strict';
let dom = require("../../lib/dom");
let cssText = require("./settings_menu.css");
dom.importCssString(cssText, "settings_menu.css", false);
module.exports.overlayPage = function overlayPage(editor, contentElement, callback) {
    let closer = document.createElement('div');
    let ignoreFocusOut = false;
    function documentEscListener(e) {
        if (e.keyCode === 27) {
            close();
        }
    }
    function close() {
        if (!closer)
            return;
        document.removeEventListener('keydown', documentEscListener);
        closer.parentNode.removeChild(closer);
        if (editor) {
            editor.focus();
        }
        closer = null;
        callback && callback();
    }
    function setIgnoreFocusOut(ignore) {
        ignoreFocusOut = ignore;
        if (ignore) {
            closer.style.pointerEvents = "none";
            contentElement.style.pointerEvents = "auto";
        }
    }
    closer.style.cssText = 'margin: 0; padding: 0; ' +
        'position: fixed; top:0; bottom:0; left:0; right:0;' +
        'z-index: 9990; ' +
        (editor ? 'background-color: rgba(0, 0, 0, 0.3);' : '');
    closer.addEventListener('click', function (e) {
        if (!ignoreFocusOut) {
            close();
        }
    });
    document.addEventListener('keydown', documentEscListener);
    contentElement.addEventListener('click', function (e) {
        e.stopPropagation();
    });
    closer.appendChild(contentElement);
    document.body.appendChild(closer);
    if (editor) {
        editor.blur();
    }
    return {
        close: close,
        setIgnoreFocusOut: setIgnoreFocusOut
    };
};

});

ace.define("ace/ext/modelist",["require","exports","module"], function(require, exports, module){"use strict";
let modes = [];
function getModeForPath(path) {
    let mode = modesByName.text;
    let fileName = path.split(/[\/\\]/).pop();
    for (let i = 0; i < modes.length; i++) {
        if (modes[i].supportsFile(fileName)) {
            mode = modes[i];
            break;
        }
    }
    return mode;
}
let Mode = function (name, caption, extensions) {
    this.name = name;
    this.caption = caption;
    this.mode = "ace/mode/" + name;
    this.extensions = extensions;
    let re;
    if (/\^/.test(extensions)) {
        re = extensions.replace(/\|(\^)?/g, function (a, b) {
            return "$|" + (b ? "^" : "^.*\\.");
        }) + "$";
    }
    else {
        re = "^.*\\.(" + extensions + ")$";
    }
    this.extRe = new RegExp(re, "gi");
};
Mode.prototype.supportsFile = function (filename) {
    return filename.match(this.extRe);
};
let supportedModes = {
    Text: ["txt"],
    Python: ["py"],
};
let modesByName = {};
for (let name in supportedModes) {
    let data = supportedModes[name];
    let displayName = name.replace(/_/g, " ");
    let filename = name.toLowerCase();
    let mode = new Mode(filename, displayName, data[0]);
    modesByName[filename] = mode;
    modes.push(mode);
}
module.exports = {
    getModeForPath: getModeForPath,
    modes: modes,
    modesByName: modesByName
};

});

ace.define("ace/ext/themelist",["require","exports","module"], function(require, exports, module){/**
 * Generates a list of themes available when ace was built.
 * @fileOverview Generates a list of themes available when ace was built.
 * @author <a href="mailto:matthewkastor@gmail.com">
 *  Matthew Christopher Kastor-Inare III </a><br />
 *  ☭ Hial Atropa!! ☭
 */
"use strict";
let themeData = [
    ["Chrome"],
    ["SQL Server", "sqlserver", "light"],
    ["Twilight", "twilight", "dark"]
];
exports.themesByName = {};
exports.themes = themeData.map(function (data) {
    let name = data[1] || data[0].replace(/ /g, "_").toLowerCase();
    let theme = {
        caption: data[0],
        theme: "ace/theme/" + name,
        isDark: data[2] === "dark",
        name: name
    };
    exports.themesByName[name] = theme;
    return theme;
});

});

ace.define("ace/ext/options",["require","exports","module","ace/ext/menu_tools/overlay_page","ace/lib/dom","ace/lib/oop","ace/config","ace/lib/event_emitter","ace/ext/modelist","ace/ext/themelist"], function(require, exports, module){"use strict";
require("./menu_tools/overlay_page");
let dom = require("../lib/dom");
let oop = require("../lib/oop");
let config = require("../config");
let EventEmitter = require("../lib/event_emitter").EventEmitter;
let buildDom = dom.buildDom;
let modelist = require("./modelist");
let themelist = require("./themelist");
let themes = { Bright: [], Dark: [] };
themelist.themes.forEach(function (x) {
    themes[x.isDark ? "Dark" : "Bright"].push({ caption: x.caption, value: x.theme });
});
let modes = modelist.modes.map(function (x) {
    return { caption: x.caption, value: x.mode };
});
let optionGroups = {
    Main: {
        Mode: {
            path: "mode",
            type: "select",
            items: modes
        },
        Theme: {
            path: "theme",
            type: "select",
            items: themes
        },
        "Font Size": {
            path: "fontSize",
            type: "number",
            defaultValue: 12,
            defaults: [
                { caption: "12px", value: 12 },
                { caption: "24px", value: 24 }
            ]
        },
        "Soft Wrap": {
            type: "buttonBar",
            path: "wrap",
            items: [
                { caption: "Off", value: "off" },
                { caption: "View", value: "free" },
                { caption: "margin", value: "printMargin" },
                { caption: "40", value: "40" }
            ]
        },
        "Cursor Style": {
            path: "cursorStyle",
            items: [
                { caption: "Ace", value: "ace" },
                { caption: "Slim", value: "slim" },
                { caption: "Smooth", value: "smooth" },
                { caption: "Smooth And Slim", value: "smooth slim" },
                { caption: "Wide", value: "wide" }
            ]
        },
        "Folding": {
            path: "foldStyle",
            items: [
                { caption: "Manual", value: "manual" },
                { caption: "Mark begin", value: "markbegin" },
                { caption: "Mark begin and end", value: "markbeginend" }
            ]
        },
        "Soft Tabs": [{
                path: "useSoftTabs"
            }, {
                ariaLabel: "Tab Size",
                path: "tabSize",
                type: "number",
                values: [2, 3, 4, 8, 16]
            }],
        "Overscroll": {
            type: "buttonBar",
            path: "scrollPastEnd",
            items: [
                { caption: "None", value: 0 },
                { caption: "Half", value: 0.5 },
                { caption: "Full", value: 1 }
            ]
        }
    },
    More: {
        "Atomic soft tabs": {
            path: "navigateWithinSoftTabs"
        },
        "Enable Behaviours": {
            path: "behavioursEnabled"
        },
        "Wrap with quotes": {
            path: "wrapBehavioursEnabled"
        },
        "Enable Auto Indent": {
            path: "enableAutoIndent"
        },
        "Full Line Selection": {
            type: "checkbox",
            values: "text|line",
            path: "selectionStyle"
        },
        "Highlight Active Line": {
            path: "highlightActiveLine"
        },
        "Show Invisibles": {
            path: "showInvisibles"
        },
        "Show Indent Guides": {
            path: "displayIndentGuides"
        },
        "Highlight Indent Guides": {
            path: "highlightIndentGuides"
        },
        "Persistent HScrollbar": {
            path: "hScrollBarAlwaysVisible"
        },
        "Persistent VScrollbar": {
            path: "vScrollBarAlwaysVisible"
        },
        "Animate scrolling": {
            path: "animatedScroll"
        },
        "Show Gutter": {
            path: "showGutter"
        },
        "Show Line Numbers": {
            path: "showLineNumbers"
        },
        "Relative Line Numbers": {
            path: "relativeLineNumbers"
        },
        "Fixed Gutter Width": {
            path: "fixedWidthGutter"
        },
        "Show Print Margin": [{
                path: "showPrintMargin"
            }, {
                ariaLabel: "Print Margin",
                type: "number",
                path: "printMarginColumn"
            }],
        "Indented Soft Wrap": {
            path: "indentedSoftWrap"
        },
        "Highlight selected word": {
            path: "highlightSelectedWord"
        },
        "Fade Fold Widgets": {
            path: "fadeFoldWidgets"
        },
        "Use textarea for IME": {
            path: "useTextareaForIME"
        },
        "Merge Undo Deltas": {
            path: "mergeUndoDeltas",
            items: [
                { caption: "Always", value: "always" },
                { caption: "Never", value: "false" },
                { caption: "Timed", value: "true" }
            ]
        },
        "Elastic Tabstops": {
            path: "useElasticTabstops"
        },
        "Incremental Search": {
            path: "useIncrementalSearch"
        },
        "Read-only": {
            path: "readOnly"
        },
        "Copy without selection": {
            path: "copyWithEmptySelection"
        },
        "Live Autocompletion": {
            path: "enableLiveAutocompletion"
        },
        "Custom scrollbar": {
            path: "customScrollbar"
        }
    }
};
let OptionPanel = function (editor, element) {
    this.editor = editor;
    this.container = element || document.createElement("div");
    this.groups = [];
    this.options = {};
};
(function () {
    oop.implement(this, EventEmitter);
    this.add = function (config) {
        if (config.Main)
            oop.mixin(optionGroups.Main, config.Main);
        if (config.More)
            oop.mixin(optionGroups.More, config.More);
    };
    this.render = function () {
        this.container.innerHTML = "";
        buildDom(["table", { role: "presentation", id: "controls" },
            this.renderOptionGroup(optionGroups.Main),
            ["tr", null, ["td", { colspan: 2 },
                    ["table", { role: "presentation", id: "more-controls" },
                        this.renderOptionGroup(optionGroups.More)
                    ]
                ]],
            ["tr", null, ["td", { colspan: 2 }, "version " + config.version]]
        ], this.container);
    };
    this.renderOptionGroup = function (group) {
        return Object.keys(group).map(function (key, i) {
            let item = group[key];
            if (!item.position)
                item.position = i / 10000;
            if (!item.label)
                item.label = key;
            return item;
        }).sort(function (a, b) {
            return a.position - b.position;
        }).map(function (item) {
            return this.renderOption(item.label, item);
        }, this);
    };
    this.renderOptionControl = function (key, option) {
        let self = this;
        if (Array.isArray(option)) {
            return option.map(function (x) {
                return self.renderOptionControl(key, x);
            });
        }
        let control;
        let value = self.getOption(option);
        if (option.values && option.type !== "checkbox") {
            if (typeof option.values == "string")
                option.values = option.values.split("|");
            option.items = option.values.map(function (v) {
                return { value: v, name: v };
            });
        }
        if (option.type === "buttonBar") {
            control = ["div", { role: "group", "aria-labelledby": option.path + "-label" }, option.items.map(function (item) {
                    return ["button", {
                            value: item.value,
                            ace_selected_button: value === item.value,
                            'aria-pressed': value === item.value,
                            onclick: function () {
                                self.setOption(option, item.value);
                                let nodes = this.parentNode.querySelectorAll("[ace_selected_button]");
                                for (let i = 0; i < nodes.length; i++) {
                                    nodes[i].removeAttribute("ace_selected_button");
                                    nodes[i].setAttribute("aria-pressed", false);
                                }
                                this.setAttribute("ace_selected_button", true);
                                this.setAttribute("aria-pressed", true);
                            }
                        }, item.desc || item.caption || item.name];
                })];
        }
        else if (option.type === "number") {
            control = ["input", { type: "number", value: value || option.defaultValue, style: "width:3em", oninput: function () {
                        self.setOption(option, parseInt(this.value));
                    } }];
            if (option.ariaLabel) {
                control[1]["aria-label"] = option.ariaLabel;
            }
            else {
                control[1].id = key;
            }
            if (option.defaults) {
                control = [control, option.defaults.map(function (item) {
                        return ["button", { onclick: function () {
                                    let input = this.parentNode.firstChild;
                                    input.value = item.value;
                                    input.oninput();
                                } }, item.caption];
                    })];
            }
        }
        else if (option.items) {
            let buildItems = function (items) {
                return items.map(function (item) {
                    return ["option", { value: item.value || item.name }, item.desc || item.caption || item.name];
                });
            };
            let items = Array.isArray(option.items)
                ? buildItems(option.items)
                : Object.keys(option.items).map(function (key) {
                    return ["optgroup", { "label": key }, buildItems(option.items[key])];
                });
            control = ["select", { id: key, value: value, onchange: function () {
                        self.setOption(option, this.value);
                    } }, items];
        }
        else {
            if (typeof option.values == "string")
                option.values = option.values.split("|");
            if (option.values)
                value = value === option.values[1];
            control = ["input", { type: "checkbox", id: key, checked: value || null, onchange: function () {
                        let value = this.checked;
                        if (option.values)
                            value = option.values[value ? 1 : 0];
                        self.setOption(option, value);
                    } }];
            if (option.type === "checkedNumber") {
                control = [control, []];
            }
        }
        return control;
    };
    this.renderOption = function (key, option) {
        if (option.path && !option.onchange && !this.editor.$options[option.path])
            return;
        let path = Array.isArray(option) ? option[0].path : option.path;
        this.options[path] = option;
        let safeKey = "-" + path;
        let safeId = path + "-label";
        let control = this.renderOptionControl(safeKey, option);
        return ["tr", { class: "ace_optionsMenuEntry" }, ["td",
                ["label", { for: safeKey, id: safeId }, key]
            ], ["td", control]];
    };
    this.setOption = function (option, value) {
        if (typeof option == "string")
            option = this.options[option];
        if (value === "false")
            value = false;
        if (value === "true")
            value = true;
        if (value === "null")
            value = null;
        if (value === "undefined")
            value = undefined;
        if (typeof value == "string" && parseFloat(value).toString() === value)
            value = parseFloat(value);
        if (option.onchange)
            option.onchange(value);
        else if (option.path)
            this.editor.setOption(option.path, value);
        this._signal("setOption", { name: option.path, value: value });
    };
    this.getOption = function (option) {
        if (option.getValue)
            return option.getValue();
        return this.editor.getOption(option.path);
    };
}).call(OptionPanel.prototype);
exports.OptionPanel = OptionPanel;

});

ace.define("ace/ext/settings_menu",["require","exports","module","ace/ext/options","ace/ext/menu_tools/overlay_page","ace/editor"], function(require, exports, module){/*jslint indent: 4, maxerr: 50, white: true, browser: true, vars: true*/
"use strict";
let OptionPanel = require("./options").OptionPanel;
let overlayPage = require('./menu_tools/overlay_page').overlayPage;
function showSettingsMenu(editor) {
    if (!document.getElementById('ace_settingsmenu')) {
        let options = new OptionPanel(editor);
        options.render();
        options.container.id = "ace_settingsmenu";
        overlayPage(editor, options.container);
        options.container.querySelector("select,input,button,checkbox").focus();
    }
}
module.exports.init = function () {
    let Editor = require("../editor").Editor;
    Editor.prototype.showSettingsMenu = function () {
        showSettingsMenu(this);
    };
};

});                (function() {
                    ace.require(["ace/ext/settings_menu"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            