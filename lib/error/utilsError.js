/**
 * Error class for representing an error when an array is expected to have elements but is empty.
 *
 * @class
 * @extends Error
 * @name EmptyArrayError
 * @param {string} message - The error message.
 */
class EmptyArrayError extends Error {
    constructor(message) {
        super(message)
        this.name = "EmptyArrayError"
    }
}

/**
 * Error class for representing an error when a message is expected to have content but is empty.
 *
 * @class
 * @extends Error
 * @name MessageEmptyError
 * @param {string} message - The error message.
 */
class MessageEmptyError extends Error {
    constructor(message) {
        super(message)
        this.name = "MessageEmptyError"
    }
}

/**
 * Error class for representing an error when a file is not found.
 *
 * @class
 * @extends Error
 * @name FileNotFoundError
 * @param {string} message - The error message.
 */
class FileNotFoundError extends Error {
    constructor(message) {
        super(message)
        this.name = "FileNotFoundError"
    }
}

/**
 * Error class for representing an error when a directory is not found.
 *
 * @class
 * @extends Error
 * @name DirNotFoundError
 * @param {string} message - The error message.
 */
class DirNotFoundError extends Error {
    constructor(message) {
        super(message)
        this.name = "DirNotFoundError"
    }
}

/**
 * Error class for configuration-related errors.
 * @class
 * @extends Error
 */
class ConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConfigError';
    }
}

/**
 * Error class for missing or invalid environment variables.
 * @class
 * @extends Error
 */
class EnvError extends Error {
    constructor(message) {
        super(message);
        this.name = 'EnvError';
    }
}

module.exports = {
    EmptyArrayError,
    MessageEmptyError,
    FileNotFoundError,
    DirNotFoundError,
    ConfigError,
    EnvError,
}