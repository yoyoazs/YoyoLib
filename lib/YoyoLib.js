"use strict";

const utils = require("./utils/");
const Logger = require("./logger/LoggerV2");
const Language = require("./multiLang/multiLang")

/**
 * createLogger
 * @param { Boolean } logday if true create a file for day
 * @param { Boolean } date if true log date and hours or only hours
 * @returns { Logger }
 */
function createLogger(logday = false, date = false) {
    if (logday) return new Logger(utils.createFileForDay(), date)
    else return new Logger(utils.createFile(), date)
}

/**
 * createMultiLang
 * @returns {multiLang}
 */
function createMultiLang() {
    return new Language()
}

module.exports = {
    createLogger,
    createMultiLang
}