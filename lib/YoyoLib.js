"use strict";

const utils = require("./utils/");
const Logger = require("./logger/LoggerV3");
const LangManager= require("./LangManager/LangManager")

/**
 * Creates a Logger instance with optional configurations.
 *
 * @param {boolean} logday - If true, creates a log file for the day.
 * @param {boolean} date - If true, logs both date and hours; otherwise, only logs hours.
 * @param {object} args - Additional configuration options for the Logger.
 * @returns {Logger} A Logger instance.
 */
function createLogger(logday = false, date = false, args = undefined) {
    if (logday) return new Logger(utils.createFileForDay(), date, args)
    else return new Logger(utils.createFile(), date, args)
}

/**
 * Creates a new instance of a multi-language support handler.
 *
 * @returns {LangManager } A multi-language support handler instance.
 */
function createLangManger() {
    return new LangManager ()
}

module.exports = {
    createLogger,
    createLangManger
}