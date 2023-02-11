import {debug_mode} from './ide.js';
import {parse_statement} from './statement.js';
import {opcode_to_string, OP} from './runner.js';

const indent_spaces = 4;
let lines = [];
let line_count = 0;
let indent_level = 0;
let current_line_number = 0;
let file_name = '';

const location_def_regexp = /^\[([^\[\](:)]+)(?:\s+\(([^()]*)\))?]$/;
const action_def_regexp = /^> ([^><\[\](:)]+):$/;

const goto_regexp = /^(jump|call)\s+([^\[\](:)]+)$/;
const condition_regexp = /^if\s+(.+):$/;
const variable_set_regexp = /^([a-z_][a-z_0-9]*)\s*=\s*(.*)$/i;
const inventory_add_regexp = /^\+{([^{}()]+)(?:\s+\((.+)\))?\s*}$/;
const inventory_rem_regexp = /^-{([^{}]+)}$/;
const inventory_clear_regexp = /^-{}$/;
const dialog_regexp = /^([a-z_][a-z0-9_]{0,19}):\s(.+)$/i;
const clear_regexp = /^\[]$/;
const pause_regexp = /^\.\.\.$/;
const stop_regexp = /^\.$/;
const command_regexp = /^\/\/\s+(.+)$/;
const character_regexp = /^character ([a-zA-Z_][a-zA-Z0-9_]*)\s+=([^=]+)$/;
const menu_regexp = /^\+\s([^:]+):$/;

export class TamiSyntaxError extends Error {
    /**
     * Construct new error
     * @param {string} error_code - message
     * @param {number} [line] - line number
     * @return {void}
     */
    constructor(error_code, line) {
        super();
        this.message = error_code;
        this.file = file_name;
        this.line = line != null ? line : current_line_number;
        this.name = "TamiSyntaxError";
    }

    toString() {
        return `${this.name}: ${this.message} at ${this.file}:${this.line + 1}`;
    }
}

/**
 * Print debug message
 * @param {string} message - message to print
 * @return {void}
 */
function debug(message) {
    if (!debug_mode) return;
    console.log('Parser: ' + message + ' at ' + file_name + ':' + current_line_number);
}

/**
 * Construct debug-file of script-codes
 * @param {array} codes - array of opcodes
 * @return {string}
 */
export function build_debug_file(codes) {
    let res = '';
    if (codes) codes.forEach(code => {res += opcode_to_string(code) + "\r\n"});
    return res;
}

/**
 * Construct js-module with array of script-codes
 * @param {array} codes - array of opcodes
 * @return {string}
 */
export function build_js_module(codes) {
    let res = "export const script_codes = [\n";
    if (codes) codes.forEach(code => {
        res += '{op: ' + code.op;
        if (code.a !== undefined) {
            if (typeof code.a === 'number') {
                res += ', a: ' + code.a;
            } else if (typeof code.a === 'string') {
                res += ', a: "' + code.a.replaceAll('"', '\\"') + '"';
            } else {
                throw {
                    error: 'Parameter A has invalid type',
                    code: opcode_to_string(code)
                };
            }
        }
        if (code.b !== undefined) {
            if (typeof code.b === 'number') {
                res += ', b: ' + code.b;
            } else if (typeof code.b === 'string') {
                res += ', b: "' + code.b.replaceAll('"', '\\"') + '"';
            } else if (typeof code.b === 'object') {
                let s = '[';
                code.b.forEach(t => {
                    s += '{t_type: ' + t.t_type + ', token: "' + t.token + '"}, ';
                });
                s += ']';
                res += ', b: ' + s;
            } else {
                throw {
                    error: 'Parameter B has invalid type',
                    code: opcode_to_string(code)
                };
            }
        }
        res += "},\n";
    });
    res += "];\n";
    return res;
}

/**
 * Re-initialize all global variables
 * @param {string} file - file name (for op codes belonging)
 * @param {string} text - script text
 * @return {void}
 */
function init_parser(file, text) {
    file_name = file;
    text = text.replaceAll("\r", '');
    lines = text.split("\n");
    line_count = lines.length;
    indent_level = 0;
    current_line_number = 0;
}

/**
 * Calculate indentation level depending on the indent_spaces
 * @param {number} line_number - position of this line in text
 * @param {string} line - script line
 * @return {number}
 */
function get_indent_level(line_number, line) {
    let indent = 0;
    while (line.length > 0) {
        if (line[0] === "\t") {
            line = line.substring(1);
            ++indent;
        } else if (line.length >= indent_spaces && line.substring(0, indent_spaces) === ' '.repeat(indent_spaces)) {
            line = line.substring(indent_spaces);
            ++indent;
        } else {
            break;
        }
    }
    if (line.length > 0 && line[0] === ' ') {
        throw new TamiSyntaxError('INCONSISTENT_INDENTATION', line_number);
    }
    return indent;
}

/**
 * Get opcodes for script (not all features are available)
 * @param {string} text - script text
 * @return {array}
 */
export function parse_setup(text) {
    init_parser('setup', text);
    let result_opcodes = [];
    while (current_line_number < line_count) {
        let line = lines[current_line_number];
        if (line.trimStart().length === 0) {
            ++current_line_number;
            continue;
        }
        const level = get_indent_level(current_line_number, line);
        if (level > 0) {
            throw new TamiSyntaxError('NON_ZERO_INDENTATION');
        }
        if (command_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_command());
            continue;
        }
        if (variable_set_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_variable_set());
            continue;
        }
        if (inventory_add_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_inventory_add());
            continue;
        }
        if (goto_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_goto());
            continue;
        }
        throw new TamiSyntaxError('UNEXPECTED_LINE');
    }
    return result_opcodes;
}

/**
 * Get opcodes for script
 * @param {string} file - file name (for op codes belonging)
 * @param {string} text - script text
 * @return {array}
 */
export function parse(file, text) {
    init_parser(file, text);
    let result_opcodes = [];
    while (current_line_number < line_count) {
        let line = lines[current_line_number];
        if (line.trimStart().length === 0) {
            ++current_line_number;
            continue;
        }
        const level = get_indent_level(current_line_number, line);
        if (level > 0) {
            throw new TamiSyntaxError('INVALID_INDENTATION');
        }
        line = line.trimStart();
        if (command_regexp.test(line)) {
            ++current_line_number;
            continue;
        }
        if (location_def_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_location_def());
            continue;
        }
        if (action_def_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_action_def());
            continue;
        }
        throw new TamiSyntaxError('UNEXPECTED_LINE');
    }
    return result_opcodes;
}

/**
 * Get opcodes for one block
 * @return {array}
 */
function parse_block() {
    debug('block');
    let result_opcodes = [];
    while (current_line_number < line_count) {
        let line = lines[current_line_number];
        if (line.trimStart().length === 0) {
            ++current_line_number;
            continue;
        }
        const level = get_indent_level(current_line_number, line);
        if (level > indent_level) {
            debug('Indent actual ' + level + ', expected' + indent_level);
            throw new TamiSyntaxError('INVALID_INDENTATION');
        }
        if (level < indent_level) {
            break;
        }
        line = line.trimStart();
        if (command_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_command());
            continue;
        }
        if (goto_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_goto());
            continue;
        }
        if (condition_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_condition());
            continue;
        }
        if (variable_set_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_variable_set());
            continue;
        }
        if (inventory_add_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_inventory_add());
            continue;
        }
        if (inventory_rem_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_inventory_rem());
            continue;
        }
        if (inventory_clear_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_inventory_clear());
            continue;
        }
        if (dialog_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_dialog());
            continue;
        }
        if (clear_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_clear());
            continue;
        }
        if (pause_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_pause());
            continue;
        }
        if (stop_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_stop());
            continue;
        }
        if (character_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_character());
            continue;
        }
        if (menu_regexp.test(line)) {
            result_opcodes = result_opcodes.concat(parse_menu());
            continue;
        }
        // Nothing special - plain text
        debug('sentence');
        result_opcodes.push({op: OP.SENTENCE, a: line, file: file_name, line: current_line_number});
        ++current_line_number;
    }
    debug('end of block');
    return result_opcodes;
}

function parse_location_def() {
    debug('location');
    if (indent_level > 0) {
        throw new TamiSyntaxError('NON_ZERO_INDENT_LOCATION');
    }
    let result_opcodes = [];
    const header = lines[current_line_number].match(location_def_regexp);
    const name = header[1].trim();
    if (header[2] !== undefined) {
        const title = header[2].trim();
        result_opcodes.push({op: OP.LABEL, a: name, b: title, file: file_name, line: current_line_number});
    } else {
        result_opcodes.push({op: OP.LABEL, a: name, b: name, file: file_name, line: current_line_number});
    }

    ++indent_level;
    ++current_line_number;
    const block = parse_block();
    if (!block.length) {
        throw new TamiSyntaxError('EMPTY_LOCATION');
    }
    result_opcodes = result_opcodes.concat(block);
    --indent_level;
    return result_opcodes;
}

function parse_goto() {
    const line = lines[current_line_number].trimStart();
    const data = line.match(goto_regexp);
    const type = data[1];
    const label = data[2].trim();
    debug(type);
    ++current_line_number;
    return [{op: type === 'jump' ? OP.JUMP : OP.CALL, a: label, file: file_name, line: current_line_number}];
}

function parse_clear() {
    debug('clear');
    ++current_line_number;
    return [{op: OP.CLEAR, file: file_name, line: current_line_number}];
}

function parse_condition() {
    debug('condition');
    let result_opcodes = [];
    const start_line = current_line_number;
    let line = lines[current_line_number].trimStart();
    const data = line.match(condition_regexp);
    let statement = parse_statement(data[1], current_line_number);
    result_opcodes.push({op: OP.CONDITION_START, a: start_line, b: statement, file: file_name, line: current_line_number});
    ++current_line_number;
    ++indent_level;
    let block = parse_block();
    if (!block.length) {
        throw new TamiSyntaxError('EMPTY_IF');
    }
    result_opcodes = result_opcodes.concat(block);
    result_opcodes.push({op: OP.CONDITION_ELSE, a: start_line, file: file_name, line: current_line_number});
    --indent_level;
    line = lines[current_line_number].trimStart();
    if (line === 'else:') {
        line = lines[current_line_number];
        const level = get_indent_level(current_line_number, line);
        if (level !== indent_level) {
            debug('Indent actual ' + level + ', expected' + indent_level);
            throw new TamiSyntaxError('INVALID_INDENTATION');
        }
        ++current_line_number;
        ++indent_level;
        block = parse_block();
        if (!block.length) {
            throw new TamiSyntaxError('EMPTY_ELSE');
        }
        result_opcodes = result_opcodes.concat(block);
        --indent_level;
    }
    result_opcodes.push({op: OP.CONDITION_END, a: start_line, file: file_name, line: current_line_number});
    return result_opcodes;
}

function parse_action_def() {
    debug('action def');
    if (indent_level > 0) {
        throw new TamiSyntaxError('NON_ZERO_INDENT_ACTION');
    }
    let result_opcodes = [];
    const header = lines[current_line_number].match(action_def_regexp);
    result_opcodes.push({op: OP.LABEL, a: header[1].trim(), file: file_name, line: current_line_number});

    ++indent_level;
    ++current_line_number;
    const block = parse_block();
    if (!block.length) {
        throw new TamiSyntaxError('EMPTY_ACTION');
    }
    result_opcodes = result_opcodes.concat(block);
    --indent_level;
    return result_opcodes;
}

function parse_variable_set() {
    debug('variable set');
    const line = lines[current_line_number].trimStart();
    const data = line.match(variable_set_regexp);
    const var_name = data[1];
    const expr = parse_statement(data[2], current_line_number);
    ++current_line_number;
    return [{op: OP.VAR_SET, a: var_name, b: expr, file: file_name, line: current_line_number}];
}

function parse_inventory_add() {
    debug('inventory add');
    const line = lines[current_line_number].trimStart();
    const data = line.match(inventory_add_regexp);
    ++current_line_number;
    return [{op: OP.INVENTORY_ADD, a: data[1], b: data[2], file: file_name, line: current_line_number}];
}

function parse_inventory_rem() {
    debug('inventory rem');
    const line = lines[current_line_number].trimStart();
    const data = line.match(inventory_rem_regexp);
    ++current_line_number;
    return [{op: OP.INVENTORY_REM, a: data[1], file: file_name, line: current_line_number}];
}

function parse_inventory_clear() {
    debug('inventory clear');
    ++current_line_number;
    return [{op: OP.INVENTORY_CLEAR, file: file_name, line: current_line_number}];
}

function parse_dialog() {
    debug('dialog');
    const line = lines[current_line_number].trimStart();
    const data = line.match(dialog_regexp);
    ++current_line_number;
    return [{op: OP.DIALOG, a: data[1], b: data[2], file: file_name, line: current_line_number}];
}

function parse_pause() {
    debug('pause');
    ++current_line_number;
    return [{op: OP.PAUSE, file: file_name, line: current_line_number}];
}

function parse_stop() {
    debug('stop');
    ++current_line_number;
    return [{op: OP.STOP, file: file_name, line: current_line_number}];
}

function parse_character() {
    debug('character');
    const line = lines[current_line_number].trimStart();
    const data = line.match(character_regexp);
    ++current_line_number;
    return [{op: OP.CHARACTER, a: data[1], b: data[2].trim(), file: file_name, line: current_line_number}];
}

function parse_menu() {
    debug('menu');
    let result_opcodes = [];
    let line = '';
    const id = current_line_number;
    do {
        line = lines[current_line_number];
        const level = get_indent_level(current_line_number, line);
        if (level !== indent_level) break;

        const option = lines[current_line_number].trimStart().match(menu_regexp);
        result_opcodes.push({op: OP.MENU_OPTION, a: option[1], b: id, file: file_name, line: current_line_number});

        ++indent_level;
        ++current_line_number;
        const block = parse_block();
        if (!block.length) {
            throw new TamiSyntaxError('EMPTY_MENU_OPTION');
        }
        result_opcodes = result_opcodes.concat(block);
        --indent_level;

        if (current_line_number >= line_count) break;
        line = lines[current_line_number].trimStart();
    } while (menu_regexp.test(line));
    result_opcodes.push({op: OP.MENU_END, a: id, file: file_name, line: current_line_number});
    return result_opcodes;
}

function parse_command() {
    debug('command');
    const line = lines[current_line_number].trimStart();
    const data = line.match(command_regexp);
    ++current_line_number;
    return [{op: OP.COMMAND, a: data[1], file: file_name, line: current_line_number}];
}
