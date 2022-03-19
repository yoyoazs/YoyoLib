'use strict';

function convertMSToHoursAndMinutes(date) {
    var newDate = [date.getHours(), date.getMinutes(), date.getSeconds()];
    if (newDate[0].toString().length == 1) newDate[0] = `0${newDate[0]}`;
    if (newDate[1].toString().length == 1) newDate[1] = `0${newDate[1]}`;
    if (newDate[2].toString().length == 1) newDate[2] = `0${newDate[2]}`;
    var newDate2 = `${newDate[0]}:${newDate[1]}:${newDate[2]}`;
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

module.exports = {
    convertDateForFile,
    convertMSToHoursAndMinutes
}