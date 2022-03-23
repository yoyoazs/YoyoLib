'use strict'

const path = require('path');
const fs = require('fs');
const { LangNameError, LangFileError, EmptyArrayError, MessageEmptyError, FileNotFoundError, DirNotFoundError } = require('../error/indexError')

class multiLang {
    constructor() {
        if(!fs.existsSync(path.resolve(`${process.cwd()}${path.sep}langs`))) throw new DirNotFoundError(`Directory langs not found on ${process.cwd()}`)
        this.language = [];
        this.languageFile = [];
        this.lanuageActive = null;
    }

    /**
 * add a lang of the multiLang
 * @param { String } lang name of the lang
 * @param { String } fileLang name of the lang file
 */
    add(lang, langFile) {
        if (!lang) throw new LangNameError('no lang defined');
        if (!langFile) throw new LangFileError('no lang file defined');
        if(!fs.existsSync(path.resolve(`${process.cwd()}${path.sep}langs`, langFile+'.json'))) throw new FileNotFoundError(`${langFile}.json not found on ${process.cwd()}${path.sep}langs`);
        if (this.language.includes(lang)) throw new LangNameError(`${lang} already defined`);
        if (this.languageFile.includes(langFile)) throw new LangFileError(`${langFile} already defined`);
        this.language.push(lang);
        this.languageFile.push(langFile);
        return "Language sets";
    }

    /**
* show the list of lang 
*/
    show() {
        if (this.language.length == 0) throw new EmptyArrayError(`There are no lang defined`);
        return this.language;
    }

    /**
 * set a active lang
 * @param { String } lang name of the lang
 */
    set(lang) {
        if (!this.language.includes(lang)) throw new LangNameError(`${lang} is not defined`);
        this.languageActive = lang;
    }

    /**
* use a multilang système
* @param { String } message the message defined in the language file
* @param { object } args all variables to pass to message
*/
    use(message, args) {
        if (!message || message.length == 0) throw new MessageEmptyError('Message is not be empty')
        let index = this.language.indexOf(this.languageActive);
        let file = this.languageFile[index];
        file = require(path.resolve(`${process.cwd()}${path.sep}langs`, file));
        message = message.split('.');
        let messageReturn = null;
        switch (message.length) {
            case 1:
                messageReturn = file[message[0]];
                break;
            case 2:
                messageReturn = file[message[0]][message[1]];
                break;
            case 3:
                messageReturn = file[message[0]][message[1]][message[2]];
                break;
            case 4:
                messageReturn = file[message[0]][message[1]][message[2]][message[3]];
                break;
            case 5:
                messageReturn = file[message[0]][message[1]][message[2]][message[3]][message[4]];
                break;
            case 6:
                messageReturn = file[message[0]][message[1]][message[2]][message[3]][message[4]][message[5]];
                break;
            case 7:
                messageReturn = file[message[0]][message[1]][message[2]][message[3]][message[4]][message[5]][message[6]];
                break;
            case 8:
                messageReturn = file[message[0]][message[1]][message[2]][message[3]][message[4]][message[5]][message[6]][message[7]];
                break;
            case 9:
                messageReturn = file[message[0]][message[1]][message[2]][message[3]][message[4]][message[5]][message[6]][message[7]][message[8]];
                break;
            case 10:
                messageReturn = file[message[0]][message[1]][message[2]][message[3]][message[4]][message[5]][message[6]][message[7]][message[8]][message[9]];
                break;
            case 11:
                messageReturn = file[message[0]][message[1]][message[2]][message[3]][message[4]][message[5]][message[6]][message[7]][message[8]][message[9]][message[10]];
                break;
            case 12:
                messageReturn = file[message[0]][message[1]][message[2]][message[3]][message[4]][message[5]][message[6]][message[7]][message[8]][message[9]][message[10]][message[11]];
                break;
            case 13:
                messageReturn = file[message[0]][message[1]][message[2]][message[3]][message[4]][message[5]][message[6]][message[7]][message[8]][message[9]][message[10]][message[11]][message[12]];
                break;
            case 14:
                messageReturn = file[message[0]][message[1]][message[2]][message[3]][message[4]][message[5]][message[6]][message[7]][message[8]][message[9]][message[10]][message[11]][message[12]][message[13]];
                break;
            case 15:
                messageReturn = file[message[0]][message[1]][message[2]][message[3]][message[4]][message[5]][message[6]][message[7]][message[8]][message[9]][message[10]][message[11]][message[12]][message[13]][message[14]];
                break;
        }
        if (!messageReturn || messageReturn.length == 0) throw new MessageEmptyError('Message is not be empty')
        if (!args) return messageReturn;
        let argsKey = Object.keys(args);
        for (let i in argsKey) {
            messageReturn = messageReturn.replace(`{${argsKey[i]}}`, `${args[argsKey[i]]}`);
        }
        return messageReturn;


    }

}

module.exports = multiLang;