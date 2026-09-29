'use strict';

// Path segments that would reach Object.prototype (prototype pollution)
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);
const isSafePath = (parts) => parts.every(p => !FORBIDDEN.has(p));

/**
 * Advanced dot-notation path utilities for objects.
 * Supports get, set and exists.
 * Paths containing __proto__, constructor or prototype are refused.
 */
const objectPath = {
    /**
     * Gets a value from an object using a dot-notation path.
     * @param {object} obj 
     * @param {string} path 
     * @param {any} [defaultValue=undefined] 
     * @returns {any}
     */
    get(obj, path, defaultValue = undefined) {
        if (!obj || typeof path !== 'string') return defaultValue;

        const parts = path.split('.');
        if (!isSafePath(parts)) return defaultValue;
        let current = obj;

        for (const part of parts) {
            if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
                return defaultValue;
            }
            current = current[part];
        }
        
        return current === undefined ? defaultValue : current;
    },

    /**
     * Sets a value in an object using a dot-notation path.
     * Creates intermediate objects if they don't exist.
     * @param {object} obj 
     * @param {string} path 
     * @param {any} value 
     * @returns {boolean}
     */
    set(obj, path, value) {
        if (!obj || typeof path !== 'string') return false;

        const parts = path.split('.');
        if (!isSafePath(parts)) return false;
        let current = obj;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!Object.prototype.hasOwnProperty.call(current, part) || current[part] === null || typeof current[part] !== 'object') {
                current[part] = {};
            }
            current = current[part];
        }
        
        current[parts[parts.length - 1]] = value;
        return true;
    },

    /**
     * Checks if a path exists in an object.
     * @param {object} obj 
     * @param {string} path 
     * @returns {boolean}
     */
    has(obj, path) {
        if (!obj || typeof path !== 'string') return false;

        const parts = path.split('.');
        if (!isSafePath(parts)) return false;
        let current = obj;

        for (const part of parts) {
            if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
                return false;
            }
            current = current[part];
        }
        
        return true;
    }
};

module.exports = objectPath;
