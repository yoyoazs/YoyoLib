'use strict';

const { convertMSToHoursAndMinutes } = require('../utils');
const fs = require('fs');
const { MessageEmptyError, EmptyArrayError } = require('../error/indexError');

class logger {
    constructor(file, logDateAndHours) {
        this.file = file;
        this.logDateAndHours = logDateAndHours;
    }

    /**
     * use a logger système with log
     * @param { String || args} message|Args  for log a message
     * @return { String } message
     */
    log(args) {
        log("log", args, this.file, this.logDateAndHours);
    }

    /**
     * use a logger système with log
     * @param { String || args} message|Args  for log an info
     */
    info(args) {
        log("info", args, this.file, this.logDateAndHours);
    }

    /**
     * use a logger système with log
     * @param { String || args} message|Args  for log a warning
     */
    warn(args) {
        log("warn", args, this.file, this.logDateAndHours);
    }

    /**
     * use a logger système with log
     * @param { String || args} message|Args  for log a error
     */
    error(args) {
        log("error", args, this.file, this.logDateAndHours);
    }

    /**
     * use a logger système with log
     * @param { String } dir for log a dir
     */
    dir(message) {
        if (!message || message.length == 0) throw new MessageEmptyError('Message is not be empty');
        console.dir(message);
    }

    /**
     * use a logger système with log
     * @param { String } Label for start a timer
     */
    timerStart(label) {
        console.time(label)
    }

    /**
     * use a logger système with log
     * @param { String } Label for end a timer
     */
    timerEnd(label) {
        console.timeEnd(label)
    }

    /**
     * use a logger système with log
     * @param { Table } table for log a table
     */
    table(table) {
        if (!table || table.length == 0) throw new EmptyArrayError('Table is not be empty');
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

const log = async (method, args, file, logDateAndHours) => {
    if (!args || args.length == 0) throw new MessageEmptyError('Message is not be empty');
    var date = convertMSToHoursAndMinutes(new Date(), logDateAndHours);
    if (typeof args == "object") {
        if (args.date === undefined || args.date == true)
            if (args.name) {
                switch (method) {
                    case "log":
                        args.content = `${style["%FW"]}[${style["%FB"]}${date}${style["%FW"]}] [${args.name}/${style["%FG"]}LOG${style["%FW"]}]${style["%FG"]} ${args.content} ${style["%UR"]}`;
                        break;
                    case "info":
                        args.content = `${style["%FW"]}[${style["%FB"]}${date}${style["%FW"]}] [${args.name}/${style["%FC"]}INFO${style["%FW"]}]${style["%FC"]} ${args.content} ${style["%UR"]}`;
                        break;
                    case "warn":
                        args.content = `${style["%FW"]}[${style["%FB"]}${date}${style["%FW"]}] [${args.name}/${style["%FY"]}WARN${style["%FW"]}]${style["%FY"]} ${args.content} ${style["%UR"]}`;
                        break;
                    case "error":
                        args.content = `${style["%FW"]}[${style["%FB"]}${date}${style["%FW"]}] [${args.name}/${style["%FR"]}ERROR${style["%FW"]}]${style["%FR"]} ${args.content} ${style["%UR"]}`;
                        break;
                }
            } else {
                switch (method) {
                    case "log":
                        args.content = `${style["%FW"]}[${style["%FB"]}${date}${style["%FW"]}/${style["%FG"]}LOG${style["%FW"]}]${style["%FG"]} ${args.content} ${style["%UR"]}`;
                        break;
                    case "info":
                        args.content = `${style["%FW"]}[${style["%FB"]}${date}${style["%FW"]}/${style["%FC"]}INFO${style["%FW"]}]${style["%FC"]} ${args.content} ${style["%UR"]}`;
                        break;
                    case "warn":
                        args.content = `${style["%FW"]}[${style["%FB"]}${date}${style["%FW"]}/${style["%FY"]}WARN${style["%FW"]}]${style["%FY"]} ${args.content} ${style["%UR"]}`;
                        break;
                    case "error":
                        args.content = `${style["%FW"]}[${style["%FB"]}${date}${style["%FW"]}/${style["%FR"]}ERROR${style["%FW"]}]${style["%FR"]} ${args.content} ${style["%UR"]}`;
                        break;
                }
            }
        if (args.content.includes("%"))
            args.content = await formatMessage(args.content);
        if (args.console === undefined || args.console == true)
            console.log(args.content);
        if (args.log === undefined || args.log == true)
            writeLog(args.content, file);
    } else {
        switch (method) {
            case "log":
                args = `${style["%FW"]}[${style["%FB"]}${date}${style["%FW"]}/${style["%FG"]}LOG${style["%FW"]}]${style["%FG"]}: ${args} ${style["%UR"]}`;
                break;
            case "info":
                args = `${style["%FW"]}[${style["%FB"]}${date}${style["%FW"]}/${style["%FG"]}INFO${style["%FW"]}]${style["%FC"]}: ${args} ${style["%UR"]}`;
                break;
            case "warn":
                args = `${style["%FW"]}[${style["%FB"]}${date}${style["%FW"]}/${style["%FG"]}WARN${style["%FW"]}]${style["%FY"]}: ${args} ${style["%UR"]}`;
                break;
            case "error":
                args = `${style["%FW"]}[${style["%FB"]}${date}${style["%FW"]}/${style["%FG"]}ERROR${style["%FW"]}]${style["%FR"]}: ${args} ${style["%UR"]}`;
                break;
        }
        console.log(args);
        writeLog(args, file);
    }
}


const style = {

    //Util
    "%UR": "\x1b[0m",
    //Font
    "%FB": "\x1b[30m",
    "%FR": "\x1b[31m",
    "%FG": "\x1b[32m",
    "%FY": "\x1b[33m",
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
