'use strict';

const { convertMSToHoursAndMinutes } = require('../utils');
const fs = require('fs');
const {MessageEmptyError, EmptyArrayError} = require('../error/indexError');

class logger {
    constructor(file) {
        this.file = file;
    }

    async log(args) {
        if(!args || args.length == 0) throw new MessageEmptyError('Message is not be empty');
        var date = convertMSToHoursAndMinutes(new Date());
        if (typeof args == "object") {
            if (args.date === undefined || args.date == true)
                args.content = `${style["%FW"]}[${date}/${style["%FG"]}LOG${style["%FW"]}]${style["%FG"]} ${args.content}`;
            if (args.content.includes("%"))
                args.content = await formatMessage(args.content);
            if (args.console === undefined || args.console == true)
                console.log(args.content);
            if (args.log === undefined || args.log == true)
                writeLog(args.content, this.file);
        } else {
            args = `${style["%FW"]}[${date}/${style["%FG"]}LOG${style["%FW"]}]${style["%FG"]} ${args}`;
            console.log(args);
            writeLog(args, this.file);
        }
    }

    async info(args) {
        if(!args || args.length == 0) throw new MessageEmptyError('Message is not be empty');
        var date = convertMSToHoursAndMinutes(new Date());
        if (typeof args == "object") {
            if (args.date === undefined || args.date == true)
                args.content = `${style["%FW"]}[${date}/${style["%FC"]}INFO${style["%FW"]}]${style["%FC"]} ${args.content}`;
            if (args.content.includes("%"))
                args.content = await formatMessage(args.content);
            if (args.console === undefined || args.console == true)
                console.info(args.content);
            if (args.log === undefined || args.log == true)
                writeLog(args.content, this.file);
        } else {
            args = `${style["%FW"]}[${date}/${style["%FC"]}INFO${style["%FW"]}]${style["%UR"]} ${args}`;
            console.info(args);
            writeLog(args, this.file);
        }
    }

    async warn(args){
        if(!args || args.length == 0) throw new MessageEmptyError('Message is not be empty');
        var date = convertMSToHoursAndMinutes(new Date());
        if (typeof args == "object") {
            if (args.date === undefined || args.date == true)
                args.content = `${style["%FW"]}[${date}/${style["%FY"]}WARN${style["%FW"]}]${style["%FY"]} ${args.content}`;
            if (args.content.includes("%"))
                args.content = await formatMessage(args.content);
            if (args.console === undefined || args.console == true)
                console.warn(args.content);
            if (args.log === undefined || args.log == true)
                writeLog(args.content, this.file);
        } else {
            args = `${style["%FW"]}[${date}/${style["%FY"]}WARN${style["%FW"]}]${style["%FY"]} ${args}`;
            console.warn(args);
            writeLog(args, this.file);
        }
    }

    async error(args) {
        if(!args || args.length == 0) throw new MessageEmptyError('Message is not be empty');
        var date = convertMSToHoursAndMinutes(new Date());
        if (typeof args == "object") {
            if (args.date === undefined || args.date == true)
                args.content = `${style["%FW"]}[${date}/${style["%FR"]}ERROR${style["%FW"]}]${style["%FR"]} ${args.content}`;
            if (args.content.includes("%"))
                args.content = await formatMessage(args.content);
            if (args.console === undefined || args.console == true)
                console.error(args.content);
            if (args.log === undefined || args.log == true)
                writeLog(args.content, this.file);
        } else {
            args = `${style["%FW"]}[${date}/${style["%FR"]}ERROR${style["%FW"]}]${style["%FR"]} ${args}`;
            console.error(args);
            writeLog(args, this.file);
        }
    }

    dir(message){
        if(!message || message.length == 0) throw new MessageEmptyError('Message is not be empty');
        console.dir(message);
    }

    timerStart(label){
        console.time(label)
    }

    timerEnd(label){
        console.timeEnd(label)
    }

    table(table){
        if(!table || table.length == 0) throw new EmptyArrayError('Table is not be empty');
        console.table(table)
    }  
}

module.exports = logger;

async function writeLog(log, name) {
    log = await unFormatMessage(log)
    fs.appendFile(`./logs/${name}.log`, `${log}\n`, function (err) {
        if (err) throw err;
    });
}

function unFormatMessage(message) {
    while (message.includes("\x1b")) {
        for (var i in Object.keys(style)) {
            message = message.replace(`${Object.values(style)[i]}`, ``);
        }
    }
    return message;
}

function formatMessage(message) {
    for (let i in Object.keys(style)) {
        while (message.includes(Object.keys(style)[i])) {
            message = message.replace(`${Object.keys(style)[i]}`, `${Object.values(style)[i]}`);
        }
    }
    message = `${message}\x1b[0m"`;
    return message;
}


const style = {

    //Util
    "%UR": "\x1b[0m",
    //Font
    "%FB": "\x1b[30m",
    "%FR": "\x1b[31m",
    "%FG": "\x1b[32m",
    "%FY": "\x1b[33m",
    "%FB": "\x1b[34m",
    "%FM": "\x1b[35m",
    "%FC": "\x1b[36m",
    "%FW": "\x1b[37m",
    //Background
    "%BR": "\x1b[41m",
    "%BG": "\x1b[42m",
    "%BY": "\x1b[43m",
    "%BB": "\x1b[44m",
    "%BM": "\x1b[45m",
    "%BC": "\x1b[46m",
    "%BW": "\x1b[47m",
}
