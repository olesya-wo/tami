import {
    action_regexp, ACTION, set_action,
    hide_action_apply, hide_action_combine, enable_actions_by_mouse,
    get_selected_item, set_selected_item,
    on_pause_click, on_menu_click, on_action_click, on_combine_result,
    characters_get_title,
    variable_get, interpolate_variables,
    opcode_to_string,
} from './runner.js';

const gui_text_view_blocker_id = 'game-text-view-blocker';
const gui_pause_id = 'pause-message';
// Refs to gui dom-elements
let gui_location_title = null;
let gui_text_view = null;
let gui_side_panel = null;
let gui_side_panel_blocker = null;
let gui_action_list = null;
let gui_inventory_list = null;
let gui_menu = null;
let gui_call_stack = null;
let gui_action_look_btn = null;
let gui_action_interact_btn = null;
let gui_action_apply_btn = null;
let gui_action_combine_btn = null;

let menu_cache = [];
let first_selected_to_combine = '';

/**
 * Initialize gui-elements
 * @return {void}
 */
export function init_gui() {
    gui_location_title = document.getElementById('game-location-title');
    gui_text_view = document.getElementById('game-text-view');
    gui_side_panel = document.getElementById('game-side-panel');
    gui_side_panel_blocker = document.getElementById('game-side-panel-blocker');
    gui_inventory_list = document.getElementById('game-inventory-list');
    gui_action_list = document.getElementById('game-action-list');
    gui_menu = document.getElementById('game-menu');
    gui_call_stack = document.getElementById('call-stack');
    gui_action_look_btn = document.getElementById('game-action-look-btn');
    gui_action_interact_btn = document.getElementById('game-action-interact-btn');
    gui_action_apply_btn = document.getElementById('game-action-apply-btn');
    gui_action_combine_btn = document.getElementById('game-action-combine');

    gui_action_look_btn.onclick = () => {
        set_action(ACTION.LOOK);
        update_action_in_gui();
    };
    gui_action_interact_btn.onclick = () => {
        set_action(ACTION.INTERACT);
        update_action_in_gui();
    };
    gui_action_apply_btn.onclick = () => {
        set_action(ACTION.APPLY);
        update_action_in_gui();
    };
    gui_action_list.onchange = () => {
        set_selected_item(gui_action_list.value);
    };

    if (hide_action_apply) {
        gui_action_list.style.display = 'none';
        gui_action_apply_btn.style.display = 'none';
    }

    if (hide_action_combine)
        gui_action_combine_btn.style.display = 'none';
    else
        gui_action_combine_btn.onclick = on_combine_click;

    if (enable_actions_by_mouse) {
        gui_action_look_btn.style.display = 'none';
        gui_action_interact_btn.style.display = 'none';
        gui_action_apply_btn.style.display = 'none';
        if (hide_action_apply) document.getElementById('game-action-panel').style.display = 'none';
        gui_text_view.oncontextmenu = (e) => {
            e.preventDefault();
            return false;
        };
        gui_inventory_list.oncontextmenu = (e) => {
            e.preventDefault();
            return false;
        };
    }
    update_action_in_gui();
}

/**
 * Update all action buttons depends on variable 'action'
 * @return {void}
 */
export function update_action_in_gui() {
    const action = variable_get('action');
    const active_btn_class = 'game-action-active';
    gui_action_look_btn.classList.remove(active_btn_class);
    gui_action_interact_btn.classList.remove(active_btn_class);
    gui_action_apply_btn.classList.remove(active_btn_class);
    gui_action_list.style.display = 'none';

    if (action === ACTION.LOOK) gui_action_look_btn.classList.add(active_btn_class);
    if (action === ACTION.INTERACT) gui_action_interact_btn.classList.add(active_btn_class);
    if (action === ACTION.APPLY && !hide_action_apply) {
        gui_action_apply_btn.classList.add(active_btn_class);
        gui_action_list.style.display = 'block';
    }
    if (enable_actions_by_mouse && !hide_action_apply) gui_action_list.style.display = 'block';
}

/**
 * Set location title in GUI
 * @param {string} title - new title
 * @return {void}
 */
export function set_title(title) {
    gui_location_title.innerHTML = title;
    gui_location_title.style.display = title ? 'block' : 'none';
}

/**
 * Construct and add new item in inventory list in gui
 * @param {object} item - item object
 * @return {void}
 */
function add_inventory_list_item(item) {
    if (item.name) {
        let i = document.createElement('div');
        i.innerHTML = item.title;
        i.className = 'inventory-item';
        i.setAttribute('data-item', item.name);
        i.onclick = () => {
            if (document.getElementById(gui_text_view_blocker_id)) {
                if (first_selected_to_combine) {
                    if (first_selected_to_combine === item.name) {
                        first_selected_to_combine = '';
                        i.classList.remove('game-action-combine-active');
                    } else {
                        on_combine_result(first_selected_to_combine, item.name);
                        combine_clear();
                    }
                } else {
                    first_selected_to_combine = item.name;
                    i.classList.add('game-action-combine-active');
                }
            } else {
                if (enable_actions_by_mouse) set_action(ACTION.LOOK);
                on_action_click(item.name);
            }
        };
        if (enable_actions_by_mouse) {
            i.oncontextmenu = () => {
                set_action(ACTION.INTERACT);
                on_action_click(item.name);
            };
        }
        gui_inventory_list.appendChild(i);
    }

    let o = document.createElement('option');
    o.innerHTML = item.title;
    o.value = item.name;
    if (item.name === get_selected_item()) o.selected = true;
    gui_action_list.appendChild(o);
}

/**
 * Actualize inventory list in gui
 * @param {array} inventory - current data from engine
 * @return {void}
 */
export function rebuild_inventory(inventory) {
    gui_inventory_list.innerHTML = '';
    gui_action_list.innerHTML = '';
    if (enable_actions_by_mouse) add_inventory_list_item({title: '', name: ''});
    inventory.forEach(item => {add_inventory_list_item(item)});
}

/**
 * Click handler for Combine button
 * @return {void}
 */
function on_combine_click() {
    if (gui_inventory_list.children.length < 2) {
        combine_clear();
        return;
    }
    if (document.getElementById(gui_text_view_blocker_id)) {
        combine_clear();
    } else {
        let blocker = document.createElement('div');
        blocker.id = gui_text_view_blocker_id;
        gui_text_view.appendChild(blocker);
        gui_action_combine_btn.classList.add('game-action-combine-active');
    }
}

/**
 * Unselect all items in inventory, uncheck Combine button and hide blocker
 * @return {void}
 */
function combine_clear() {
    gui_action_combine_btn.classList.remove('game-action-combine-active');
    for (let i = 0; i < gui_inventory_list.children.length; i++) {
        gui_inventory_list.children[i].classList.remove('game-action-combine-active');
    }
    const blocker = document.getElementById(gui_text_view_blocker_id);
    if (blocker) gui_text_view.removeChild(blocker);
    first_selected_to_combine = '';
}

/**
 * Add menu to the screen
 * @param {array} options - pairs of title and addr
 * @return {void}
 */
export function add_menu(options) {
    menu_cache = options;
    gui_menu.style.display = options.length ? 'flex' :'none';
    gui_menu.innerHTML = '';
    options.forEach(option => {
        let o = document.createElement('div');
        const option_title = interpolate_variables(option.title);
        o.innerHTML = option_title;
        o.className = 'menu-option';
        o.onclick = () => {
            add_menu([]);
            on_menu_click(option.addr, option_title);
        };
        gui_menu.appendChild(o);
    });
}

/**
 * Add pause-div if no exists
 * @return {void}
 */
export function add_pause() {
    let p = document.getElementById(gui_pause_id);
    if (p) return;
    p = document.createElement('div');
    p.id = gui_pause_id;
    p.innerHTML = '...';
    p.onclick = () => {
        p.parentNode.removeChild(p);
        on_pause_click();
    };
    gui_text_view.appendChild(p);
}

/**
 * Remove pause-div if exists
 * @return {void}
 */
export function remove_pause() {
    let p = document.getElementById(gui_pause_id);
    if (!p) return;
    p.parentNode.removeChild(p);
}

/**
 * Parse actions from message and build it to div
 * @param {HTMLElement} div - message container
 * @param {string} message - text message
 * @return {void}
 */
function parse_message(div, message) {
    while (message.length > 0) {
        let result = message.match(action_regexp);
        if (result) {
            const start = result.index;
            const action_name = result[1].trimEnd();
            const action_display_name = result[2] ? result[2] : result[1];
            const span = document.createElement('span');
            span.innerHTML = message.substring(0, start);
            div.appendChild(span);
            const a = document.createElement('a');
            a.innerHTML = action_display_name;
            a.setAttribute('data-action-name', action_name);
            a.className = 'game-action-link';
            a.onclick = () => {
                if (enable_actions_by_mouse) set_action(ACTION.LOOK);
                on_action_click(action_name);
            };
            if (enable_actions_by_mouse) {
                a.oncontextmenu = () => {
                    set_action(get_selected_item() ? ACTION.APPLY : ACTION.INTERACT);
                    on_action_click(action_name);
                };
            }
            a.href = 'javascript:void(0)';
            div.appendChild(a);
            message = message.substring(start + result[0].length);
        } else {
            const span = document.createElement('span');
            span.innerHTML = message;
            message = '';
            div.appendChild(span);
        }
    }
}

/**
 * Parse and add text to game text screen
 * @param {string} text - text
 * @return {void}
 */
export function text_view_add_message(text) {
    let mess = document.createElement('div');
    parse_message(mess, text);
    mess.className = 'story-message';
    gui_text_view.appendChild(mess);
}

/**
 * Add dialog sentence to game text screen
 * @param {string} person - person name
 * @param {string} message - text
 * @return {void}
 */
export function text_view_add_dialog(person, message) {
    let dialog = document.createElement('div');
    dialog.className = 'dialog-container';

    let header = document.createElement('div');
    header.className = 'dialog-header';

    let ava = document.createElement('img');
    ava.src = '/images/ava_' + person + '.png';
    ava.classList.add('person-ava-' + person);
    header.appendChild(ava);

    let person_name = document.createElement('div');
    person_name.innerHTML = characters_get_title(person);
    person_name.className = 'dialog-person';
    person_name.classList.add('person-nick-' + person);
    header.appendChild(person_name);

    dialog.appendChild(header);

    let dialog_body = document.createElement('div');

    const m = message.match(/^\(([^()]+)\)\s+(.+)$/);
    if (m) {
        let expr = document.createElement('div');
        expr.innerHTML = '(' + m[1].trim() + ')';
        expr.className = 'dialog-expression';
        dialog_body.appendChild(expr);
        message = m[2].trim();
    }

    let text = document.createElement('div');
    text.innerHTML = message;
    text.className = 'dialog-message';
    dialog_body.appendChild(text);
    dialog.appendChild(dialog_body);

    gui_text_view.appendChild(dialog);
}

/**
 * Clear game text screen
 * @return {void}
 */
export function text_view_clear() {
    gui_text_view.innerHTML = '';
}

/**
 * Rebuild call-stack widget if it exists
 * @param {array} call_stack - array of stack elements
 * @return {void}
 */
export function update_call_stack_widget(call_stack) {
    if (!gui_call_stack) return;
    gui_call_stack.innerHTML = '';
    call_stack.forEach(elem => {
        let itm = document.createElement('span');
        let fn = elem.code.file;
        const ext = '.' + fn.split('.').pop();
        if (fn.substring(fn.length - ext.length) === ext) fn = fn.substring(0, fn.length - ext.length);
        itm.innerText = fn + ': ' + elem.code.line + ': ' + opcode_to_string(elem.code);
        itm.title = 'Inner position: ' + elem.addr;
        gui_call_stack.appendChild(itm);
    });
}

/**
 * Cover side panel by opaque element
 * @param {boolean} value - true to block, false to unblock
 * @return {void}
 */
export function set_side_panel_blocked(value) {
    gui_side_panel_blocker.style.display = value ? 'block' : 'none';
}

/**
 * Hide side panel
 * @param {boolean} value - true to visible, false to hide
 * @return {void}
 */
export function set_side_panel_visible(value) {
    gui_side_panel.style.display = value ? 'flex' : 'none';
}

/**
 * Return object with all properties of current gui state
 * @return {object}
 */
export function save_gui_state() {
    return {
        location_title: gui_location_title.innerHTML,
        screen_content: gui_text_view.innerHTML,
        menu: menu_cache,
        side_panel_visible: gui_side_panel.style.display !== 'none',
        side_panel_blocked: gui_side_panel_blocker.style.display !== 'none',
    };
}

/**
 * Get object with all properties of gui state and restore it
 * @return {void}
 */
export function restore_gui_state(data) {
    set_title(data.location_title);
    set_side_panel_visible(data.side_panel_visible);
    set_side_panel_blocked(data.side_panel_blocked);
    add_menu(data.menu);

    gui_text_view.innerHTML = data.screen_content;
    let p = document.getElementById(gui_pause_id);
    if (p) {
        p.onclick = () => {
            p.parentNode.removeChild(p);
            on_pause_click();
        };
    }
    let actions = document.getElementsByClassName('game-action-link');
    for (let i = 0; i < actions.length; i++) {
        actions[i].onclick = () => {
            if (enable_actions_by_mouse) set_action(ACTION.LOOK);
            on_action_click(actions[i].getAttribute('data-action-name'));
        };
        if (enable_actions_by_mouse) {
            actions[i].oncontextmenu = () => {
                set_action(get_selected_item() ? ACTION.APPLY : ACTION.INTERACT);
                on_action_click(actions[i].getAttribute('data-action-name'));
            };
        }
    }
    update_action_in_gui();
}
