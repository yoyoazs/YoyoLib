"use strict";

const { convertMSToHoursAndMinutes } = require('../utils');
const fs       = require('fs');
const readline = require('readline');
const { MessageEmptyError, EmptyArrayError } = require('../error/indexError');

/**
 * Available log levels in ascending order of severity.
 * @enum {number}
 */
const LOG_LEVELS = {
    debug: 0,
    log:   1,
    info:  2,
    warn:  3,
    error: 4,
};

class Logger {
    /**
     * @param {string}  file            - Name of the log file (without extension).
     * @param {boolean} logDateAndHours - If true, includes the date in timestamps.
     * @param {object}  [args]          - Optional configuration.
     * @param {string}  [args.debug_color]
     * @param {string}  [args.log_color]
     * @param {string}  [args.info_color]
     * @param {string}  [args.warn_color]
     * @param {string}  [args.error_color]
     * @param {string}  [args.time_color]
     * @param {string}  [args.name_color]
     * @param {keyof LOG_LEVELS} [args.level='debug'] - Minimum level to output.
     * @param {number}  [args.maxSize]  - Max log file size in MB before rotation. 0 = disabled.
     * @param {boolean} [args.json]     - If true, logs are output as structured JSON.
     */
    constructor(file, logDateAndHours, args = undefined) {
        this.file           = file;
        this._currentFile   = file;
        this._rotationCount = 0;
        this.logDateAndHours = logDateAndHours;
        this.json           = false;

        this.debug_color = "%FKL";
        this.log_color   = "%FG";
        this.info_color  = "%FC";
        this.warn_color  = "%FY";
        this.error_color = "%FR";
        this.time_color  = "%FK";
        this.name_color  = "%FKL";
        this._level      = LOG_LEVELS.debug;
        this._maxSize    = 0; // bytes; 0 = disabled

        this._stream = null;
        this._initStream();

        if (args) {
            if (args.debug_color && style[args.debug_color]) this.debug_color = args.debug_color;
            if (args.log_color   && style[args.log_color])   this.log_color   = args.log_color;
            if (args.info_color  && style[args.info_color])  this.info_color  = args.info_color;
            if (args.warn_color  && style[args.warn_color])  this.warn_color  = args.warn_color;
            if (args.error_color && style[args.error_color]) this.error_color = args.error_color;
            if (args.time_color  && style[args.time_color])  this.time_color  = args.time_color;
            if (args.name_color  && style[args.name_color])  this.name_color  = args.name_color;
            if (args.level !== undefined && LOG_LEVELS[args.level] !== undefined)
                this._level = LOG_LEVELS[args.level];
            if (args.maxSize && args.maxSize > 0)
                this._maxSize = args.maxSize * 1024 * 1024; // MB → bytes
            if (args.json === true)
                this.json = true;
        }
        
        // Save args for child logger creation
        this._argsRaw = args || {};
    }

    /** @private */
    _initStream() {
        if (!fs.existsSync('./logs')) fs.mkdirSync('./logs', { recursive: true });
        this._stream = fs.createWriteStream(`./logs/${this._currentFile}.log`, { flags: 'a' });
    }

    /**
     * Checks if the current log file has exceeded maxSize and rotates if so.
     * @private
     */
    _checkRotation() {
        if (this._maxSize === 0) return;
        try {
            const filePath = `./logs/${this._currentFile}.log`;
            if (!fs.existsSync(filePath)) return;
            const { size } = fs.statSync(filePath);
            if (size >= this._maxSize) {
                this._stream.end();
                this._rotationCount++;
                this._currentFile = `${this.file}-r${this._rotationCount}`;
                this._stream = fs.createWriteStream(
                    `./logs/${this._currentFile}.log`, { flags: 'a' }
                );
            }
        } catch (_) { /* ignore stat errors */ }
    }

    /**
     * Creates a child logger with a fixed name prefix, inheriting the parent's configuration.
     * @param {string} name 
     * @returns {Logger}
     */
    child(name) {
        const childArgs = { ...this._argsRaw };
        // We override the methods directly on the new instance to always inject the 'name'
        const childLogger = new Logger(this.file, this.logDateAndHours, childArgs);
        
        const attachName = (args) => {
            if (typeof args === 'string') return { content: args, name: name };
            if (typeof args === 'object' && args !== null) return { ...args, name: args.name || name };
            return { content: args, name: name };
        };

        childLogger.debug = (args) => _log("debug", attachName(args), childLogger);
        childLogger.log   = (args) => _log("log",   attachName(args), childLogger);
        childLogger.info  = (args) => _log("info",  attachName(args), childLogger);
        childLogger.warn  = (args) => _log("warn",  attachName(args), childLogger);
        childLogger.error = (args) => _log("error", attachName(args), childLogger);
        
        return childLogger;
    }

    // ─── Log methods ─────────────────────────────────────────────────────────

    /** @param {string|object} args */
    debug(args) { _log("debug", args, this); }
    /** @param {string|object} args */
    log(args)   { _log("log",   args, this); }
    /** @param {string|object} args */
    info(args)  { _log("info",  args, this); }
    /** @param {string|object} args */
    warn(args)  { _log("warn",  args, this); }
    /** @param {string|object} args */
    error(args) { _log("error", args, this); }

    /**
     * Logs the contents of an object using console.dir.
     * @param {*} message
     */
    dir(message) {
        if (!message || message.length === 0) throw new MessageEmptyError('Message must not be empty');
        console.dir(message);
    }

    /**
     * Logs a table using console.table.
     * @param {Array} table
     */
    table(table) {
        if (!table || table.length === 0) throw new EmptyArrayError('Table must not be empty');
        console.table(table);
    }

    /** @param {string} label */
    timerStart(label) { console.time(label); }
    /** @param {string} label */
    timerEnd(label)   { console.timeEnd(label); }

    // ─── Progress bar ─────────────────────────────────────────────────────────

    /**
     * Renders a progress bar in-place on the current terminal line.
     * Does NOT write to the log file.
     *
     * @param {string} label   - Label shown after the bar.
     * @param {number} percent - Progress value (0–100).
     * @param {number} [width=30] - Width of the bar in characters.
     *
     * @example
     * for (let i = 0; i <= 100; i += 10) {
     *   logger.progress('Loading', i);
     *   await sleep(100);
     * }
     */
    progress(label, percent, width = 30) {
        percent = Math.max(0, Math.min(100, percent));
        const filled  = Math.round(width * percent / 100);
        const empty   = width - filled;
        const bar     = '█'.repeat(filled) + '░'.repeat(empty);
        const pct     = percent.toFixed(1).padStart(5);
        const line    = `[${bar}] ${pct}% ${label}`;

        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(line);
        if (percent >= 100) process.stdout.write('\n');
    }

    // ─── Level control ────────────────────────────────────────────────────────

    /**
     * Sets the minimum log level.
     * @param {'debug'|'log'|'info'|'warn'|'error'} level
     */
    setLevel(level) {
        if (LOG_LEVELS[level] === undefined)
            throw new TypeError(`Invalid level: "${level}". Valid: ${Object.keys(LOG_LEVELS).join(', ')}`);
        this._level = LOG_LEVELS[level];
    }

    /** @returns {'debug'|'log'|'info'|'warn'|'error'} */
    getLevel() {
        return Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === this._level);
    }

    // ─── Color control ────────────────────────────────────────────────────────

    /**
     * @param {'debug'|'log'|'info'|'warn'|'error'|'time'|'name'} type
     * @param {string} color
     */
    setColor(type, color) {
        if (!type || !color)            throw new TypeError("Type or color is not defined");
        if (!this[`${type}_color`])     throw new TypeError("Type is not valid");
        if (!style[color])              throw new TypeError("Color is not valid");
        this[`${type}_color`] = color;
    }

    /** @param {'debug'|'log'|'info'|'warn'|'error'|'time'|'name'} type */
    getColor(type) {
        if (!type)                  throw new TypeError("Type is not defined");
        if (!this[`${type}_color`]) throw new TypeError("Type is not valid");
        return this[`${type}_color`];
    }

    /**
     * Closes the write stream gracefully.
     */
    close() {
        if (this._stream) this._stream.end();
    }
}

module.exports = Logger;

// ─── Private helpers ──────────────────────────────────────────────────────────

const _writeLog = (message, info) => {
    if (!info._stream || info._stream.destroyed) return;
    info._checkRotation();
    info._stream.write(`${_unFormat(message)}\n`);
};

const _log = (type, args, info) => {
    if (!args || args.length === 0) throw new MessageEmptyError("Message must not be empty");
    if (LOG_LEVELS[type] < info._level) return;

    const typeColor  = style[info[`${type}_color`]];
    const reset      = style["%FRS"];
    const ts         = convertMSToHoursAndMinutes(new Date(), info.logDateAndHours);
    const startPart  = `[${style[info.time_color]}${ts}${reset}]`;

    const middlePart = args.name
        ? `[${style[info.name_color]}${args.name}${reset}/${typeColor}${type.toUpperCase()}${reset}]`
        : `[${typeColor}${type.toUpperCase()}${reset}]`;

    const content  = args.content !== undefined ? args.content : args;
    const endPart  = _format(`${typeColor}${content}${reset}`);
    const full     = `${startPart} ${middlePart} ${endPart}`;

    if (info.json) {
        // Build JSON object
        const jsonObj = {
            time: new Date().toISOString(),
            level: type,
            name: args.name || null,
            message: _unFormat(content)
        };
        const jsonStr = JSON.stringify(jsonObj);
        if (args.console === undefined || args.console) console.log(jsonStr);
        if (args.log === undefined || args.log)         _writeLog(jsonStr, info);
    } else {
        // Plain text
        if (args.console === undefined || args.console) console.log(full);
        if (args.log === undefined || args.log)         _writeLog(full, info);
    }
};

function _format(message) {
    for (const [key, value] of Object.entries(style)) {
        const tag = `{${key}}`;
        while (message.includes(tag)) message = message.replace(tag, value);
    }
    return message;
}

function _unFormat(message) {
    return message.replace(/\x1b\[[0-9;]*m/g, '');
}

// ─── Style map ────────────────────────────────────────────────────────────────

const style = {
    "%FRS":            "\x1b[0m",
    "%FBold":          "\x1b[1m",
    "%FUnderline":     "\x1b[4m",
    "%FInverse":       "\x1b[7m",
    "%FHidden":        "\x1b[8m",
    "%FStrikethrough": "\x1b[9m",

    "%FK":  "\x1b[30m", "%FR":  "\x1b[31m", "%FG":  "\x1b[32m", "%FY":  "\x1b[33m",
    "%FB":  "\x1b[34m", "%FM":  "\x1b[35m", "%FC":  "\x1b[36m", "%FW":  "\x1b[37m",

    "%FKL": "\x1b[90m", "%FRL": "\x1b[91m", "%FGL": "\x1b[92m", "%FYL": "\x1b[93m",
    "%FBL": "\x1b[94m", "%FML": "\x1b[95m", "%FCL": "\x1b[96m", "%FWL": "\x1b[97m",

    "%BK":  "\x1b[40m", "%BR":  "\x1b[41m", "%BG":  "\x1b[42m", "%BY":  "\x1b[43m",
    "%BB":  "\x1b[44m", "%BM":  "\x1b[45m", "%BC":  "\x1b[46m", "%BW":  "\x1b[47m",

    "%BKL": "\x1b[100m", "%BRL": "\x1b[101m", "%BGL": "\x1b[102m", "%BYL": "\x1b[103m",
    "%BBL": "\x1b[104m", "%BML": "\x1b[105m", "%BCL": "\x1b[106m", "%BWL": "\x1b[107m",
};