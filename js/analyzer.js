import {OP, TT, action_regexp} from './runner.js';

const read_only_vars = ['action', 'LOOK', 'INTERACT', 'APPLY'];

export class TamiAnalyzeError extends Error {
    /**
     * Construct new error
     * @param {string} error_code - message
     * @param {object} [code] - op_code
     * @return {void}
     */
    constructor(error_code, code) {
        super();
        this.message = error_code;
        this.file = code ? code.file : '';
        this.line = code ? code.line : 0;
        this.name = "TamiAnalyzeError";
    }

    toString() {
        return `${this.name}: ${this.message} at ${this.file}:${this.line}`;
    }
}

/**
 * Check and collect variables
 * @param {array} codes - op codes
 * @return {array}
 */
export function analyze_variables(codes) {
    let variables = [];
    let variable_names = [];
    codes.forEach(code => {
        if (code.op === OP.VAR_SET) {
            if (read_only_vars.includes(code.a)) {
                throw new TamiAnalyzeError('VARIABLE_IS_READ_ONLY', code);
            }
            if (!variable_names.includes(code.a)) {
                variable_names.push(code.a);
                variables.push({
                    name: code.a,
                    file: code.file,
                    line: code.line,
                });
            }
        }
    });
    let using = [];
    codes.forEach(code => {
        if (code.op === OP.CONDITION_START || code.op === OP.VAR_SET) {
            code.b.forEach(t => {
                if (t.t_type === TT.T_VAR) {
                    if (!variable_names.includes(t.token) && !read_only_vars.includes(t.token)) {
                        throw new TamiAnalyzeError('UNKNOWN_VARIABLE: ' + t.token, code);
                    }
                    using.push(t.token);
                }
            });
        }
    });
    let res = [];
    variables.forEach(v => {
        res.push({
            name: v.name,
            used: using.includes(v.name),
            file: v.file,
            line: v.line,
        });
    });
    return res;
}

/**
 * Check and collect inventory items
 * @param {array} codes - op codes
 * @return {array}
 */
export function analyze_items(codes) {
    let items = [];
    let item_names = [];
    codes.forEach(code => {
        if (code.op === OP.INVENTORY_ADD) {
            const n = '{' + code.a + '}';
            if (!item_names.includes(n)) {
                item_names.push(n);
                items.push({
                    name: n,
                    file: code.file,
                    line: code.line,
                });
            }
        }
    });
    let using = [];
    codes.forEach(code => {
        if (code.op === OP.CONDITION_START || code.op === OP.VAR_SET) {
            code.b.forEach(t => {
                if (t.t_type === TT.T_ITEM) {
                    if (!item_names.includes(t.token)) {
                        throw new TamiAnalyzeError('UNKNOWN_ITEM: ' + t.token, code);
                    }
                    using.push(t.token);
                }
            });
        }
        if (code.op === OP.INVENTORY_REM) {
            const n = '{' + code.a + '}';
            if (!item_names.includes(n)) {
                throw new TamiAnalyzeError('UNKNOWN_ITEM: ' + code.a, code);
            }
        }
    });
    let res = [];
    items.forEach(v => {
        res.push({
            name: v.name.substring(1, v.name.length - 1),
            used: using.includes(v.name),
            file: v.file,
            line: v.line,
        });
    });
    return res;
}

/**
 * Check and collect characters
 * @param {array} codes - op codes
 * @return {array}
 */
export function analyze_characters(codes) {
    let characters = [];
    let used = [];
    codes.forEach(code => {
        if (code.op === OP.CHARACTER) {
            if (characters.includes(code.a)) {
                throw new TamiAnalyzeError('REDEFINED_CHARACTER: ' + code.a, code);
            }
            characters.push(code.a);
        }
    });
    codes.forEach(code => {
        if (code.op === OP.DIALOG) {
            if (!characters.includes(code.a)) {
                throw new TamiAnalyzeError('UNKNOWN_CHARACTER: ' + code.a, code);
            }
            if (!used.includes(code.a)) used.push(code.a);
        }
    });
    let res = [];
    codes.forEach(code => {
        if (code.op === OP.CHARACTER) {
            res.push({
                name: code.a,
                used: used.includes(code.a),
                file: code.file,
                line: code.line,
            });
        }
    });
    return res;
}

/**
 * Check and collect actions and locations
 * @param {array} codes - op codes
 * @return {array}
 */
export function analyze_labels(codes) {
    let labels = [];
    codes.forEach(code => {
        if (code.op === OP.LABEL) {
            if (labels.includes(code.a)) {
                throw new TamiAnalyzeError('REDEFINED: ' + code.a, code);
            }
            labels.push(code.a);
        }
    });

    if (!labels.includes('start')) {
        throw new TamiAnalyzeError('NO_ENTRY_POINT_FOUND');
    }

    let using = ['start'];
    codes.forEach(code => {
        if (code.op === OP.SENTENCE) {
            let message = code.a;
            while (message.length > 0) {
                let result = message.match(action_regexp);
                if (result) {
                    const start = result.index;
                    const action_name = result[1].trimEnd();
                    if (!labels.includes(action_name)) {
                        throw new TamiAnalyzeError('UNKNOWN_ACTION ' + action_name, code);
                    }
                    message = message.substring(start + result[0].length);
                    using.push(action_name);
                } else {
                    message = '';
                }
            }
        }
        if (code.op === OP.JUMP || code.op === OP.CALL) {
            if (!labels.includes(code.a)) {
                throw new TamiAnalyzeError('UNKNOWN_DESTINATION ' + code.a, code);
            }
            using.push(code.a);
        }
    });

    let locations = [];
    codes.forEach(code => {
        if (code.op === OP.LABEL) {
            locations.push({
                name: code.a,
                used: using.includes(code.a),
                is_loc: code.b !== undefined,
                file: code.file,
                line: code.line,
            });
        }
    });

    return locations;
}

/**
 * Check and collect actions and locations
 * @param {array} codes - op codes
 * @param {array} script_labels - all labels from script
 * @return {array}
 */
export function analyze_labels_setup(codes, script_labels) {
    codes.forEach(code => {
        if (code.op === OP.CALL) {
            throw new TamiAnalyzeError('CALL_IS_NOT_ALLOWED_IN_SETUP ' + code.a, code);
        }
        if (code.op === OP.JUMP) {
            let found = false;
            script_labels.forEach(lbl => {if (lbl.name === code.a) found = true});
            if (!found) {
                throw new TamiAnalyzeError('UNKNOWN_DESTINATION ' + code.a, code);
            }
        }
    });
}

/**
 * Return unreached code positions
 * @param {array} codes - op codes
 * @return {array}
 */
export function analyze_reaching(codes) {
    let res = [];
    for (let i = 0; i < codes.length - 1; i++) {
        const code = codes[i];
        if (code.op === OP.JUMP || code.op === OP.CALL) {
            const after = codes[i + 1];
            const op = after.op;
            if (op !== OP.LABEL &&
                op !== OP.CONDITION_END && op !== OP.CONDITION_ELSE &&
                op !== OP.MENU_END && op !== OP.MENU_OPTION
            ) {
                res.push({
                    error_line : after.line,
                    file: after.file,
                });
            }
        }
    }
    return res;
}
