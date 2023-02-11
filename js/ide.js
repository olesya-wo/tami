import {parse, build_js_module, build_debug_file, parse_setup, TamiSyntaxError} from './parser.js';
import {run_script, init_script, run_setup, TamiRuntimeError} from "./runner.js";
import {
    analyze_labels, analyze_variables,
    analyze_items, analyze_characters,
    analyze_reaching, analyze_labels_setup,
    TamiAnalyzeError,
} from "./analyzer.js";
import {init_gui} from './gui.js';

let script_editor = null;
let script_delay_timer = null;
let setup_editor = null;
let setup_delay_timer = null;
let left_panel = null;
let left_splitter = null;
let center_editor = null;
let right_panel = null;
let right_splitter = null;

let log = null;
let files_panel = null;
let statistic_panel = null;

const LOG_INFO = 1;
const LOG_WARNING = 2;
const LOG_ERROR = 3;

const fs = require('fs');
let files = [];
let current_file = '';

// Settings
export const debug_mode = false;
const edit_delay = 3000;
const script_ext = '.tami';
const left_panel_min_width = 200;
const right_panel_min_width = 600;

window.onload = () => {
    current_file = 'main' + script_ext;
    document.getElementById('game-main-menu').style.display = 'none';
    document.getElementById('game-progress-menu').style.display = 'none';
    log = document.getElementById('ide-log');
    files_panel = document.getElementById('file-list');
    statistic_panel = document.getElementById('statistic');
    left_panel = document.getElementById('left-panel');
    left_splitter = document.getElementById('left-splitter');
    center_editor = document.getElementById('ide-script-input');
    right_panel = document.getElementById('right-panel');
    right_splitter = document.getElementById('right-splitter');
    dragElement(left_splitter, left_panel, left_panel_min_width, center_editor, 0);
    dragElement(right_splitter, center_editor, 0, right_panel, right_panel_min_width);
    let wnd = nw.Window.get();
    wnd.maximize();
    init_gui();
    init_editors();
    open_files();
    document.getElementById('ide-game-reset-btn').onclick = () => {
        log.innerHTML = '';
        ide_log('Reset', LOG_INFO);
        reset_game(true);
    };
    document.getElementById('game-loading-menu').style.display = 'none';
};

/**
 * Out log-message
 * @param {string} error - message
 * @param {number} level - type
 * @return {void}
 */
function ide_log(error, level) {
    if (level === LOG_ERROR) {
        log.innerHTML += '<div class="log-error">' + error + '</div>';
    } else if (level === LOG_WARNING) {
        log.innerHTML += '<div class="log-warning">' + error + '</div>';
    } else {
        log.innerHTML += '<div class="log-info">' + error + '</div>';
    }
}

/**
 * Create text-areas and bind onchange events
 * @return {void}
 */
function init_editors() {
    script_editor = ace.edit("ide-script-input");
    script_editor.setTheme("ace/theme/chrome");

    setup_editor = ace.edit("ide-setup-input");
    setup_editor.setTheme("ace/theme/chrome");
    setup_editor.session.setMode("ace/mode/tami");
}

/**
 * Update classes of file list menu
 * @return {void}
 */
function update_file_selection() {
    for (let i = 0; i < files_panel.children.length; ++i) {
        if (files_panel.children[i].innerText === current_file.substring(0, current_file.length - script_ext.length))
            files_panel.children[i].classList.add('ide-block-item-selected');
        else
            files_panel.children[i].classList.remove('ide-block-item-selected');
    }
}

/**
 * Change current file and load it to editor
 * @param {string} file - file name
 * @return {void}
 */
function change_current_file(file) {
    if (current_file !== file) {
        if (script_delay_timer) {
            clearTimeout(script_delay_timer);
            script_delay_timer = null;
            on_script_change();
        }
        files.forEach(f => {
            if (f.name === file) script_editor.setSession(f.session);
        });
        current_file = file;
        update_file_selection();
    }
}

/**
 * Open script and setup files
 * @return {void}
 */
function open_files() {
    fs.readdirSync('script').forEach(file => {
        if (file.substring(file.length - script_ext.length) === script_ext && file !== ('setup' + script_ext)) {
            const file_data = fs.readFileSync('script/' + file, 'utf8');
            let session = ace.createEditSession(file_data);
            session.setMode("ace/mode/tami");
            session.on('change', function() {
                log.innerHTML = '';
                ide_log('Script ' + file + ' modified', LOG_WARNING);
                if (script_delay_timer) clearTimeout(script_delay_timer);
                script_delay_timer = setTimeout(on_script_change, edit_delay);
            });
            files.push({
                name: file,
                session: session,
            });
            let i = document.createElement('div');
            i.innerText = file.substring(0, file.length - script_ext.length);
            i.className = 'ide-block-item';
            if (file === current_file) {
                i.classList.add('ide-block-item-selected');
                script_editor.setSession(session);
            }
            files_panel.appendChild(i);
            i.onclick = () => {
                change_current_file(file);
            };
        }
    });

    let setup = '';
    const setup_file = 'script/setup' + script_ext;
    try {
        setup = fs.readFileSync(setup_file, 'utf8');
    } catch (err) {
        ide_log("Can't find " + setup_file, LOG_WARNING);
        return;
    }
    setup_editor.session.setValue(setup, -1);
    setup_editor.session.on('change', function() {
        log.innerHTML = '';
        ide_log("Setup modified", LOG_WARNING);
        if (setup_delay_timer) clearTimeout(setup_delay_timer);
        setup_delay_timer = setTimeout(on_setup_change, edit_delay);
    });

    reset_game();
}

/**
 * Build left panel with header 'name' and items from 'data'
 * @param {string} name - panel title
 * @param {array} data - items with: name, uses, file, line and [is_loc]
 * @return {void}
 */
function build_panel_block(name, data) {
    let block = document.createElement('div');
    let header = document.createElement('div');
    header.innerHTML = name;
    header.className = 'ide-panel-header';
    block.appendChild(header);
    data.forEach(item => {
        let i = document.createElement('div');
        i.className = 'ide-block-item';
        i.innerText = item.name;
        if (!item.used) {
            i.classList.add('ide-block-item-unused');
            i.title = 'Unused';
        }
        if (item.is_loc !== undefined) {
            if (!item.is_loc) {
                i.style.paddingLeft = '20px';
            }
        }
        i.onclick = () => {
            change_current_file(item.file);
            script_editor.gotoLine(item.line);
        };
        block.appendChild(i);
    });
    statistic_panel.appendChild(block);
}

/**
 * Utility function for file saving
 * @param {string} file - file name
 * @param {string} data - file data
 * @return {boolean}
 */
function save_file(file, data) {
    try {
        fs.writeFileSync(file, data);
    } catch (err) {
        ide_log("Can't save " + file, LOG_ERROR);
        return false;
    }
    return true;
}

/**
 * Callback for script changing
 * @return {void}
 */
function on_script_change() {
    script_delay_timer = null;

    if (!save_file('script/' + current_file, script_editor.getValue())) return;
    log.innerHTML = '';
    ide_log('Script ' + current_file + ' saved', LOG_INFO);

    reset_game();
}

/**
 * Callback for setup changing
 * @return {void}
 */
function on_setup_change() {
    if (!save_file('script/setup' + script_ext, setup_editor.getValue())) return;
    log.innerHTML = '';
    ide_log('Setup saved', LOG_INFO);

    reset_game();
}

/**
 * Re-init, re-setup and start game
 * @param {boolean} [soft] - only reset, without saving
 * @return {void}
 */
function reset_game(soft) {
    init_script([]);

    // Parse all scripts
    let script_codes = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let codes = [];
        try {
            codes = parse(file.name, file.session.getValue());
        } catch (e) {
            if (e instanceof TamiSyntaxError) {
                ide_log(e.toString(), LOG_ERROR);
            } else {
                console.log(e);
                ide_log('UNKNOWN ERROR', LOG_ERROR);
            }
            return;
        }
        script_codes = script_codes.concat(codes);
        // Save debug file
        const df = 'script/' + file.name.substring(0, file.name.length - script_ext.length) + '-debug.txt';
        if (debug_mode && !soft) save_file(df, build_debug_file(codes));
    }

    init_script(script_codes);

    // Save js module
    let js_module = '';
    try {
        js_module = build_js_module(script_codes);
    } catch (e) {
        if (e.error && e.code) {
            ide_log(e.error + ': ' + e.code, LOG_ERROR);
        } else {
            ide_log('UNKNOWN ERROR', LOG_ERROR);
            console.log(e);
        }
        return;
    }
    if (!soft) save_file('js/script.js', js_module);
    ide_log('Script compiled', LOG_INFO);

    // Check data
    let locations = [];
    let variables = [];
    let items = [];
    let characters = [];
    try {
        locations = analyze_labels(script_codes);
        variables = analyze_variables(script_codes);
        items = analyze_items(script_codes);
        characters = analyze_characters(script_codes);
    } catch (e) {
        if (e instanceof TamiAnalyzeError) {
            ide_log(e.toString(), LOG_ERROR);
        } else {
            console.log(e);
            ide_log('UNKNOWN ERROR', LOG_ERROR);
        }
        return;
    }

    const unreached = analyze_reaching(script_codes);
    unreached.forEach(warn => {
        ide_log('Unreached code at ' + warn.file + ':' + warn.error_line, LOG_WARNING);
    });

    if (!soft) {
        statistic_panel.innerHTML = '';
        build_panel_block('Locations', locations);
        build_panel_block('Variables', variables);
        build_panel_block('Items', items);
        build_panel_block('Characters', characters);
    }

    // Parse setup
    let setup_codes = [];
    try {
        setup_codes = parse_setup(setup_editor.getValue());
    } catch (e) {
        if (e instanceof TamiSyntaxError) {
            ide_log(e.toString(), LOG_ERROR);
        } else {
            console.log(e);
            ide_log('UNKNOWN ERROR', LOG_ERROR);
        }
        return;
    }
    try {
        analyze_variables(setup_codes);
        analyze_labels_setup(setup_codes, locations);
    } catch (e) {
        if (e instanceof TamiAnalyzeError) {
            ide_log(e.toString(), LOG_ERROR);
        } else {
            console.log(e);
            ide_log('UNKNOWN ERROR', LOG_ERROR);
        }
        return;
    }
    ide_log('Setup compiled', LOG_INFO);

    // Save debug file
    if (debug_mode && !soft) save_file('script/setup-debug.txt', build_debug_file(setup_codes));

    // Run setup
    ide_log('Running setup', LOG_INFO);
    try {
        run_setup(setup_codes);
    } catch (e) {
        if (e instanceof TamiRuntimeError) {
            ide_log(e.toString(), LOG_ERROR);
        } else {
            console.log(e);
            ide_log('UNKNOWN ERROR', LOG_ERROR);
        }
        return
    }

    // Run game
    ide_log('Running game', LOG_INFO);
    try {
        run_script();
    } catch (e) {
        if (e instanceof TamiRuntimeError) {
            ide_log(e.toString(), LOG_ERROR);
        } else {
            console.log(e);
            ide_log('UNKNOWN ERROR', LOG_ERROR);
        }
    }
}

/**
 * Splitter implementation for div
 * @param {HTMLElement} element - splitter div
 * @param {HTMLElement} left - left div
 * @param {number} min_left - minimal width of left part
 * @param {HTMLElement} right - right div
 * @param {number} min_right - minimal width of right part
 * @return {void}
 */
function dragElement(element, left, min_left, right, min_right) {
    let md;
    element.onmousedown = element.ontouchstart = onMouseDown;

    function onMouseDown(e) {
        md = {
            e,
            offsetLeft: element.offsetLeft,
            offsetTop: element.offsetTop,
            firstWidth: left.offsetWidth,
            secondWidth: right.offsetWidth,
        };
        document.onmousemove = document.ontouchmove = onMouseMove;
        document.onmouseup = document.ontouchend = () => {
            document.onmousemove = document.onmouseup = null;
            document.ontouchmove = document.ontouchend = null;
        };
        e.preventDefault();
    }

    function onMouseMove(e) {
        const client_x = e.clientX ? e.clientX : e.touches[0].clientX;
        const client_y = e.clientY ? e.clientY : e.touches[0].clientY;
        const md_client_x = md.e.clientX ? md.e.clientX : md.e.touches[0].clientX;
        const md_client_y = md.e.clientY ? md.e.clientY : md.e.touches[0].clientY;
        let delta = {x: client_x - md_client_x, y: client_y - md_client_y};

        // Preventing "flipped" elements (size < 0)
        delta.x = Math.min(Math.max(delta.x, -md.firstWidth), md.secondWidth);

        if (min_left > 0 && md.firstWidth + delta.x < min_left) {
            delta.x = delta.x < 0 ? -md.firstWidth : min_left;
        }

        if (min_right > 0 && md.secondWidth - delta.x < min_right) {
            delta.x = delta.x > 0 ? md.secondWidth : -min_right;
        }

        element.style.left = md.offsetLeft + delta.x + "px";
        left.style.width = (md.firstWidth + delta.x) + "px";
        right.style.width = (md.secondWidth - delta.x) + "px";
        e.preventDefault();
    }
}
