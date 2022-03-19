"use strict";

const utils = require("./utils");
const Logger = require("./logger/Logger");

function createLogger(file){
   return new Logger(file);
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