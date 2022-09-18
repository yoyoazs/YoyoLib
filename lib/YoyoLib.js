"use strict";

const utils = require("./utils");
const Logger = require("./logger/LoggerV2");
const Language = require("./multiLang/multiLang")

function createLogger(logday = false, date = false) {
    if (logday) return new Logger(utils.createFileForDay(), date)
    else return new Logger(utils.createFile(), date)
}

function createMultiLang() {
    return new Language()
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
    createMultiLang
}