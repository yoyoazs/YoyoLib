const {convertMSToHoursAndMinutes} = require('../utils')
const fs = require('fs')

exports.log = async function (args, fileName) {
    var date = convertMSToHoursAndMinutes(new Date());
    if (typeof args == "object") {
        if (args.date === undefined || args.date == true)
            args.content = `${style.FW}[${date}/${style.FG}LOG${style.FW}]${style.FG} ${args.content}`;
        if (args.content.includes("%"))
            args.content = await formatMessage(args.content);
        if (args.console === undefined || args.console == true)
            console.log(args.content);
        if (args.log === undefined || args.log == true)
            writeLog(args.content, fileName);
    } else {
        args = `${style.FW}[${date}/${style.FG}LOG${style.FW}]${style.FG} ${args}`;
        console.log(args);
        writeLog(args, fileName);
    }
},

exports.info = async function (args, fileName) {
    var date = convertMSToHoursAndMinutes(new Date());
    if (typeof args == "object") {
        if (args.date === undefined || args.date == true)
            args.content = `${style.FW}[${date}/${style.FC}INFO${style.FW}]${style.FC} ${args.content}`;
        if (args.content.includes("%"))
            args.content = await formatMessage(args.content);
        if (args.console === undefined || args.console == true)
            console.info(args.content);
        if (args.log === undefined || args.log == true)
            writeLog(args.content, fileName);
    } else {
        args = `${style.FW}[${date}/${style.FC}INFO${style.FW}]${style.UR} ${args}`;
        console.info(args);
        writeLog(args, fileName);
    }
},

exports.warn = async function (args, fileName) {
    var date = convertMSToHoursAndMinutes(new Date());
    if (typeof args == "object") {
        if (args.date === undefined || args.date == true)
            args.content = `${style.FW}[${date}/${style.FY}WARN${style.FW}]${style.FY} ${args.content}`;
        if (args.content.includes("%"))
            args.content = await formatMessage(args.content);
        if (args.console === undefined || args.console == true)
            console.warn(args.content);
        if (args.log === undefined || args.log == true)
            writeLog(args.content, fileName);
    } else {
        args = `${style.FW}[${date}/${style.FY}WARN${style.FW}]${style.FY} ${args}`;
        console.warn(args);
        writeLog(args, fileName);
    }
},

exports.error = async function (args, fileName) {
    var date = convertMSToHoursAndMinutes(new Date());
    if (typeof args == "object") {
        if (args.date === undefined || args.date == true)
            args.content = `${style.FW}[${date}/${style.FR}ERROR${style.FW}]${style.FR} ${args.content}`;
        if (args.content.includes("%"))
            args.content = await formatMessage(args.content);
        if (args.console === undefined || args.console == true)
            console.error(args.content);
        if (args.log === undefined || args.log == true)
            writeLog(args.content, fileName);
    } else {
        args = `${style.FW}[${date}/${style.FR}ERROR${style.FW}]${style.FR} ${args}`;
        console.error(args);
        writeLog(args, fileName);
    }
}


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
    while (message.includes("%")) {
        valide = false;
        for (var i in Object.keys(style)) {
            message = message.replace(`%${Object.keys(style)[i]}`, `${Object.values(style)[i]}`);
            valide = true;
        }
        if (valide == false) message.replace("%", "");
    }
    return message;
}


const style = {

    //Util
    "UR": "\x1b[0m",
    //Font
    "FB": "\x1b[30m",
    "FR": "\x1b[31m",
    "FG": "\x1b[32m",
    "FY": "\x1b[33m",
    "FB": "\x1b[34m",
    "FM": "\x1b[35m",
    "FC": "\x1b[36m",
    "FW": "\x1b[37m",
    //Background
    "BR": "\x1b[41m",
    "BG": "\x1b[42m",
    "BY": "\x1b[43m",
    "BB": "\x1b[44m",
    "BM": "\x1b[45m",
    "BC": "\x1b[46m",
    "BW": "\x1b[47m",
}
