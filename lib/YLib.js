"use strict";

const utils = require("./utils");
const Logger = require("./logger/functionLogger");


/**
 * Create a new logger
 */
function createLogger(){
    let logger = []
    logger.log = Logger.log;
    logger.error = Logger.error;
    logger.warn = Logger.warn;
    logger.info = Logger.info;
    logger.dir = Logger.dir;
    logger.timerStart = Logger.timerStart;
    logger.timerEnd = Logger.timerEnd;
    logger.table = Logger.table;
   return logger
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