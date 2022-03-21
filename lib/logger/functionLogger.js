'use strict';

const fs = require('fs');
const { convertDateForFile } = require('../utils')
const logger = require('./Logger')
const fileName = createFile()

function log(args) {
    logger.log(args, fileName);
};

function info(args) {
    logger.info(args, fileName);
};

function error(args) {
    logger.error(args, fileName);
};

function warn(args) {
    logger.warn(args, fileName);
};

function dir(message) {
    console.dir(message);
};

function timerStart(label) {
    console.time(label);
};

function timerEnd(label) {
    console.timeEnd(label);
};

function table(table) {
    console.table(table);
};



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
    let result = fs.readdirSync("./logs");
    result = result.filter(file => file.includes(name))
    name = `${name}-${result.length + 1}`
    fs.open(`./logs/${name}.log`, 'a', function (err, file) {
        if (err) throw err;
    });
    return name;
}
