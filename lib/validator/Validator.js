'use strict';

const { ValidationError } = require('../error/indexError');

class Validator {
    /**
     * Validates an object against a schema.
     * @param {object} data - The object to validate.
     * @param {object} schema - The validation rules.
     * @returns {boolean} True if valid. Throws ValidationError if invalid.
     * @throws {ValidationError}
     * 
     * Schema format:
     * {
     *   field: { type: 'string', required: true, min: 3, max: 20, regex: /^[a-z]+$/ }
     * }
     */
    static validate(data, schema) {
        if (typeof data !== 'object' || data === null) {
            throw new ValidationError('Data must be a non-null object');
        }
        if (typeof schema !== 'object' || schema === null) {
            throw new ValidationError('Schema must be a non-null object');
        }

        for (const [key, rules] of Object.entries(schema)) {
            const value = data[key];

            // 1. Required
            if (rules.required && (value === undefined || value === null || value === '')) {
                throw new ValidationError(`Field "${key}" is required`);
            }

            // Skip further validation if optional and missing
            if (value === undefined || value === null || value === '') {
                continue;
            }

            // 2. Type
            if (rules.type) {
                // array is a special object type in js
                if (rules.type === 'array') {
                    if (!Array.isArray(value)) throw new ValidationError(`Field "${key}" must be an array`);
                } else if (typeof value !== rules.type) {
                    throw new ValidationError(`Field "${key}" must be a ${rules.type}`);
                }
            }

            // 3. Min/Max for strings and arrays
            if (typeof value === 'string' || Array.isArray(value)) {
                if (rules.min !== undefined && value.length < rules.min) {
                    throw new ValidationError(`Field "${key}" length must be at least ${rules.min}`);
                }
                if (rules.max !== undefined && value.length > rules.max) {
                    throw new ValidationError(`Field "${key}" length must be at most ${rules.max}`);
                }
            }

            // 4. Min/Max for numbers
            if (typeof value === 'number') {
                if (rules.min !== undefined && value < rules.min) {
                    throw new ValidationError(`Field "${key}" must be >= ${rules.min}`);
                }
                if (rules.max !== undefined && value > rules.max) {
                    throw new ValidationError(`Field "${key}" must be <= ${rules.max}`);
                }
            }

            // 5. RegExp matching
            if (rules.regex instanceof RegExp && typeof value === 'string') {
                if (!rules.regex.test(value)) {
                    throw new ValidationError(`Field "${key}" does not match the required pattern`);
                }
            }
        }

        return true;
    }
}

module.exports = Validator;
