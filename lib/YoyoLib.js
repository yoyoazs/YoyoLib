"use strict";

const utils = require("./utils");
const Logger = require("./logger/Logger");

function createLogger(file){
    let logger = []
    logger.log = Logger.log();
    logger.info = Logger.info();
    logger.warn = Logger.warn();
    logger.error = Logger.error();
    logger.dir = Logger.dir();
    logger.timerStart = Logger.timerStart();
    logger.timerEnd = Logger.timerEnd();
    logger.table = Logger.table();
   return logger;
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
}