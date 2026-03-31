'use strict';

const fs   = require('fs');
const path = require('path');
const { FileNotFoundError, ConfigError } = require('../error/indexError');

class ConfigManager {
    /**
     * @param {string} filePath - Path to the JSON config file.
     * @param {object} [defaults={}] - Default values merged in if keys are missing.
     */
    constructor(filePath, defaults = {}) {
        this._filePath = path.resolve(filePath);
        this._data     = { ...defaults };
        this._defaults = defaults;

        if (fs.existsSync(this._filePath)) {
            this._loadFromDisk();
        } else {
            // Create the file with defaults
            fs.mkdirSync(path.dirname(this._filePath), { recursive: true });
            this._writeToDisk();
        }
    }

    // ─── Core ─────────────────────────────────────────────────────────────────

    /**
     * Gets a value by dot-notation key.
     * @param {string} key      - Dot-notation key (e.g. 'server.port').
     * @param {*}      [def]    - Fallback value if the key doesn't exist.
     * @returns {*}
     */
    get(key, def = undefined) {
        const result = this._resolve(this._data, key.split('.'));
        return (result !== undefined && result !== null) ? result : def;
    }

    /**
     * Sets a value by dot-notation key. Creates nested objects as needed.
     * @param {string} key   - Dot-notation key.
     * @param {*}      value - Value to set.
     * @returns {ConfigManager} - Returns `this` for chaining.
     */
    set(key, value) {
        const parts = key.split('.');
        let obj = this._data;
        for (let i = 0; i < parts.length - 1; i++) {
            if (typeof obj[parts[i]] !== 'object' || obj[parts[i]] === null)
                obj[parts[i]] = {};
            obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
        return this;
    }

    /**
     * Returns true if the given key exists (and is not undefined).
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        return this._resolve(this._data, key.split('.')) !== undefined;
    }

    /**
     * Deletes a key (supports dot-notation).
     * @param {string} key
     * @returns {boolean} - True if the key existed and was deleted.
     */
    delete(key) {
        const parts = key.split('.');
        let obj = this._data;
        for (let i = 0; i < parts.length - 1; i++) {
            if (typeof obj[parts[i]] !== 'object') return false;
            obj = obj[parts[i]];
        }
        const exists = Object.prototype.hasOwnProperty.call(obj, parts[parts.length - 1]);
        if (exists) delete obj[parts[parts.length - 1]];
        return exists;
    }

    /**
     * Returns the entire config object (shallow copy).
     * @returns {object}
     */
    all() {
        return { ...this._data };
    }

    /**
     * Resets the config to the original defaults.
     * @returns {ConfigManager}
     */
    reset() {
        this._data = { ...this._defaults };
        return this;
    }

    // ─── Persistence ──────────────────────────────────────────────────────────

    /**
     * Writes the current config to disk (pretty-printed JSON).
     * @returns {ConfigManager}
     */
    save() {
        this._writeToDisk();
        return this;
    }

    /**
     * Re-reads the config file from disk, discarding unsaved changes.
     * @returns {ConfigManager}
     * @throws {FileNotFoundError}
     */
    reload() {
        if (!fs.existsSync(this._filePath))
            throw new FileNotFoundError(`Config file not found: ${this._filePath}`);
        this._loadFromDisk();
        return this;
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    /** @private */
    _resolve(obj, parts) {
        let cur = obj;
        for (const key of parts) {
            if (cur === undefined || cur === null) return undefined;
            cur = cur[key];
        }
        return cur;
    }

    /** @private */
    _loadFromDisk() {
        try {
            const raw  = fs.readFileSync(this._filePath, 'utf-8');
            const disk = JSON.parse(raw);
            // Merge: defaults < disk values
            this._data = this._deepMerge(this._defaults, disk);
        } catch (e) {
            throw new ConfigError(`Failed to parse config file "${this._filePath}": ${e.message}`);
        }
    }

    /** @private */
    _writeToDisk() {
        try {
            fs.writeFileSync(this._filePath, JSON.stringify(this._data, null, 2), 'utf-8');
        } catch (e) {
            throw new ConfigError(`Failed to write config file "${this._filePath}": ${e.message}`);
        }
    }

    /** @private - Deep-merges src into target, returning a new object. */
    _deepMerge(target, src) {
        const out = { ...target };
        for (const key of Object.keys(src)) {
            if (src[key] && typeof src[key] === 'object' && !Array.isArray(src[key])) {
                out[key] = this._deepMerge(out[key] || {}, src[key]);
            } else {
                out[key] = src[key];
            }
        }
        return out;
    }
}

module.exports = ConfigManager;
