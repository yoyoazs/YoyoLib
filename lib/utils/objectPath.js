'use strict';

/**
 * Advanced dot-notation path utilities for objects.
 * Supports get, set and exists.
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
        let current = obj;
        
        for (const part of parts) {
            if (current === null || typeof current !== 'object' || !(part in current)) {
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
        let current = obj;
        
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!(part in current) || current[part] === null || typeof current[part] !== 'object') {
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
        let current = obj;
        
        for (const part of parts) {
            if (current === null || typeof current !== 'object' || !(part in current)) {
                return false;
            }
            current = current[part];
        }
        
        return true;
    }
};

module.exports = objectPath;
