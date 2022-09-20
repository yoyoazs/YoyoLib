'use strict';
const fs = require('fs');

function convertMSToHoursAndMinutes(date, logDateAndHours) {
    var newDate;
    var newDate2;
    if (logDateAndHours) newDate = [date.getDate(), date.getMonth() + 1, date.getHours(), date.getMinutes(), date.getSeconds()];
    else newDate = [date.getHours(), date.getMinutes(), date.getSeconds()];

    if (newDate[0].toString().length == 1) newDate[0] = `0${newDate[0]}`;
    if (newDate[1].toString().length == 1) newDate[1] = `0${newDate[1]}`;
    if (newDate[2].toString().length == 1) newDate[2] = `0${newDate[2]}`;
    if (logDateAndHours) {
        if (newDate[3].toString().length == 1) newDate[3] = `0${newDate[3]}`;
        if (newDate[4].toString().length == 1) newDate[4] = `0${newDate[4]}`;
        newDate2 = `${newDate[0]}/${newDate[1]} ${newDate[2]}:${newDate[3]}:${newDate[4]}`;
    } else {
        newDate2 = `${newDate[0]}:${newDate[1]}:${newDate[2]}`;
    }
    return newDate2;
}

function convertDateForFile(date) {
    var newDate = [date.getDate(), (date.getMonth() + 1), date.getFullYear()];
    if (parseInt(newDate[0]) < 10) {
        newDate[0] = `0${newDate[0]}`
    }
    if (parseInt(newDate[1]) < 10) {
        newDate[1] = `0${newDate[1]}`
    }
    var newDate2 = `${newDate[2]}-${newDate[1]}-${newDate[0]}`
    return newDate2;
}

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

function createFileForDay() {
    var name = convertDateForFile(new Date());
    if (!fs.existsSync("./logs")) {
        fs.mkdirSync("./logs");
    }
    fs.open(`./logs/${name}.log`, 'a', function (err, file) {
        if (err) throw err;
    });
    return name;
}

module.exports = {
    convertDateForFile,
    convertMSToHoursAndMinutes,
    createFile,
    createFileForDay,
}