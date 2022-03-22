"use strict";

const utils = require("./utils");
const Logger = require("./logger/LoggerV2");
const Language = require("yoyolib/lib/multiLang/multiLang")

function createLogger(){
    return new Logger(utils.createFile())
}

function createMultiLang(){
    return new Language()
}

function convertMSToHoursAndMinutes(date){
    utils.convertMSToHoursAndMinutes(date);
}

function convertDateForFile(date){
    utils.convertDateForFile(date);
}

module.exports = {
    createLogger,
    convertMSToHoursAndMinutes,
    convertDateForFile,
    createMultiLang
}