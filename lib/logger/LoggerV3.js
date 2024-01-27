"use strict";

const { convertMSToHoursAndMinutes } = require('../utils');
const fs = require('fs');
const { MessageEmptyError, EmptyArrayError } = require('../error/indexError');

class logger {
    constructor(file, logDateAndHours, args = undefined) {
        this.file = file;
        this.logDateAndHours = logDateAndHours;
        this.log_color = "%FG";
        this.info_color = "%FC";
        this.warn_color = "%FY";
        this.error_color = "%FR";
        this.time_color = "%FK";
        this.name_color = "%FKL";
        if (args) {
            if (args.log_color && style[args.log_color]) this.log_color = args.log_color;
            if (args.info_color && style[args.info_color]) this.info_color = args.info_color;
            if (args.warn_color && style[args.warn_color]) this.warn_color = args.warn_color;
            if (args.error_color && style[args.error_color]) this.error_color = args.error_color;
            if (args.time_color && style[args.time_color]) this.time_color = args.time_color;
            if (args.name_color && style[args.name_color]) this.name_color = args.name_color;
        }
    }

    /**
     * Logs a message with the type "log".
     *
     * @param {Object} args - The arguments to be logged.
     *                        May include properties such as 'name', 'content', etc.
     * @throws {MessageEmptyError} Thrown if the message is empty or undefined.
     */
    log(args) {
        log("log", args, this);
    }

    /**
     * Logs an informational message.
     *
     * @param {Object} args - The arguments to be logged.
     *                        May include properties such as 'name', 'content', etc.
     * @throws {MessageEmptyError} Thrown if the message is empty or undefined.
     */
    info(args) {
        log("info", args, this);
    }

    /**
     * Logs a warning message.
     *
     * @param {Object} args - The arguments to be logged.
     *                        May include properties such as 'name', 'content', etc.
     * @throws {MessageEmptyError} Thrown if the message is empty or undefined.
     */
    warn(args) {
        log("warn", args, this);
    }

    /**
     * Logs an error message.
     *
     * @param {Object} args - The arguments to be logged.
     *                        May include properties such as 'name', 'content', etc.
     * @throws {MessageEmptyError} Thrown if the message is empty or undefined.
     */
    error(args) {
        log("error", args, this);
    }

    /**
     * Logs the contents of an object using console.dir.
     *
     * @param {any} message - The object to be logged.
     * @throws {MessageEmptyError} Thrown if the message is empty or undefined.
     */
    dir(message) {
        if (!message || message.length === 0) throw new MessageEmptyError('Message is not be empty');
        console.dir(message);
    }

    /**
     * Starts a timer using console.time.
     *
     * @param {string} label - The label for the timer.
     */
    timerStart(label) {
        console.time(label)
    }

    /**
     * Ends a timer using console.timeEnd.
     *
     * @param {string} label - The label for the timer to be stopped.
     */
    timerEnd(label) {
        console.timeEnd(label)
    }

    /**
     * Logs a table using console.table.
     *
     * @param {Table} table - The table to be logged.
     * @throws {EmptyArrayError} Thrown if the table is empty or undefined.
     */
    table(table) {
        if (!table || table.length === 0) throw new EmptyArrayError('Table is not be empty');
        console.table(table)
    }

    /**
     * Sets the color for a specified log type.
     *
     * @param {string} type - The log type (e.g., 'log', 'info', 'warn', 'error').
     * @param {string} color - The color code to set for the specified log type.
     * @throws {TypeError} If the specified type or color is not defined, if the type is not valid, or if the color is not valid.
     */
    setColor(type, color) {
        if (!type || !color) throw new TypeError("Type or color is not defined");
        if (!this[`${type}_color`]) throw new TypeError("Type is not valid");
        if (!style[color]) throw new TypeError("Color is not valid");
        this[`${type}_color`] = color;
    }

    /**
     * Retrieves the color associated with a specified log type.
     *
     * @param {string} type - The log type (e.g., 'log', 'info', 'warn', 'error').
     * @returns {string} - The color code associated with the specified log type.
     * @throws {TypeError} If the specified type is not defined or if the color for the type is not set.
     */
    getColor(type) {
        if (!type) throw new TypeError("Type is not defined");
        if (!this[`${type}_color`]) throw new TypeError("Type is not valid");
        return this[`${type}_color`];
    }
}

module.exports = logger;

/**
 * Writes a log message to a specified log file.
 *
 * @param {string} message - The log message to be written.
 * @param {string} file - The name of the log file.
 * @throws {Error} - If the specified log file does not exist.
 */
const writeLog = (message, file) => {
    if (!fs.existsSync(`./logs/${file}.log`)) throw new Error("File not exist");
    fs.appendFile(`./logs/${file}.log`, `${unFormatMessage(message)}\n`, function (err) {
        if (err) throw err;
    });
}

/**
 * Logs a message with specified type and formatting.
 *
 * @param {string} type - The log type (e.g., 'log', 'info', 'warn', 'error').
 * @param {Object} args - The log arguments.
 * @param {Object} info - Additional log information.
 * @throws {MessageEmptyError} - If the log message is empty.
 */
const log = (type, args, info) => {
    if(!args || args.length === 0) throw new MessageEmptyError("Message not be empty");
    const typeColor = style[info[`${type}_color`]];
    const resetColor = style["%FRS"];
    const formatStartMessage = `[${style[info.time_color]}${convertMSToHoursAndMinutes(new Date(), info.logDateAndHours)}${resetColor}]`;
    let formatMiddleMessage;
    if (args.name) {
        formatMiddleMessage = `[${style[info.name_color]}${args.name}${resetColor}/` +
            `${typeColor}${type.toUpperCase()}${resetColor}]`;
    } else
        formatMiddleMessage = `[${typeColor}${type.toUpperCase()}${resetColor}]`;
    const formatEndMessage = formatMessage(`${typeColor}${args.content ? args.content : args}${resetColor}`);
    if (args.console === undefined || args.console) console.log(`${formatStartMessage} ${formatMiddleMessage} ${formatEndMessage}`);
    if (args.log === undefined || args.log) writeLog(`${formatStartMessage} ${formatMiddleMessage} ${formatEndMessage}`, info.file);
}

/**
 * Formats a message based on the specified style tags.
 *
 * @param {string} message - The message to be formatted.
 * @returns {string} - The formatted message.
 */
function formatMessage(message) {
    for (const key of Object.keys(style)) {
        const value = style[key];
        const tag = `{${key}}`;
        while (message.includes(tag)) {
            message = message.replace(tag, value);
        }
    }
    return message;
}

/**
 * Removes ANSI escape codes from a formatted message.
 *
 * @param {string} message - The formatted message with ANSI escape codes.
 * @returns {string} - The unformatted message.
 */
function unFormatMessage(message) {
    while (message.includes("\x1b")) {
        for (var i in Object.keys(style)) {
            message = message.replace(`${Object.values(style)[i]}`, ``);
        }
    }
    return message;
}

/**
 * Style definitions for ANSI escape codes.
 */

const style = {
    "%FRS": "\x1b[0m",
    "%FBold": "\x1b[1m",
    "%FUnderline": "\x1b[4m",
    "%FInverse": "\x1b[7m",
    "%FHidden": "\x1b[8m",
    "%FStrikethrough": "\x1b[9m",

    "%FK": "\x1b[30m",
    "%FR": "\x1b[31m",
    "%FG": "\x1b[32m",
    "%FY": "\x1b[33m",
    "%FB": "\x1b[34m",
    "%FM": "\x1b[35m",
    "%FC": "\x1b[36m",
    "%FW": "\x1b[37m",

    "%FKL": "\x1b[90m",
    "%FRL": "\x1b[91m",
    "%FGL": "\x1b[92m",
    "%FYL": "\x1b[93m",
    "%FBL": "\x1b[94m",
    "%FML": "\x1b[95m",
    "%FCL": "\x1b[96m",
    "%FWL": "\x1b[97m",

    "%BK": "\x1b[40m",
    "%BR": "\x1b[41m",
    "%BG": "\x1b[42m",
    "%BY": "\x1b[43m",
    "%BB": "\x1b[44m",
    "%BM": "\x1b[45m",
    "%BC": "\x1b[46m",
    "%BW": "\x1b[47m",

    "%BKL": "\x1b[100m",
    "%BRL": "\x1b[101m",
    "%BGL": "\x1b[102m",
    "%BYL": "\x1b[103m",
    "%BBL": "\x1b[104m",
    "%BML": "\x1b[105m",
    "%BCL": "\x1b[106m",
    "%BWL": "\x1b[107m",
}