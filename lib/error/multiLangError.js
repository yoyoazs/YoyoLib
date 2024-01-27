/**
 * Error class for representing an error when a language file is not found.
 *
 * @class
 * @extends Error
 * @name LangFileError
 * @param {string} message - The error message.
 */
class LangFileError extends Error {
    constructor(message) {
        super(message)
        this.name = "LangFileError"
    }
}

/**
 * Error class for representing an error when a language name is not valid or already defined.
 *
 * @class
 * @extends Error
 * @name LangNameError
 * @param {string} message - The error message.
 */
class LangNameError extends Error {
    constructor(message) {
        super(message)
        this.name = "LangNameError"
    }
}

module.exports = {
    LangNameError,
    LangFileError
}
