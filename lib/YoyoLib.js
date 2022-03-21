"use strict";

const utils = require("./utils");
const Logger = require("./logger/functionLogger");
const Language = require("yoyolib/lib/multiLang/multiLang")

function createLogger(){
    let logger = []
    logger.log = Logger.log;
    logger.info = Logger.info;
    logger.warn = Logger.warn;
    logger.error = Logger.error;
    logger.dir = Logger.dir;
    logger.timerStart = Logger.timerStart;
    logger.timerEnd = Logger.timerEnd;
    logger.table = Logger.table;
   return logger;
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

function createFile(){
    utils.createFile();
}



module.exports = {
    createFile,
    createLogger,
    convertMSToHoursAndMinutes,
    convertDateForFile,
    createMultiLang
}