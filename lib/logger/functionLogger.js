'use strict';

const fs = require('fs');
const { convertDateForFile } = require('../utils')
const logger = require('./Logger')
const fileName = createFile()

/**
 * Create a new test
 */
function log(args) {
    logger.log(args, fileName)
}

function info(args) {
    logger.info(args, fileName)
}

function error(args) {
    logger.error(args, fileName)
}

function warn(args) {
    logger.warn(args, fileName)
}

function dir(message) {
    console.dir(message);
}
function timerStart(label) {
    console.time(label);
}
function timerEnd(label) {
    console.timeEnd(label);
}
function table(table) {
    console.table(table);
}



module.exports = {
    log,
    info,
    error,
    warn,
    dir,
    timerStart,
    timerEnd,
    table,
};


function createFile() {
    var name = convertDateForFile(new Date());
    if (!fs.existsSync("./logs")) {
        fs.mkdirSync("./logs");
    }
    fs.open(`./logs/${name}.log`, 'a', function (err, file) {
        if (err) throw err;
    });
    return name;
}