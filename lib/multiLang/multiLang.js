'use strict';

const path = require('path');
const fs   = require('fs');
const { LangNameError, LangFileError, EmptyArrayError, MessageEmptyError, FileNotFoundError, DirNotFoundError } = require('../error/indexError');

class MultiLang {
    constructor() {
        if (!fs.existsSync(path.resolve(`${process.cwd()}${path.sep}langs`)))
            throw new DirNotFoundError(`Directory "langs" not found in ${process.cwd()}`);

        this.language       = [];
        this.languageFile   = [];
        this.languageActive = null;  // ← fix: was "lanuageActive" (typo)
        this._fallbackLang  = null;
    }

    /**
     * Adds a language to the multi-language handler.
     * @param {string} lang     - Language name (e.g. 'en').
     * @param {string} langFile - JSON file name without extension (e.g. 'en_EN').
     * @returns {string}
     * @throws {LangNameError}
     * @throws {LangFileError}
     * @throws {FileNotFoundError}
     */
    add(lang, langFile) {
        if (!lang)     throw new LangNameError('No language name provided');
        if (!langFile) throw new LangFileError('No language file name provided');
        if (!fs.existsSync(path.resolve(`${process.cwd()}${path.sep}langs`, `${langFile}.json`)))
            throw new FileNotFoundError(`${langFile}.json not found in ${process.cwd()}${path.sep}langs`);
        if (this.language.includes(lang))         throw new LangNameError(`Language "${lang}" is already registered`);
        if (this.languageFile.includes(langFile)) throw new LangFileError(`File "${langFile}" is already registered`);

        this.language.push(lang);
        this.languageFile.push(langFile);
        return 'Language added';
    }

    /**
     * Returns the list of registered languages.
     * @returns {string[]}
     * @throws {EmptyArrayError}
     */
    show() {
        if (this.language.length === 0) throw new EmptyArrayError('No languages have been registered');
        return this.language;
    }

    /**
     * Sets the active language.
     * @param {string} lang
     * @throws {LangNameError}
     */
    set(lang) {
        if (!this.language.includes(lang)) throw new LangNameError(`Language "${lang}" is not registered`);
        this.languageActive = lang;
    }

    /**
     * Returns the currently active language name.
     * @returns {string|null}
     */
    getActive() {
        return this.languageActive;
    }

    /**
     * Sets a fallback language used when a key is missing in the active language.
     * @param {string} lang
     * @throws {LangNameError}
     */
    setFallback(lang) {
        if (!this.language.includes(lang)) throw new LangNameError(`Language "${lang}" is not registered`);
        this._fallbackLang = lang;
    }

    /**
     * Resolves a dot-notation key from a parsed JSON object.
     * Returns undefined if the key is not found.
     * @private
     */
    _resolve(fileObj, messageSep) {
        let result = fileObj;
        for (const key of messageSep) {
            if (result === undefined || result === null) return undefined;
            result = result[key];
        }
        return result;
    }

    /**
     * Reads and parses a language JSON file (no Node.js require cache).
     * @private
     */
    _readFile(langName) {
        const idx      = this.language.indexOf(langName);
        const fileName = this.languageFile[idx];
        const filePath = path.resolve(`${process.cwd()}${path.sep}langs`, `${fileName}.json`);
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    /**
     * Reloads all language files from disk (clears any in-memory cache).
     * Since we no longer use require(), this is a no-op that confirms the
     * next .use() call will re-read from disk.
     * @returns {string}
     * @throws {EmptyArrayError}
     */
    reload() {
        if (this.language.length === 0) throw new EmptyArrayError('No languages to reload');
        // Verify all files still exist on disk
        for (let i = 0; i < this.language.length; i++) {
            const filePath = path.resolve(`${process.cwd()}${path.sep}langs`, `${this.languageFile[i]}.json`);
            if (!fs.existsSync(filePath))
                throw new FileNotFoundError(`${this.languageFile[i]}.json not found during reload`);
        }
        return 'Languages reloaded';
    }

    /**
     * Retrieves a translated string by dot-notation key.
     * Falls back to the fallback language if the key is missing.
     * @param {string} message - Dot-notation key (e.g. 'errors.notFound').
     * @param {Object} [args]  - Interpolation variables.
     * @returns {string}
     * @throws {MessageEmptyError}
     */
    use(message, args) {
        if (!message || message.length === 0) throw new MessageEmptyError('Message key must not be empty');

        const messageSep = message.split('.');
        let messageReturn;

        // Try active language
        const activeFile = this._readFile(this.languageActive);
        messageReturn = this._resolve(activeFile, messageSep);

        // Fallback if key not found
        if ((messageReturn === undefined || messageReturn === null) && this._fallbackLang) {
            const fallbackFile = this._readFile(this._fallbackLang);
            messageReturn = this._resolve(fallbackFile, messageSep);
        }

        if (messageReturn === undefined || messageReturn === null || messageReturn.length === 0)
            throw new MessageEmptyError(`Key "${message}" not found`);

        if (!args) return messageReturn;

        for (const [key, val] of Object.entries(args)) {
            messageReturn = messageReturn.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
        }
        return messageReturn;
    }
}

module.exports = MultiLang;