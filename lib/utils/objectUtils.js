'use strict';

/**
 * Determines if a value is a plain Object (not array, date, promise, etc.)
 * @param {*} item
 * @returns {boolean}
 */
const isObject = (item) => (item && typeof item === 'object' && !Array.isArray(item));

const objectUtils = {
    /**
     * Deep clones an object or array breaking reference logic.
     * Fallbacks to standard structuredClone if available, otherwise JSON parser.
     * @param {*} src
     * @returns {*}
     */
    deepClone(src) {
        if (typeof structuredClone === 'function') {
            return structuredClone(src);
        }
        return JSON.parse(JSON.stringify(src));
    },

    /**
     * Deep merges a source object into a target object recursively.
     * Only merges plain objects (arrays are overwritten).
     * @param {object} target - The object receiving properties
     * @param {object} source - The object providing properties
     * @returns {object} The mutated target
     */
    deepMerge(target, source) {
        if (!isObject(target) || !isObject(source)) return source; // If not objects, source wins

        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                objectUtils.deepMerge(target[key], source[key]); // recursive
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
        return target;
    },

    /**
     * Creates an object composed of the picked object properties.
     * @param {object} object
     * @param {string[]} keys
     * @returns {object}
     */
    pick(object, keys) {
        if (!object) return {};
        const result = {};
        for (const key of keys) {
            if (key in object) result[key] = object[key];
        }
        return result;
    },

    /**
     * Creates an object composed of the properties EXCLUDING those passed in keys.
     * @param {object} object
     * @param {string[]} keys
     * @returns {object}
     */
    omit(object, keys) {
        if (!object) return {};
        const result = { ...object };
        for (const key of keys) {
            delete result[key];
        }
        return result;
    }
};

module.exports = objectUtils;
