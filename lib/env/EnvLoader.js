'use strict';

const fs   = require('fs');
const path = require('path');
const { EnvError, FileNotFoundError } = require('../error/indexError');

class EnvLoader {
    /**
     * @param {string} [filePath='.env'] - Path to the .env file (optional).
     *                                     Environment variables are always included from process.env.
     */
    constructor(filePath = '.env') {
        /** @type {Record<string, string>} */
        this._env = {};

        // Merge process.env first (lowest priority)
        for (const [k, v] of Object.entries(process.env)) {
            this._env[k] = v;
        }

        // Then parse .env file (overrides process.env if present)
        const resolved = path.resolve(filePath);
        if (fs.existsSync(resolved)) {
            this._parseFile(resolved);
        }
    }

    // ─── Getters ──────────────────────────────────────────────────────────────

    /**
     * Returns the raw string value of an env variable.
     * @param {string} key
     * @param {string} [def] - Fallback value.
     * @returns {string|undefined}
     */
    get(key, def = undefined) {
        return this._env[key] !== undefined ? this._env[key] : def;
    }

    /**
     * Returns the value cast to a number.
     * @param {string} key
     * @param {number} [def]
     * @returns {number}
     * @throws {EnvError} if the value cannot be cast to a number.
     */
    getNumber(key, def = undefined) {
        const val = this._env[key];
        if (val === undefined) return def;
        const num = Number(val);
        if (isNaN(num)) throw new EnvError(`Environment variable "${key}" is not a valid number (got "${val}")`);
        return num;
    }

    /**
     * Returns the value cast to a boolean.
     * 'true', '1', 'yes', 'on' → true. Everything else → false.
     * @param {string}  key
     * @param {boolean} [def]
     * @returns {boolean}
     */
    getBool(key, def = undefined) {
        const val = this._env[key];
        if (val === undefined) return def;
        return ['true', '1', 'yes', 'on'].includes(val.toLowerCase());
    }

    /**
     * Returns the value split by a separator as an array of strings.
     * @param {string} key
     * @param {string} [separator=',']
     * @param {string[]} [def=[]]
     * @returns {string[]}
     */
    getArray(key, separator = ',', def = []) {
        const val = this._env[key];
        if (val === undefined) return def;
        return val.split(separator).map(s => s.trim()).filter(Boolean);
    }

    /**
     * Returns the value, throwing if it is not set.
     * @param {string} key
     * @returns {string}
     * @throws {EnvError}
     */
    require(key) {
        if (this._env[key] === undefined || this._env[key] === '')
            throw new EnvError(`Required environment variable "${key}" is not set`);
        return this._env[key];
    }

    /**
     * Returns true if the key is set (and non-empty).
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        return this._env[key] !== undefined && this._env[key] !== '';
    }

    /**
     * Returns a plain object of all environment variables.
     * @returns {Record<string, string>}
     */
    all() {
        return { ...this._env };
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    /**
     * Parses a .env file and merges its values into this._env.
     * Supports: KEY=value, KEY="quoted value", KEY='quoted', # comments, blank lines.
     * @private
     */
    _parseFile(filePath) {
        const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
        for (const raw of lines) {
            const line = raw.trim();
            // Skip empty lines and comments
            if (!line || line.startsWith('#')) continue;

            const eqIdx = line.indexOf('=');
            if (eqIdx === -1) continue;

            const key = line.slice(0, eqIdx).trim();
            let val   = line.slice(eqIdx + 1).trim();

            // Strip inline comments (outside quotes)
            val = this._stripInlineComment(val);

            // Remove surrounding quotes
            if ((val.startsWith('"') && val.endsWith('"')) ||
                (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }

            if (key) this._env[key] = val;
        }
    }

    /** @private */
    _stripInlineComment(val) {
        if (val.startsWith('"') || val.startsWith("'")) return val;
        const commentIdx = val.indexOf(' #');
        return commentIdx !== -1 ? val.slice(0, commentIdx).trim() : val;
    }
}

module.exports = EnvLoader;
