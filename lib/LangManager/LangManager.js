'use strict'

const path = require('path');
const fs = require('fs');
const { LangNameError, LangFileError, EmptyArrayError, MessageEmptyError, FileNotFoundError, DirNotFoundError } = require('../error/indexError')

class langManager {
    constructor() {
        if(!fs.existsSync(path.resolve(`${process.cwd()}${path.sep}langs`))) throw new DirNotFoundError(`Directory langs not found on ${process.cwd()}`)
        this.language = [];
        this.languageFile = [];
    }

    /**
     * Adds a language to the multi-language support.
     *
     * @param {string} lang - Name of the language.
     * @param {string} langFile - Name of the language file (without extension).
     * @returns {string} - Success message.
     * @throws {LangNameError} - If no language is defined.
     * @throws {LangFileError} - If no language file is defined or if the file is not found.
     * @throws {FileNotFoundError} - If the specified language file is not found.
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
     * Displays the list of defined languages.
     *
     * @returns {Array} - List of defined languages.
     * @throws {EmptyArrayError} - If no languages are defined.
     */
    show() {
        if (this.language.length == 0) throw new EmptyArrayError(`There are no lang defined`);
        return this.language;
    }

    /**
     * Sets an active language.
     *
     * @param {string} lang - Name of the language to set as active.
     * @throws {LangNameError} - If the specified language is not defined.
     */
    set(lang) {
        if (!this.language.includes(lang)) throw new LangNameError(`${lang} is not defined`);
        this.languageActive = lang;
    }

    /**
     * Uses the multi-language system to retrieve a message.
     *
     * @param {string} message - The message key defined in the language file.
     * @param {Object} args - Variables to be interpolated into the message.
     * @returns {string} - The formatted message.
     * @throws {MessageEmptyError} - If the message is empty or not defined.
     */
    use(message, args) {
        if (!message || message.length == 0) throw new MessageEmptyError('Message is not be empty')
        let index = this.language.indexOf(this.languageActive);
        let file = this.languageFile[index];
        file = require(path.resolve(`${process.cwd()}${path.sep}langs`, file));
        const messageSep = message.split('.');
        let messageReturn = file;
        for (const key of messageSep) {
            messageReturn = messageReturn[key];
            if (!messageReturn) throw new MessageEmptyError('Message is not be empty')
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

module.exports = langManager;