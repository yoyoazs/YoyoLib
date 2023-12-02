"use strict";

const utils = require("./utils/");
const Logger = require("./logger/LoggerV2");
const Profiler = require("./profiler/Profiler");
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

function createProfiler() {
    return new Profiler()
}

function convertMSToHoursAndMinutes(date) {
    utils.convertMSToHoursAndMinutes(date);
}

function convertDateForFile(date) {
    utils.convertDateForFile(date);
}

module.exports = {
    createLogger,
    convertMSToHoursAndMinutes,
    convertDateForFile,
    createProfiler,
    createMultiLang
}