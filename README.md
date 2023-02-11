# Tami

Engine + IDE for text-quest games. Something similar to RenPy or rather Ink.

### IDE

At the left side there is a list of all files, locations/actions, variables, inventory items and persons for dialogs.  
At the center there is a big text area with syntax highlighting for the currently selected script file.
At the right side there are setup script (in this field allowed only `+{item}`, `variable = number` or `// command`), callstack widget, log and game realtime preview.

All script files must be in `script` folder and have `.tami` extension. And `setup.tami` for setup script. If `debug_mode` is on, `script-debug.txt` will be generated near each `script.tami` just for debug.

---

### Syntax:

Sentences:

Any string that is not a part of other syntax constuctions is a sentence  
It just appears on the screen one by one instantly  
Can contain links to actions - `[some action]` or `[some action (display name)]`  
Can also contain interpolated variables - `[:var_name:]`  
All text is passed to screen as HTML, so you can use any html tags and styles

Dialogs:

First, you need to define character with display name - `character mom = My mom`  
Then you can use `mom` as person in dialogs  
`person: Sentense` or `person: (additional info) Sentense`  
Each message will be displayed separately, and block the side-panel until player clicks  
Can also contain interpolated variables - `[:var_name:]`

Menus:

```
+ First choice:
	What to do if player click at First choice
+ Second choice:
	What to do if player click at First choice
```

Menu blocks all space while on screen

Actions:

```
> action name:
	Some block of text or commands
	.
```

In any block you can get the currently active action from variable `action`:  
`0` - look  
`1` - interact  
`2` - apply something from the inventory  
Also variables `LOOK`, `INTERACT` and `USE` set to `0` or `1` accordingly to variable `action`  
Any action must ends up with `.` - analog of `return` in programming languages, because action called by `call`, not `jump` (detailed information below)

Locations:

`[location name]` or `[location name (display name)]`  
It’s like any actions, but also clear screen and set title in GUI  
In sum, actions and locations are just labes in code.

Items:

You can place some item in the inventory by `+{name}` or `+{name (display name)}`  
Or you can remove it from inventory by `-{name}`  
You can also clear the entire inventory by `-{}`  
All inventory items are displayed in side panel and click on the item is equal click on action with the same name

Variables:

`var_name = expression` -  set the variable value by some expression  
Values can be only integers.  
Value of uninitialized variable is `0`  
Instead of variables in expressions you can use `{item}` - it’ll return `1` if this item stored in your inventory, or `2` if this item is also selected for interaction

Operators:

Unary

| - |  |
| --- | --- |
| : | abs |
| ~ | comp |
| ! | not |
| @ | rand (@3 can return 0, 1 or 2) |

Binary

| + | add |
| --- | --- |
| - | sub |
| * | mul |
| / | div |
| % | mod |
| ** | pow |

| && | and |
| --- | --- |
| || | or |

| & | band |
| --- | --- |
| | | bor |
| ^ | xor |
| << | lsh |
| >> | rsh |

| > | gt |
| --- | --- |
| >= | ge |
| < | lt |
| <= | le |
| == | eq |
| != | ne |

| <<= | min |
| --- | --- |
| >>= | max |

Control flow:

`jump location or action name` - jump to location or action  
`call location or action name` - call location or action as function  
Jump operator will just change current code position, call operator also add current address to call-stack.  
Game starts from label `start`

Conditions:

```
if some_statement:
	what to do if statement is true
else:
	what to do if statement is false

if some_statement:
	conditin without else
```

Custom commands:

`// command` - any string after `//` will be passed to `on_command` callback

Other commands:

`…` - game will be wait for players click  
`.` - stop executing script  
If call stack is empty, script will just stop executing, otherwise pop address from stack and go to this address.  
`[]` - clear screen

### Build / Run

You can use [nw.js](https://github.com/nwjs/nw.js) for IDE as well as game itself. But also any other similar like Electron, etc.  
Game also can be executed as a regular web-page, in this case saves will be stored in LocalStorage.

### TODO
- Tests
- Spellchecker (e.g. [this](https://github.com/swenson/ace_spell_check_js))
- Visual improvements
