/**
 * Error class for validation-related errors.
 * @class
 * @extends Error
 */
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

module.exports = {
    ValidationError
};
