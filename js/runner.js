import {
    on_sentence_story, on_sentence_dialog, on_sentence_clear,
    on_location_change, on_interact, on_variable_set,
    on_inventory_add, on_inventory_remove, on_inventory_clear, on_combine,
    on_menu_show, on_menu_option,
    on_command, on_error,
} from './runner_cb.js';
import {
    set_title,
    rebuild_inventory,
    add_menu,
    add_pause, remove_pause,
    text_view_add_message, text_view_add_dialog, text_view_clear,
    update_call_stack_widget, update_action_in_gui,
    set_side_panel_blocked,
    save_gui_state, restore_gui_state,
} from './gui.js';

// Constants
export const action_regexp = /\[([^():]+)(?:\(([^)(]+)\))?]/;
export const interpolate_regexp = /\[:([a-z_][a-z0-9_]*):]/i;
export const OP = {
    SENTENCE: 1,
    DIALOG: 2,
    LABEL: 3,
    JUMP: 4,
    CALL: 5,
    CONDITION_START: 6,
    CONDITION_ELSE: 7,
    CONDITION_END: 8,
    VAR_SET: 9,
    INVENTORY_ADD: 10,
    INVENTORY_REM: 11,
    INVENTORY_CLEAR: 12,
    CLEAR: 13,
    PAUSE: 14,
    STOP: 15,
    CHARACTER: 16,
    MENU_OPTION: 17,
    MENU_END: 18,
    COMMAND: 19,
};
export const TT = {
    T_NUM: 1,
    T_OP: 2,
    T_VAR: 3,
    T_ITEM: 4,
    T_PAR: 5
};
const DUP = {OFF: 1, LAST_LINE: 2, ENTIRE: 3};
export const ACTION = {LOOK: 0, INTERACT: 1, APPLY: 2};

// Script
let script_codes = [];

// Inner state
let inventory = []; // Objects with name and title
let variables = []; // Objects with name and value
let screen_messages = [];
let current_position = 0;
let selected_item = '';
let call_stack = [];
let characters = []; // Objects with name and title

// Settings
const debug_mode = false;
const loop_protection_count = 100;
const duplication = DUP.LAST_LINE;
export const hide_action_apply = false;
export const hide_action_combine = false;
const combine_order_matters = false;
export const enable_actions_by_mouse = true;

export class TamiRuntimeError extends Error {
    /**
     * Construct new error
     * @param {string} error_code - message
     * @param {number} [position] - position of op_code
     * @return {void}
     */
    constructor(error_code, position) {
        super();
        this.message = error_code;
        this.position = position != null ? position : current_position;
        this.name = "TamiRuntimeError";
    }

    toString() {
        return `${this.name}: ${this.message} at position ${this.position}`;
    }
}

/**
 * Print debug message
 * @param {string} message - message to print
 * @param {number} [position] - position in program
 * @return {void}
 */
function debug(message, position) {
    if (!debug_mode) return;
    const pos = position ? position : current_position;
    console.log(message + ' at ' + pos);
}

/**
 * Set new script for game
 * @param {array} codes - new script
 * @return {void}
 */
export function init_script(codes) {
    call_stack = [];
    characters = [];
    script_codes = codes;
    const start_pos = get_label_position('start');
    current_position = start_pos ? start_pos : 0;
    set_title('');
    add_menu([]);
    inventory_clear();
    variables_clear();
    sentence_clear();
    set_action(ACTION.LOOK);
    update_action_in_gui();
    set_side_panel_blocked(false);
    update_call_stack_widget(call_stack);
}

/**
 * Text representation of opcode
 * @param {object} code
 * @return {string}
 */
export function opcode_to_string(code) {
    const kv = Object.entries(OP).find(([, value]) => value === code.op);
    let res = kv ? kv[0] : 'UNKNOWN';
    if (code.a) res += ': ' + code.a;
    if (code.b) {
        if (typeof code.b === 'object') {
            res += ': ';
            code.b.forEach(t => {res += t.token + ' '});
        } else {
            res += ': ' + code.b;
        }
    }
    return res;
}

/**
 * Get value of statement
 * @param {array} statement - array of tokens in reverse notation
 * @return {number}
 */
function calculate_statement(statement) {
    let stack = [];
    const UN_COMPUTE_MAP = {
        '-u': (op) => -op,
        '!': (op) => op ? 0 : 1,
        '~': (op) => ~op,
        '@': (op) => Math.floor(Math.random() * op),
        ':': (op) => Math.abs(op),
    };
    const BIN_COMPUTE_MAP = {
        '*': (l, r) => l * r,
        '/': (l, r) => {
            if (r === 0) {
                throw new TamiRuntimeError('DIVISION_BY_ZERO');
            }
            return l / r;
        },
        '%': (l, r) => {
            if (r === 0) {
                throw new TamiRuntimeError('DIVISION_BY_ZERO');
            }
            return l % r;
        },
        '+': (l, r) => l + r,
        '-': (l, r) => l - r,
        '**': (l, r) => Math.round(Math.pow(l, r)),

        '>': (l, r) => l > r ? 1 : 0,
        '>=': (l, r) => l >= r ? 1 : 0,
        '<': (l, r) => l < r ? 1 : 0,
        '<=': (l, r) => l <= r ? 1 : 0,
        '!=': (l, r) => l !== r ? 1 : 0,
        '==': (l, r) => l === r ? 1 : 0,

        '&&': (l, r) => l && r ? 1 : 0,
        '||': (l, r) => l || r ? 1 : 0,

        '<<': (l, r) => l >> r,
        '>>': (l, r) => l << r,
        '&': (l, r) => l & r,
        '|': (l, r) => l | r,
        '^': (l, r) => l ^ r,

        '<<=': (l, r) => l < r ? l : r,
        '>>=': (l, r) => l > r ? l : r,
    };
    statement.forEach(t => {
        switch (t.t_type) {
            case TT.T_ITEM:
                const item = t.token.substring(1, t.token.length - 1);
                const has = inventory_get_title(item);
                stack.push(has ? (item === selected_item ? 2 : 1) : 0);
                break;
            case TT.T_VAR:
                const value = variable_get(t.token);
                debug('Var ' + t.token + ' is ' + value);
                stack.push(value);
                break;
            case TT.T_NUM:
                stack.push(parseInt(t.token));
                break;
            case TT.T_OP:
                const right = stack.pop();
                if (UN_COMPUTE_MAP[t.token]) {
                    stack.push(UN_COMPUTE_MAP[t.token](right));
                } else if (BIN_COMPUTE_MAP[t.token]) {
                    const left = stack.pop();
                    stack.push(BIN_COMPUTE_MAP[t.token](left, right));
                } else {
                    throw new TamiRuntimeError('UNKNOWN_OP ' + t.token);
                }
                break;
            default:
                throw new TamiRuntimeError('INVALID_TOKEN_IN_STACK ' + t.t_type);
        }
    });
    const res = stack.pop();
    debug('Statement result: ' + res);
    return res;
}

/**
 * Set current selected item
 * @param {string} name - name of the item in inventory
 * @return {void}
 */
export function set_selected_item(name) {
    if (name && !inventory_get_title(name)) return;
    selected_item = name ? name : '';
    if (!selected_item && variable_get('action') === ACTION.APPLY) {
        set_action(ACTION.INTERACT);
        update_action_in_gui();
    }
}

/**
 * Set variable 'action' and sync all dependent variables
 * @param {number} new_action - new value for action
 * @return {void}
 */
export function set_action(new_action) {
    if (new_action !== ACTION.LOOK && new_action !== ACTION.INTERACT && new_action !== ACTION.APPLY) return;
    variable_set('action', new_action);
    variable_set('LOOK', new_action === ACTION.LOOK ? 1 : 0);
    variable_set('INTERACT', new_action === ACTION.INTERACT ? 1 : 0);
    if (!hide_action_apply) variable_set('APPLY', new_action === ACTION.APPLY ? 1 : 0);
}

/**
 * Get current selected item
 * @return {string}
 */
export function get_selected_item() {
    return selected_item;
}

/**
 * Return title of item if item is exists in inventory
 * @param {string} item - item name
 * @return {string|null}
 */
function inventory_get_title(item) {
    for (let i = 0; i < inventory.length; i++) {
        if (inventory[i].name === item) return inventory[i].title;
    }
    return null;
}

/**
 * Callback for click on action link
 * @param {string} action - action name
 * @return {void}
 */
export function on_action_click(action) {
    on_interact(action);
    if (jump_to_label(action, true)) run_script();
}

/**
 * Callback for combining two items
 * @param {string} first - one item
 * @param {string} second - another item
 * @return {void}
 */
export function on_combine_result(first, second) {
    on_combine(first, second);
    let found = jump_to_label(first + ' + ' + second, true);
    if (!found && !combine_order_matters) found = jump_to_label(second + ' + ' + first, true);
    if (found) run_script();
}

/**
 * What to do when player clicks in pause element
 * @return {void}
 */
export function on_pause_click() {
    // If position not on PAUSE code, then this pause is from dialog, needs to unlock side-panel
    if (script_codes[current_position].op === OP.PAUSE) {
        ++current_position;
    } else {
        set_side_panel_blocked(false);
    }
    run_script();
}

/**
 * What to do when player clicks in menu option
 * @param {number} addr - address
 * @param {string} title - title of selected option
 * @return {void}
 */
export function on_menu_click(addr, title) {
    current_position = addr;
    on_menu_option(title);
    run_script();
}

/**
 * Duplicate protection
 * @param {string} text - sentence or hash
 * @return {boolean}
 */
function is_duplicate(text) {
    if (duplication === DUP.ENTIRE && screen_messages.includes(text)) return true;
    if (duplication === DUP.LAST_LINE && screen_messages.length) {
        const last = screen_messages[screen_messages.length - 1];
        if (last === text) return true;
    }
    return false;
}

/**
 * Get label position in current script array
 * @param {string} label - label name
 * @return {number|null}
 */
function get_label_position(label) {
    for (let i = 0; i < script_codes.length; i++) {
        const code = script_codes[i];
        if (code.op === OP.LABEL && code.a === label) return i;
    }
    return null;
}

/**
 * Return title of character if he is exists in list
 * @param {string} item - character name
 * @return {string|null}
 */
export function characters_get_title(item) {
    for (let i = 0; i < characters.length; i++) {
        if (characters[i].name === item) return characters[i].title;
    }
    return null;
}

/**
 * Add character to list
 * @param {string} name - character name
 * @param {string} title - character title
 * @return {boolean}
 */
function character_add(name, title) {
    if (characters_get_title(name)) return false;
    characters.push({
        name: name,
        title: title,
    });
    return true;
}

/**
 * Print story-message
 * @param {string} message - sentence
 * @return {boolean}
 */
export function sentence_story(message) {
    message = interpolate_variables(message);
    if (is_duplicate(message)) return false;
    remove_pause();
    text_view_add_message(message);
    screen_messages.push(message);
    return true;
}

/**
 * Print dialog-message
 * @param {string} person - name
 * @param {string} message - sentence
 * @return {boolean}
 */
export function sentence_dialog(person, message) {
    message = interpolate_variables(message);
    const hash = person + ':' + message;
    if (is_duplicate(hash)) return false;
    remove_pause();
    text_view_add_dialog(person, message);
    screen_messages.push(hash);
    add_pause();
    set_side_panel_blocked(true);
    return true;
}

/**
 * Clear text-screen
 * @return {boolean}
 */
export function sentence_clear() {
    const res = screen_messages.length;
    text_view_clear();
    screen_messages = [];
    return res > 0;
}

/**
 * Add to stack if there is no current addr
 * @return {void}
 */
function call_stack_push() {
    debug('Push to stack');
    if (current_position >= script_codes.length) current_position = script_codes.length - 1;
    for (let i = call_stack.length - 1; i >= 0; --i) {
        if (call_stack[i].addr === current_position) {
            while (call_stack.length > i + 1) call_stack.pop();
            return;
        }
    }
    call_stack.push({
        addr: current_position,
        code: script_codes[current_position],
    });
}

/**
 * Jump to label and clear screen and update title if it's a location
 * @param {string} label - label name
 * @param {boolean} [call] - is it call or jump
 * @return {boolean}
 */
export function jump_to_label(label, call) {
    debug((call ? 'Call ' : 'Jump ') + label);
    const pos = get_label_position(label);
    if (pos == null) {
        debug('Not found label');
        return false;
    }
    if (call) {
        call_stack_push();
        update_call_stack_widget(call_stack);
    }
    const code = script_codes[pos];
    current_position = pos;
    if (code.b !== undefined) set_location(code.a, code.b);
    return true;
}

/**
 * Update location name and title and clear screen
 * @param {string} name - location name
 * @param {string} title - location title
 * @return {void}
 */
function set_location(name, title) {
    set_title(title);
    sentence_clear();
    on_location_change(name, title);
}

/**
 * Add item to inventory
 * @param {string} item - item name
 * @param {string} title - item title
 * @return {boolean}
 */
export function inventory_add(item, title) {
    if (inventory_get_title(item)) return false;
    inventory.push({
        name: item,
        title: title ? title : item,
    });
    rebuild_inventory(inventory);
    return true;
}

/**
 * Delete item from inventory
 * @param {string} item - item name
 * @return {boolean}
 */
export function inventory_remove(item) {
    if (!inventory_get_title(item)) return false;
    inventory = inventory.filter(value => {return value.name !== item});
    if (selected_item === item) set_selected_item('');
    rebuild_inventory(inventory);
    return true;
}

/**
 * Clear all inventory
 * @return {void}
 */
export function inventory_clear() {
    inventory = [];
    set_selected_item('');
    rebuild_inventory(inventory);
}

/**
 * Set variable value or create new if not exists
 * @param {string} var_name - variable name
 * @param {number|string} value - variable value
 * @return {void}
 */
export function variable_set(var_name, value) {
    on_variable_set(var_name, parseInt(value));
    for (let i = 0; i < variables.length; i++) {
        if (variables[i].name === var_name) {
            variables[i].value = parseInt(value);
            return;
        }
    }
    variables.push({
        name: var_name,
        value: parseInt(value),
    });
}

/**
 * Get value of variable
 * @param {string} var_name - variable name
 * @return {number}
 */
export function variable_get(var_name) {
    for (let i = 0; i < variables.length; i++) {
        if (variables[i].name === var_name) {
            return variables[i].value;
        }
    }
    return 0;
}

/**
 * Replace variables in string to their values
 * @param {string} str - text
 * @return {string}
 */
export function interpolate_variables(str) {
    let res = '';
    while (str.length > 0) {
        let result = str.match(interpolate_regexp);
        if (result) {
            const start = result.index;
            const variable_name = result[1].trim();
            res += str.substring(0, start) + variable_get(variable_name);
            str = str.substring(start + result[0].length);
        } else {
            res += str;
            str = '';
        }
    }
    return res;
}

/**
 * Delete all variables
 * @return {void}
 */
export function variables_clear() {
    variables = [];
}

/**
 * Continue script running
 * @return {void}
 */
export function run_script() {
    let loop_protection = {};
    let line = 0;
    while (current_position < script_codes.length) {
        loop_protection[current_position] = loop_protection[current_position] ? ++loop_protection[current_position] : 1;
        if (loop_protection[current_position] > loop_protection_count) {
            on_error({
                error : 'ENDLESS_LOOP',
                error_line : current_position,
            });
            return;
        }
        let code = script_codes[current_position];
        debug('Run step ' + opcode_to_string(code));
        switch (code.op) {
            case OP.SENTENCE:
                if (sentence_story(code.a)) on_sentence_story(code.a);
                break;
            case OP.LABEL:
                if (code.b !== undefined) set_location(code.a, code.b);
                break;
            case OP.CLEAR:
                if (sentence_clear()) on_sentence_clear();
                break;
            case OP.CONDITION_START:
                line = code.a;
                let result = 0;
                try {
                    result = calculate_statement(code.b);
                } catch (e) {
                    on_error(e);
                    return;
                }
                if (!result) {
                    debug('Searching end of if body ' + line);
                    ++current_position;
                    while (current_position < script_codes.length) {
                        const c = script_codes[current_position];
                        if (c.op === OP.CONDITION_ELSE && c.a === line) {
                            debug('Found end of if body ' + line);
                            break;
                        }
                        ++current_position;
                    }
                }
                break;
            case OP.CONDITION_ELSE:
                line = code.a;
                debug('Searching end of else body ' + line);
                ++current_position;
                while (current_position < script_codes.length) {
                    const c = script_codes[current_position];
                    if (c.op === OP.CONDITION_END && c.a === line) {
                        debug('Found end of else body ' + line);
                        break;
                    }
                    ++current_position;
                }
                break;
            case OP.CONDITION_END:
                // Just skip
                break;
            case OP.JUMP:
                jump_to_label(code.a, false);
                break;
            case OP.CALL:
                jump_to_label(code.a, true);
                break;
            case OP.VAR_SET:
                const var_name = code.a;
                let value = 0;
                try {
                    value = calculate_statement(code.b);
                } catch (e) {
                    on_error(e);
                    return;
                }
                variable_set(var_name, value);
                break;
            case OP.INVENTORY_ADD:
                if (inventory_add(code.a, code.b)) on_inventory_add(code.a, inventory_get_title(code.a));
                break;
            case OP.INVENTORY_REM:
                const title = inventory_get_title(code.a);
                if (inventory_remove(code.a)) {
                    on_inventory_remove(code.a, title);
                }
                break;
            case OP.INVENTORY_CLEAR:
                inventory_clear();
                on_inventory_clear();
                break;
            case OP.CHARACTER:
                character_add(code.a, code.b);
                break;
            case OP.DIALOG:
                const person = code.a;
                const message = code.b;
                if (sentence_dialog(person, message)) on_sentence_dialog(person, message);
                ++current_position;
                return;
            case OP.PAUSE:
                add_pause();
                return;
            case OP.STOP:
                if (call_stack.length === 0) return;
                const sc = call_stack.pop();
                current_position = sc.addr - 1;
                update_call_stack_widget(call_stack);
                debug('Pop from stack');
                break;
            case OP.MENU_OPTION:
                const id = code.b;
                debug('Option of menu ' + id);
                let need_skip = false;
                for (let i = current_position - 1; i > 0; i--) {
                    if (script_codes[i].op === OP.MENU_OPTION && script_codes[i].b === id) {
                        need_skip = true;
                        break;
                    }
                }
                if (need_skip) {
                    do {
                        code = script_codes[current_position];
                        if (code.op === OP.MENU_END && code.a === id) break;
                        ++current_position;
                    } while (current_position < script_codes.length);
                    debug('Found end of option block');
                } else {
                    let options = [];
                    do {
                        code = script_codes[current_position];
                        if (code.op === OP.MENU_OPTION && code.b === id) {
                            options.push({
                                title: code.a,
                                addr: current_position + 1,
                            });
                        }
                        if (code.op === OP.MENU_END && code.b === id) break;
                        ++current_position;
                    } while (current_position < script_codes.length);
                    on_menu_show();
                    add_menu(options);
                    return;
                }
                break;
            case OP.MENU_END:
                // Just skip
                break;
            case OP.COMMAND:
                on_command(code.a);
                break;
            default:
                on_error({
                    error : 'UNKNOWN_OP.CODE: ' + code.op,
                    error_line : current_position,
                });
                return;
        }
        ++current_position;
    }
}

/**
 * Run setup codes in order to change location, set variable, add item or call action
 * @param {array} codes - setup script
 * @return {void}
 */
export function run_setup(codes) {
    let current_pos = 0;
    while (current_pos < codes.length) {
        const code = codes[current_pos];
        debug('Setup step ' + opcode_to_string(code), current_pos);
        switch (code.op) {
            case OP.VAR_SET:
                const var_name = code.a;
                const value = calculate_statement(code.b);
                variable_set(var_name, value);
                break;
            case OP.INVENTORY_ADD:
                inventory_add(code.a, code.b);
                break;
            case OP.COMMAND:
                on_command(code.a);
                break;
            case OP.JUMP:
                jump_to_label(code.a, false);
                break;
            default:
                throw new TamiRuntimeError('UNKNOWN_SETUP_OP.CODE: ' + code.op, current_pos);
        }
        ++current_pos;
    }
}

/**
 * Save all inner state to JSON-string
 * @return {string}
 */
export function save_state() {
    const inner_state = {
        inventory: inventory,
        variables: variables,
        screen_messages: screen_messages,
        current_position: current_position,
        selected_item: selected_item,
        call_stack: call_stack,
        characters: characters,
    };
    const gui_state = save_gui_state();
    return JSON.stringify({...inner_state, ...gui_state});
}

/**
 * Restore all inner state from JSON-string
 * @param {string} json_data - string with json-data
 * @return {void}
 */
export function load_state(json_data) {
    const data = JSON.parse(json_data);
    inventory = data.inventory;
    variables = data.variables;
    screen_messages = data.screen_messages;
    current_position = data.current_position;
    selected_item = data.selected_item;
    call_stack = data.call_stack;
    characters = data.characters;
    rebuild_inventory(inventory);
    restore_gui_state(data);
}
