'use strict';

/**
 * Universal object flattening and unflattening.
 * Useful for dot-notation configuration and data mapping.
 */
const ObjectFlatten = {
    /**
     * Flattens a nested object into a single-level object with dot-notation keys.
     * @param {object} obj 
     * @param {string} prefix 
     * @returns {object}
     */
    flatten(obj, prefix = '') {
        const result = {};
        if (!obj || typeof obj !== 'object') return result;

        for (const [key, value] of Object.entries(obj)) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                Object.assign(result, this.flatten(value, newKey));
            } else {
                result[newKey] = value;
            }
        }
        
        return result;
    },

    /**
     * Unflattens a dot-notation object back into a nested object.
     * @param {object} data 
     * @returns {object}
     */
    unflatten(data) {
        const result = {};
        if (!data || typeof data !== 'object') return result;

        for (const [path, value] of Object.entries(data)) {
            const parts = path.split('.');
            let current = result;
            
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (!(part in current)) {
                    current[part] = {};
                }
                current = current[part];
            }
            
            current[parts[parts.length - 1]] = value;
        }
        
        return result;
    }
};

module.exports = ObjectFlatten;
