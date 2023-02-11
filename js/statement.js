import {TT} from './runner.js';
import {TamiSyntaxError} from './parser.js';

const max_operator_length = 4;
const op_mapping = {
    'add': '+',
    'sub': '-',
    'mul': '*',
    'div': '/',
    'mod': '%',
    'pow': '**',

    'and': '&&',
    'or': '||',
    'not': '!', // unary

    'gt': '>',
    'ge': '>=',
    'lt': '<',
    'le': '<=',
    'eq': '==',
    'ne': '!=',

    'rsh': '>>',
    'lsh': '<<',
    'bor': '|',
    'band': '&',
    'xor': '^',
    'comp': '~', // unary

    'min': '<<=',
    'max': '>>=',
    'abs': ':', // unary
    'rand': '@', // unary
};
const unary_operators = ['!', '~', ':', '@', '-u'];

/**
 * Parse one operator from text
 * @param {string} text - statement
 * @param {number} pos - start position in text
 * @return {object|null}
 */
function parse_operator(text, pos) {
    for (let len = max_operator_length; len > 0; --len) {
        const s = text.substring(pos, pos + len);
        if (Object.keys(op_mapping).includes(s)) {
            // Check before op
            if (pos > 0) {
                const ch = text[pos - 1];
                if (is_alphabet(ch) || is_digit(ch)) {
                    console.log(s, 'before is', ch);
                    continue;
                }
            }
            // Check after op
            if (pos + s.length < text.length - 1) {
                const ch = text[pos + s.length];
                if (is_alphabet(ch) || is_digit(ch)) {
                    continue;
                }
            }
            return {
                t_type: TT.T_OP,
                token: op_mapping[s],
                len: s.length,
            };
        }
        if (Object.values(op_mapping).includes(s)) {
            return {
                t_type: TT.T_OP,
                token: s,
                len: s.length,
            };
        }
    }
    return null;
}

/**
 * Get priority of operator for stack
 * @param {string} op - operator
 * @return {number}
 */
function operator_priority(op) {
    if (op === "-u" || op === "!" || op === "~" || op === ":" || op === "@") return 11;
    if (op === "*" || op === "/" || op === "%" || op === "**") return 10;
    if (op === "+" || op === "-") return 9;
    if (op === "<<" || op === ">>") return 8;
    if (op === "<<=" || op === ">>=") return 8;
    if (op === ">" || op === ">=" || op === "<" || op === "<=") return 7;
    if (op === "!=" || op === "==") return 6;
    if (op === "&") return 5;
    if (op === "^") return 4;
    if (op === "|") return 3;
    if (op === "&&") return 2;
    if (op === "||") return 1;
    return 0;
}

/**
 * Guess unary sign
 * @param {array} tokens - statement tokens
 * @param {number} pos - sign position in array
 * @return {boolean}
 */
function is_unary_sign(tokens, pos) {
    if (pos < 1) return true;
    if (tokens.length > 1) {
        if (pos > tokens.length - 2) return false;
        const next_tt = tokens[pos + 1].t_type;
        if (next_tt === TT.T_OP) return false;
    }
    const before_tt = tokens[pos - 1].t_type;
    if (before_tt === TT.T_NUM || before_tt === TT.T_VAR || before_tt === TT.T_ITEM) return false;
    if (before_tt === TT.T_PAR) return tokens[pos - 1].token === "(";
    return true;
}

/**
 * Guess possible BEGINNING of variable
 * @param {string} s - one character
 * @return {boolean}
 */
function is_alphabet(s) {
    return /^[a-z_]$/i.test(s);
}

/**
 * Parse one variable from text
 * @param {string} text - statement
 * @param {number} pos - start position in text
 * @return {object}
 */
function parse_variable(text, pos) {
    let res = '';
    while (pos < text.length) {
        const ch = text[pos];
        if (!/^[a-z_0-9]$/i.test(ch)) break;
        res += ch;
        ++pos;
    }
    return {
        t_type: TT.T_VAR,
        token: res,
    };
}

/**
 * Guess possible BEGINNING of number
 * @param {string} s - one character
 * @return {boolean}
 */
function is_digit(s) {
    return /^\d$/.test(s);
}

/**
 * Parse one number from text
 * @param {string} text - statement
 * @param {number} pos - start position in text
 * @return {object}
 */
function parse_number(text, pos) {
    let res = '';
    while (pos < text.length) {
        const ch = text[pos];
        if (!/^\d$/i.test(ch)) break;
        res += ch;
        ++pos;
    }
    return {
        t_type: TT.T_NUM,
        token: res,
    };
}

/**
 * Parse one {item} from text
 * @param {string} text - statement
 * @param {number} pos - start position in text
 * @param {number} current_line_number - statement line
 * @return {object}
 */
function parse_item(text, pos, current_line_number) {
    let res = '';
    const start = pos;
    while (pos < text.length) {
        const ch = text[pos];
        res += ch;
        if (ch === '}') {
            return {
                t_type: TT.T_ITEM,
                token: res,
            };
        }
        ++pos;
    }
    throw new TamiSyntaxError('INVALID_ITEM: ' + res + ' (pos ' + start + ')');
}

/**
 * Convert statement to array of tokens
 * @param {string} text - statement
 * @param {number} current_line_number - statement line
 * @return {array}
 */
function tokenize(text, current_line_number) {
    let res = [];
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (ch === ' ' || ch === "\t") {
            ++i;
            continue;
        }
        const t = parse_operator(text, i);
        if (t) {
            res.push(t);
            i += t.len;
            continue;
        }
        if (is_alphabet(ch)) {
            const t = parse_variable(text, i);
            res.push(t);
            i += t.token.length;
            continue;
        }
        if (is_digit(ch)) {
            const t = parse_number(text, i);
            res.push(t);
            i += t.token.length;
            continue;
        }
        if (ch === '(' || ch === ')') {
            res.push({
                t_type: TT.T_PAR,
                token: ch,
            });
            ++i;
            continue;
        }
        if (ch === '{') {
            const t = parse_item(text, i, current_line_number);
            res.push(t);
            i += t.token.length;
            continue;
        }
        throw new TamiSyntaxError('UNEXPECTED_CHARACTER: ' + ch + ' (pos ' + i + ')');
    }
    return res;
}

/**
 * Convert array of tokens to reverse notation
 * @param {array} tokens - statement tokens
 * @param {number} current_line_number - statement line
 * @return {array}
 */
function to_rev_notation(tokens, current_line_number) {
    let stack = [];
    let res = [];
    for (let i = 0; i < tokens.length; i++) {
        let t = tokens[i];
        if (t.token === "-" && is_unary_sign(tokens, i)) t.token = '-u';
        if (t.t_type === TT.T_NUM || t.t_type === TT.T_ITEM || t.t_type === TT.T_VAR) {
            res.push(t);
        }
        if (t.t_type === TT.T_OP) {
            while (stack.length > 0) {
                const top = stack[stack.length - 1];
                if (top.t_type === TT.T_OP) {
                    let st_priority = operator_priority(top.token);
                    let op_priority = operator_priority(t.token);
                    if (st_priority >= op_priority) {
                        res.push(stack.pop());
                        continue;
                    }
                }
                break;
            }
            stack.push(t);
        }
        if (t.t_type === TT.T_PAR) {
            if (t.token === "(") {
                stack.push(t);
            } else {
                while (stack.length > 0) {
                    if (stack[stack.length - 1].t_type === TT.T_PAR) break;
                    res.push(stack.pop());
                }
                if (stack.length < 1) {
                    throw new TamiSyntaxError('ODD_PARENTHESES');
                }
                stack.pop();
            }
        }
    }
    while (stack.length > 0) {
        let op = stack.pop();
        if (op.t_type !== TT.T_OP) {
            throw new TamiSyntaxError('ODD_PARENTHESES');
        }
        res.push(op);
    }
    return res;
}

/**
 * Convert text statement to reverse notation array
 * @param {string} text - statement
 * @param {number} current_line_number - statement line
 * @return {array}
 */
export function parse_statement(text, current_line_number) {
    const tokens = tokenize(text, current_line_number);
    const rev_notation = to_rev_notation(tokens, current_line_number);
    check_statement(rev_notation, current_line_number);
    return rev_notation;
}

/**
 * Throws exception if stack of statement is incorrect
 * @param {array} statement - array of tokens
 * @param {number} current_line_number - statement line
 * @return {void}
 */
function check_statement(statement, current_line_number) {
    let stack = 0;
    statement.forEach(t => {
        switch (t.t_type) {
            case TT.T_ITEM:
            case TT.T_VAR:
            case TT.T_NUM:
                ++stack;
                break;
            case TT.T_OP:
                if (unary_operators.includes(t.token)) {
                    if (stack < 1) {
                        throw new TamiSyntaxError('EMPTY_STACK');
                    }
                } else {
                    if (stack < 2) {
                        throw new TamiSyntaxError('LOW_STACK');
                    }
                    --stack;
                }
                break;
            default:
                throw new TamiSyntaxError('INVALID_TOKEN_IN_STACK ' + t.t_type);
        }
    });
    if (stack !== 1) {
        throw new TamiSyntaxError('INVALID_STATEMENT');
    }
}
