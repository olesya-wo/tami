import {set_side_panel_visible} from './gui.js';
import {TamiRuntimeError} from "./runner.js";

const notifier = new AWN({
    position: 'bottom-right',
    durations: {info: 5000},
    labels: {info: ""},
});

// Callbacks

export function on_location_change(name, title) {}

export function on_sentence_story(message) {}

export function on_sentence_dialog(person, message) {}

export function on_sentence_clear() {}

export function on_interact(action_name) {}

export function on_menu_show() {}

export function on_menu_option(title) {}

export function on_variable_set(var_name, value) {}

export function on_inventory_add(item_name, item_title) {
    notifier.info('➕&nbsp;&nbsp;' + item_title);
}

export function on_inventory_remove(item_name, item_title) {
    notifier.info('❌&nbsp;&nbsp;' + item_title);
}

export function on_combine(first, second) {}

export function on_inventory_clear() {}

export function on_command(command) {
    if (command === 'hide_panel') set_side_panel_visible(false);
    if (command === 'show_panel') set_side_panel_visible(true);
}

export function on_error(error) {
    if (error instanceof TamiRuntimeError)
        notifier.alert(error.toString(), {durations: {alert: 0}});
    else
        notifier.alert(JSON.stringify(error), {durations: {alert: 0}});
}
