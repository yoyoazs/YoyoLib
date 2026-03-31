'use strict';

/**
 * God Tier Data Masker.
 * Advanced recursive masking with whitelist/blacklist modes and custom functions.
 * Essential for strict GDPR and security in SaaS logs and APIs.
 */
class DataMasker {
    /**
     * @param {object} [options]
     * @param {string[]} [options.fields=[]]   - Fields to target
     * @param {'blacklist'|'whitelist'} [options.mode='blacklist'] - Strategy
     * @param {string} [options.mask='***MASKED***'] - Default mask
     * @param {Record<string, Function>} [options.customMaskers={}] - Custom maskers (key => (val) => masked)
     * @param {number} [options.maxDepth=10]   - Recursion limit
     */
    constructor({ 
        fields = ['password', 'token', 'secret', 'key', 'auth', 'authorization', 'credit_card', 'card', 'cvv'], 
        mode = 'blacklist',
        mask = '***MASKED***',
        customMaskers = {},
        maxDepth = 10
    } = {}) {
        this.fields = new Set(fields.map(f => f.toLowerCase()));
        this.mode = mode;
        this.defaultMask = mask;
        this.maxDepth = maxDepth;
        this.customMaskers = new Map();
        for (const [key, fn] of Object.entries(customMaskers)) {
            if (typeof fn === 'function') this.customMaskers.set(key.toLowerCase(), fn);
        }
    }

    /**
     * Masks an object or array.
     * @param {any} input 
     * @returns {any}
     */
    mask(input) {
        return this._process(input, new WeakSet(), 0);
    }

    /** @private */
    _process(val, seen, depth) {
        if (val === null || typeof val !== 'object') return val;
        if (depth >= this.maxDepth) return '[Max Depth Reached]';
        if (seen.has(val)) return '[Circular]';
        seen.add(val);

        if (Array.isArray(val)) {
            return val.map(item => this._process(item, seen, depth + 1));
        }

        const maskedObj = {};
        for (const [key, value] of Object.entries(val)) {
            const lowerKey = key.toLowerCase();
            const hasCustom = this.customMaskers.has(lowerKey);
            const isTargeted = this.fields.has(lowerKey);

            if (this.mode === 'blacklist') {
                if (isTargeted || hasCustom) {
                    maskedObj[key] = hasCustom 
                        ? this._tryCustom(lowerKey, value) 
                        : this.defaultMask;
                } else {
                    maskedObj[key] = this._process(value, seen, depth + 1);
                }
            } else {
                // Whitelist mode
                if (isTargeted || hasCustom) {
                    maskedObj[key] = hasCustom 
                        ? this._tryCustom(lowerKey, value) 
                        : value; // Whitelisted: keep as is (but don't recurse if it's an object? No, keep it!)
                } else if (value && typeof value === 'object') {
                    // Recurse into objects even if not whitelisted (to find whitelisted children)
                    maskedObj[key] = this._process(value, seen, depth + 1);
                } else {
                    // Not whitelisted and not an object -> mask
                    maskedObj[key] = this.defaultMask;
                }
            }
        }
        return maskedObj;
    }

    /** @private */
    _tryCustom(key, val) {
        try {
            return this.customMaskers.get(key)(val);
        } catch (e) {
            return '[Masking Error]';
        }
    }
}

module.exports = DataMasker;
