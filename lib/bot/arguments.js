'use strict';

const { parseDuration } = require('../utils/duration');

const ARG_TYPES = ['string', 'number', 'integer', 'boolean', 'user', 'member', 'channel', 'role', 'snowflake', 'duration', 'rest'];

const MENTION = {
    user: /^<@!?(\d{17,20})>$/,
    member: /^<@!?(\d{17,20})>$/,
    channel: /^<#(\d{17,20})>$/,
    role: /^<@&(\d{17,20})>$/,
};
const SNOWFLAKE = /^\d{17,20}$/;
const TRUE_WORDS = new Set(['true', 'yes', 'y', 'on', '1', 'enable', 'oui', 'o']);
const FALSE_WORDS = new Set(['false', 'no', 'n', 'off', '0', 'disable', 'non']);

/** Thrown when a prefix command receives invalid arguments. */
class ArgumentError extends Error {
    constructor(message, arg) {
        super(message);
        this.name = 'ArgumentError';
        this.arg = arg;
    }
}

/**
 * Checks argument definitions at registration time.
 * @param {ArgumentDefinition[]} defs
 * @param {string} commandName
 */
function validateArgDefs(defs, commandName) {
    if (!Array.isArray(defs)) throw new TypeError(`"args" of "${commandName}" must be an array`);
    const names = new Set();
    defs.forEach((def, i) => {
        if (!def || typeof def.name !== 'string' || !def.name) throw new TypeError(`Argument #${i + 1} of "${commandName}" needs a name`);
        if (names.has(def.name)) throw new TypeError(`Duplicate argument "${def.name}" in "${commandName}"`);
        names.add(def.name);
        const type = def.type || 'string';
        if (!ARG_TYPES.includes(type)) throw new TypeError(`Unknown argument type "${type}" in "${commandName}". Valid: ${ARG_TYPES.join(', ')}`);
        if (type === 'rest' && i !== defs.length - 1) throw new TypeError(`"rest" argument "${def.name}" must be the last one in "${commandName}"`);
    });
}

/**
 * Parses raw tokens into typed values.
 * Optional arguments that do not match their type are skipped (the token goes to the next argument),
 * so `!ban @user spamming` works with an optional duration between user and reason.
 *
 * @param {ArgumentDefinition[]} defs
 * @param {string[]} tokens
 * @param {object} [context]
 * @param {Record<string, (id: string, target: any) => any>} [context.resolvers] - Turn ids into objects (e.g. fetch the user).
 * @param {any} [context.target] - The message, passed to resolvers.
 * @returns {Promise<Record<string, any>>}
 * @throws {ArgumentError}
 */
async function parseArguments(defs, tokens, { resolvers = {}, target } = {}) {
    const values = {};
    let index = 0;

    for (const def of defs) {
        const type = def.type || 'string';
        const required = def.required !== false && def.default === undefined;

        if (type === 'rest') {
            const text = tokens.slice(index).join(' ');
            index = tokens.length;
            if (!text) {
                if (required) throw new ArgumentError(`Missing argument "${def.name}"`, def);
                values[def.name] = def.default;
            } else {
                values[def.name] = checkString(text, def);
            }
            continue;
        }

        const token = tokens[index];
        if (token === undefined) {
            if (required) throw new ArgumentError(`Missing argument "${def.name}"`, def);
            values[def.name] = def.default;
            continue;
        }

        let value;
        try {
            value = convert(type, token, def);
        } catch (err) {
            if (!required && err instanceof ArgumentError) {
                values[def.name] = def.default;
                continue; // leave the token for the next argument
            }
            throw err;
        }
        if (typeof resolvers[type] === 'function' && ['user', 'member', 'channel', 'role'].includes(type)) {
            value = await resolvers[type](value, target);
            if (value === null || value === undefined) throw new ArgumentError(`${capitalize(type)} not found for "${def.name}"`, def);
        }
        values[def.name] = value;
        index++;
    }
    // Extra tokens are tolerated (still available raw in ctx.args)
    return values;
}

function convert(type, token, def) {
    switch (type) {
        case 'string':
            return checkString(token, def);
        case 'number':
        case 'integer': {
            const n = Number(token.replace(',', '.'));
            if (!Number.isFinite(n) || (type === 'integer' && !Number.isInteger(n))) {
                throw new ArgumentError(`"${def.name}" must be ${type === 'integer' ? 'a whole number' : 'a number'}`, def);
            }
            return checkRange(n, def);
        }
        case 'boolean': {
            const t = token.toLowerCase();
            if (TRUE_WORDS.has(t)) return true;
            if (FALSE_WORDS.has(t)) return false;
            throw new ArgumentError(`"${def.name}" must be yes or no`, def);
        }
        case 'user':
        case 'member':
        case 'channel':
        case 'role': {
            const m = MENTION[type].exec(token);
            if (m) return m[1];
            if (SNOWFLAKE.test(token)) return token;
            throw new ArgumentError(`"${def.name}" must be a ${type === 'member' ? 'user' : type} mention or ID`, def);
        }
        case 'snowflake':
            if (SNOWFLAKE.test(token)) return token;
            throw new ArgumentError(`"${def.name}" must be an ID`, def);
        case 'duration': {
            let ms;
            try { ms = parseDuration(token); } catch (_) { ms = NaN; }
            if (!Number.isFinite(ms) || ms <= 0 || /^\d+$/.test(token)) {
                // Bare numbers are ambiguous for users ("10" = 10 ms?): require a unit
                throw new ArgumentError(`"${def.name}" must be a duration like 10m, 2h or 1d`, def);
            }
            return checkRange(ms, def, true);
        }
        default:
            throw new ArgumentError(`Unsupported type "${type}"`, def);
    }
}

function checkString(value, def) {
    if (def.min !== undefined && value.length < def.min) throw new ArgumentError(`"${def.name}" must be at least ${def.min} characters`, def);
    if (def.max !== undefined && value.length > def.max) throw new ArgumentError(`"${def.name}" must be at most ${def.max} characters`, def);
    if (Array.isArray(def.choices) && !def.choices.some(c => String(c).toLowerCase() === value.toLowerCase())) {
        throw new ArgumentError(`"${def.name}" must be one of: ${def.choices.join(', ')}`, def);
    }
    if (def.regex instanceof RegExp && !def.regex.test(value)) throw new ArgumentError(`"${def.name}" has an invalid format`, def);
    if (Array.isArray(def.choices)) return def.choices.find(c => String(c).toLowerCase() === value.toLowerCase());
    return value;
}

function checkRange(value, def, isDuration = false) {
    const min = def.min === undefined ? undefined : (isDuration ? parseDuration(def.min) : def.min);
    const max = def.max === undefined ? undefined : (isDuration ? parseDuration(def.max) : def.max);
    if (min !== undefined && value < min) throw new ArgumentError(`"${def.name}" must be at least ${def.min}`, def);
    if (max !== undefined && value > max) throw new ArgumentError(`"${def.name}" must be at most ${def.max}`, def);
    if (Array.isArray(def.choices) && !def.choices.includes(value)) throw new ArgumentError(`"${def.name}" must be one of: ${def.choices.join(', ')}`, def);
    return value;
}

/**
 * Builds a usage line: `!ban <user> [duration] [reason...]`.
 * @param {string} prefix
 * @param {string} name
 * @param {ArgumentDefinition[]} defs
 * @returns {string}
 */
function formatUsage(prefix, name, defs) {
    const parts = (defs || []).map(def => {
        const label = (def.type || 'string') === 'rest' ? `${def.name}...` : def.name;
        const required = def.required !== false && def.default === undefined;
        return required ? `<${label}>` : `[${label}]`;
    });
    const head = prefix.startsWith('<@') ? `${prefix} ${name}` : `${prefix}${name}`; // mention prefix
    return [head, ...parts].join(' ');
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * @typedef {object} ArgumentDefinition
 * @property {string} name
 * @property {'string'|'number'|'integer'|'boolean'|'user'|'member'|'channel'|'role'|'snowflake'|'duration'|'rest'} [type='string']
 * @property {boolean} [required=true] - False, or a `default`, makes it optional.
 * @property {any}     [default]
 * @property {number|string} [min] - Length (string), value (number) or duration ('1m').
 * @property {number|string} [max]
 * @property {any[]}   [choices]
 * @property {RegExp}  [regex]
 * @property {string}  [description]
 */

module.exports = { ArgumentError, ARG_TYPES, validateArgDefs, parseArguments, formatUsage };
