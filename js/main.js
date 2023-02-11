import {script_codes} from './script.js';
import {init_script, run_script, save_state, load_state} from "./runner.js";
import {init_gui} from "./gui.js";
import {get_saves, store_save, delete_save} from './saves.js';

const notifier = new AWN({
    position: 'bottom-right',
    durations: {info: 5000},
    labels: {info: ""},
});
let game_started = false;
let current_slot = null;
let storing = false;

let game_main_menu = null;
let game_progress_menu = null;
let game_continue_btn = null;
let game_save_btn = null;
let game_slot_save_btn = null;
let game_load_btn = null;
let game_slot_load_btn = null;
let game_exit_btn = null;

window.onload = () => {
    game_main_menu = document.getElementById('game-main-menu');
    game_progress_menu = document.getElementById('game-progress-menu');
    document.getElementById('game-main-menu-btn').onclick = open_main_menu;
    document.getElementById('game-new-btn').onclick = on_new_game;

    game_continue_btn = document.getElementById('game-continue-btn');
    game_continue_btn.onclick = on_continue_game;

    game_save_btn = document.getElementById('game-save-btn');
    game_save_btn.onclick = on_save_game;

    game_load_btn = document.getElementById('game-load-btn');
    game_load_btn.onclick = on_load_game;

    game_exit_btn = document.getElementById('game-exit-btn');
    game_exit_btn.onclick = on_exit_game;

    document.getElementById('game-back-btn').onclick = open_main_menu;

    game_slot_save_btn = document.getElementById('game-slot-save-btn');
    game_slot_save_btn.onclick = on_save_slot;

    game_slot_load_btn = document.getElementById('game-slot-load-btn');
    game_slot_load_btn.onclick = on_load_slot;

    document.getElementById('game-slot-delete-btn').onclick = on_delete_slot;

    open_main_menu();

    if (typeof nw !== 'undefined') {
        let wnd = nw.Window.get();
        wnd.on('close', on_exit_game);
    } else {
        game_exit_btn.style.display = 'none';
    }
    document.getElementById('game-loading-menu').style.display = 'none';
};

function open_main_menu() {
    game_main_menu.style.display = 'flex';
    game_progress_menu.style.display = 'none';
    const saves = get_saves();
    game_continue_btn.style.display = saves.length || game_started ? 'block' : 'none';
    game_load_btn.style.display = saves.length ? 'block' : 'none';
    game_save_btn.style.display = game_started ? 'block' : 'none';
}

function on_new_game() {
    function start_game() {
        init_gui();
        init_script(script_codes);
        run_script();
        game_main_menu.style.display = 'none';
        game_started = true;
    }
    if (!game_started) {
        start_game();
        return;
    }
    notifier.confirm(
        'Are you sure?',
        start_game,
        null,
        {labels: {confirm: 'New game'}}
    );
}

function on_continue_game() {
    if (game_started) {
        game_main_menu.style.display = 'none';
        return;
    }
    const saves = get_saves();
    const json_data = saves[0].data;
    if (!game_started) {
        init_gui();
        init_script(script_codes);
        game_started = true;
    }
    load_state(json_data);
    game_main_menu.style.display = 'none';
}

function rebuild_save_slots() {
    let list = document.getElementById('game-save-slots');
    list.innerHTML = '';
    let saves = get_saves();
    current_slot = null;
    if (storing) saves.unshift({name: 'New slot', timestamp: null, data: null});
    saves.forEach(save => {
        let slot = document.createElement('div');
        slot.innerText = save.name;
        slot.className = 'game-slot-item';
        if (!save.timestamp) slot.classList.add('game-slot-item-selected');
        slot.onclick = () => {
            for (let i = 0; i < list.children.length; i++) list.children[i].classList.remove('game-slot-item-selected');
            slot.classList.add('game-slot-item-selected');
            current_slot = save;
        };
        list.appendChild(slot);
    });
}

function on_save_game() {
    game_main_menu.style.display = 'none';
    game_progress_menu.style.display = 'flex';
    storing = true;
    rebuild_save_slots();
    game_slot_save_btn.style.display = 'block';
    game_slot_load_btn.style.display = 'none';
}

function on_load_game() {
    game_main_menu.style.display = 'none';
    game_progress_menu.style.display = 'flex';
    storing = false;
    rebuild_save_slots();
    game_slot_save_btn.style.display = 'none';
    game_slot_load_btn.style.display = 'block';
}

function on_exit_game() {
    if (!game_started) {
        nw.App.quit();
        return;
    }
    notifier.confirm(
        'Are you sure?',
        nw.App.quit,
        null,
        {labels: {confirm: 'Quit game'}}
    );
}

function on_save_slot() {
    const time = Date.now || function() {return +new Date};
    let timestamp = current_slot ? current_slot.timestamp : null;
    if (!timestamp) {
        save_slot();
        return;
    }
    notifier.confirm(
        'Are you sure?',
        () => {
            if (!delete_save(timestamp)) {
                notifier.alert('Delete slot failed');
                return;
            }
            save_slot();
        },
        null,
        {labels: {confirm: 'Replace slot'}}
    );

    function save_slot() {
        timestamp = time();
        if (!store_save(timestamp, save_state())) {
            notifier.alert('Save slot failed');
            return;
        }
        game_progress_menu.style.display = 'none';
    }
}

function on_load_slot() {
    if (!current_slot) return;
    if (!game_started) {
        init_gui();
        init_script(script_codes);
        game_started = true;
        load_state(current_slot.data);
        game_progress_menu.style.display = 'none';
        return;
    }
    notifier.confirm(
        'Are you sure?',
        () => {
            load_state(current_slot.data);
            game_progress_menu.style.display = 'none';
        },
        null,
        {labels: {confirm: 'Load game'}}
    );
}

function on_delete_slot() {
    if (!current_slot || !current_slot.timestamp) return;
    notifier.confirm(
        'Are you sure?',
        () => {
            if (!delete_save(current_slot.timestamp)) {
                notifier.alert('Delete slot failed');
                return;
            }
            rebuild_save_slots();
        },
        null,
        {labels: {confirm: 'Delete slot'}}
    );
}
