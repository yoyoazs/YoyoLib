'use strict';

const MemoryStore = require('../store/MemoryStore');
const { parseDuration } = require('../utils/duration');
const { ValidationError } = require('../error/indexError');

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SNOWFLAKE = /^\d{17,20}$/;

/**
 * Per-guild (or per-tenant) settings with defaults, validation and a local cache.
 *
 * Only the values that differ from the defaults are stored, so changing a default
 * applies to every guild that did not override it.
 *
 * @example
 * const settings = new GuildSettings({
 *     store: new JsonFileStore({ file: 'data/settings.json' }),
 *     defaults: { prefix: '!', locale: 'en', logChannel: null },
 *     schema: { prefix: { type: 'string', min: 1, max: 5 }, locale: { choices: ['en', 'fr'] }, logChannel: { type: 'snowflake' } },
 * });
 * await settings.set(guildId, 'prefix', '?');
 * await settings.get(guildId, 'prefix'); // '?'
 */
class GuildSettings {
    /**
     * @param {object} [options]
     * @param {object} [options.store]        - Any YoyoLib Store (MemoryStore by default: not persisted!).
     * @param {object} [options.defaults={}]  - Default settings.
     * @param {Record<string, SettingRule>} [options.schema] - Rules per dot-path key.
     * @param {boolean} [options.strict]      - Refuse keys missing from the schema (default: true when a schema is given).
     * @param {number|string} [options.cacheTtl=60000] - Local cache duration ('1m', ms). 0 disables it.
     *        With several processes sharing a store, other processes see a change after at most this delay.
     * @param {string} [options.namespace='guild-settings'] - Key prefix in the store.
     */
    constructor({ store, defaults = {}, schema = null, strict, cacheTtl = 60000, namespace = 'guild-settings' } = {}) {
        if (!isPlainObject(defaults)) throw new TypeError('defaults must be a plain object');
        assertSafe(defaults);
        this.store = store || new MemoryStore();
        this.defaults = clone(defaults);
        this.schema = schema;
        this.strict = strict === undefined ? Boolean(schema) : strict;
        this.namespace = namespace;
        this._cacheTtl = cacheTtl ? parseDuration(cacheTtl) : 0;
        /** @type {Map<string, { overrides: object, expiresAt: number }>} */
        this._cache = new Map();
        /** @type {Map<string, Promise<object>>} */
        this._inflight = new Map();
    }

    /**
     * Returns the settings of a guild (defaults merged with its overrides), or one value by dot path.
     * A falsy guildId (DMs) returns the defaults.
     * @param {string|null|undefined} guildId
     * @param {string} [key]
     * @returns {Promise<any>}
     */
    async get(guildId, key) {
        const overrides = guildId ? await this._load(String(guildId)) : {};
        const merged = deepMerge(clone(this.defaults), overrides);
        return key === undefined ? merged : getPath(merged, key);
    }

    /**
     * Returns only the values a guild changed.
     * @param {string} guildId
     * @returns {Promise<object>}
     */
    async overrides(guildId) {
        return clone(await this._load(String(guildId)));
    }

    /**
     * Changes one setting (`set(id, 'prefix', '?')`) or several (`set(id, { prefix: '?', locale: 'fr' })`).
     * Values are validated against the schema before anything is written.
     * @param {string} guildId
     * @param {string|object} keyOrPatch
     * @param {any} [value]
     * @returns {Promise<object>} The new merged settings.
     * @throws {ValidationError}
     */
    async set(guildId, keyOrPatch, value) {
        if (!guildId) throw new TypeError('guildId is required');
        const changes = this._flattenPatch(typeof keyOrPatch === 'string' ? { [keyOrPatch]: value } : keyOrPatch);
        for (const [key, v] of changes) this.validate(key, v);

        const id = String(guildId);
        const overrides = clone(await this._load(id, true));
        for (const [key, v] of changes) setPath(overrides, key, clone(v));
        await this._save(id, overrides);
        return this.get(id);
    }

    /**
     * Restores the default of one key, or of every key when `key` is omitted.
     * @param {string} guildId
     * @param {string} [key]
     * @returns {Promise<object>} The new merged settings.
     */
    async reset(guildId, key) {
        const id = String(guildId);
        if (key === undefined) {
            await this.store.delete(this._key(id));
            this._cache.delete(id);
            return this.get(id);
        }
        const overrides = clone(await this._load(id, true));
        deletePath(overrides, key);
        await this._save(id, overrides);
        return this.get(id);
    }

    /**
     * Deletes every stored value of a guild (e.g. on guildDelete).
     * @param {string} guildId
     * @returns {Promise<void>}
     */
    async delete(guildId) {
        await this.reset(guildId);
    }

    /**
     * Drops the local cache of one guild (or all guilds), e.g. after an external change.
     * @param {string} [guildId]
     */
    invalidate(guildId) {
        if (guildId === undefined) this._cache.clear();
        else this._cache.delete(String(guildId));
    }

    /**
     * Returns an accessor bound to one guild.
     * @param {string|null|undefined} guildId
     */
    for(guildId) {
        return {
            guildId: guildId || null,
            get: (key) => this.get(guildId, key),
            set: (keyOrPatch, value) => this.set(guildId, keyOrPatch, value),
            reset: (key) => this.reset(guildId, key),
        };
    }

    /**
     * Validates one value against the schema (no-op without schema, except for forbidden keys).
     * @param {string} key
     * @param {any} value
     * @throws {ValidationError}
     */
    validate(key, value) {
        if (typeof key !== 'string' || !key) throw new ValidationError('Setting key must be a non-empty string');
        if (key.split('.').some(p => FORBIDDEN_KEYS.has(p) || p === '')) throw new ValidationError(`Invalid setting key "${key}"`);

        const rule = this.schema && this.schema[key];
        if (!rule) {
            if (this.strict) throw new ValidationError(`Unknown setting "${key}"`);
            if (isPlainObject(value)) assertSafe(value);
            return;
        }

        if (value === null || value === undefined) {
            if (rule.nullable || getPath(this.defaults, key) === null) return;
            throw new ValidationError(`Setting "${key}" cannot be empty`);
        }

        const type = rule.type;
        if (type === 'snowflake') {
            if (typeof value !== 'string' || !SNOWFLAKE.test(value)) throw new ValidationError(`Setting "${key}" must be a Discord ID`);
        } else if (type === 'array') {
            if (!Array.isArray(value)) throw new ValidationError(`Setting "${key}" must be an array`);
        } else if (type === 'object') {
            if (!isPlainObject(value)) throw new ValidationError(`Setting "${key}" must be an object`);
            assertSafe(value);
        } else if (type && typeof value !== type) {
            throw new ValidationError(`Setting "${key}" must be a ${type}`);
        }
        if (type === 'number' && !Number.isFinite(value)) throw new ValidationError(`Setting "${key}" must be a finite number`);

        const size = typeof value === 'number' ? value : (typeof value === 'string' || Array.isArray(value)) ? value.length : null;
        const unit = typeof value === 'number' ? '' : ' characters';
        if (size !== null && rule.min !== undefined && size < rule.min) {
            throw new ValidationError(Array.isArray(value)
                ? `Setting "${key}" needs at least ${rule.min} items`
                : `Setting "${key}" must be at least ${rule.min}${unit}`);
        }
        if (size !== null && rule.max !== undefined && size > rule.max) {
            throw new ValidationError(Array.isArray(value)
                ? `Setting "${key}" accepts at most ${rule.max} items`
                : `Setting "${key}" must be at most ${rule.max}${unit}`);
        }
        if (rule.regex instanceof RegExp && typeof value === 'string' && !rule.regex.test(value)) {
            throw new ValidationError(`Setting "${key}" has an invalid format`);
        }
        if (Array.isArray(rule.choices) && !rule.choices.includes(value)) {
            throw new ValidationError(`Setting "${key}" must be one of: ${rule.choices.join(', ')}`);
        }
        if (typeof rule.validate === 'function') {
            const verdict = rule.validate(value);
            if (verdict !== true && verdict !== undefined) {
                throw new ValidationError(typeof verdict === 'string' ? verdict : `Setting "${key}" is invalid`);
            }
        }
    }

    /** @private Splits a patch object into [dotPath, value] pairs, stopping at schema keys. */
    _flattenPatch(patch, prefix = '') {
        if (!isPlainObject(patch)) throw new TypeError('Patch must be a plain object');
        const out = [];
        for (const [k, v] of Object.entries(patch)) {
            const key = prefix ? `${prefix}.${k}` : k;
            const declared = this.schema && this.schema[key];
            if (isPlainObject(v) && !declared && !FORBIDDEN_KEYS.has(k)) out.push(...this._flattenPatch(v, key));
            else out.push([key, v]);
        }
        return out;
    }

    /** @private */
    _key(guildId) {
        return `${this.namespace}:${guildId}`;
    }

    /** @private Reads the overrides, from the local cache when fresh. `fresh` bypasses the cache before writes. */
    async _load(guildId, fresh = false) {
        const cached = this._cache.get(guildId);
        if (!fresh && cached && cached.expiresAt > Date.now()) return cached.overrides;

        // Deduplicate concurrent reads of the same guild
        if (!fresh && this._inflight.has(guildId)) return this._inflight.get(guildId);
        const promise = (async () => {
            const stored = await this.store.get(this._key(guildId));
            const overrides = isPlainObject(stored) ? clone(stored) : {};
            this._remember(guildId, overrides);
            return overrides;
        })();
        if (!fresh) this._inflight.set(guildId, promise);
        try {
            return await promise;
        } finally {
            if (!fresh) this._inflight.delete(guildId);
        }
    }

    /** @private */
    async _save(guildId, overrides) {
        prune(overrides);
        if (Object.keys(overrides).length === 0) await this.store.delete(this._key(guildId));
        else await this.store.set(this._key(guildId), overrides);
        this._remember(guildId, overrides);
    }

    /** @private */
    _remember(guildId, overrides) {
        if (this._cacheTtl > 0) this._cache.set(guildId, { overrides, expiresAt: Date.now() + this._cacheTtl });
    }
}

/**
 * @typedef {object} SettingRule
 * @property {'string'|'number'|'boolean'|'object'|'array'|'snowflake'} [type]
 * @property {number}   [min]      - Min length (strings/arrays) or value (numbers).
 * @property {number}   [max]
 * @property {RegExp}   [regex]
 * @property {any[]}    [choices]  - Allowed values.
 * @property {boolean}  [nullable] - Accept null (implicit when the default is null).
 * @property {(value: any) => true|string|void} [validate] - Custom check; return a string to reject with it.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

function clone(v) {
    return v === undefined ? v : structuredClone(v);
}

function assertSafe(obj) {
    for (const [k, v] of Object.entries(obj)) {
        if (FORBIDDEN_KEYS.has(k)) throw new ValidationError(`Invalid setting key "${k}"`);
        if (isPlainObject(v)) assertSafe(v);
    }
}

function getPath(obj, key) {
    let cur = obj;
    for (const part of key.split('.')) {
        if (cur === null || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, part)) return undefined;
        cur = cur[part];
    }
    return cur;
}

function setPath(obj, key, value) {
    const parts = key.split('.');
    let cur = obj;
    for (const part of parts.slice(0, -1)) {
        if (!isPlainObject(cur[part])) cur[part] = {};
        cur = cur[part];
    }
    cur[parts[parts.length - 1]] = value;
}

function deletePath(obj, key) {
    const parts = key.split('.');
    let cur = obj;
    for (const part of parts.slice(0, -1)) {
        if (!isPlainObject(cur[part])) return;
        cur = cur[part];
    }
    delete cur[parts[parts.length - 1]];
}

/** Removes empty nested objects left behind by reset(). */
function prune(obj) {
    for (const [k, v] of Object.entries(obj)) {
        if (isPlainObject(v)) {
            prune(v);
            if (Object.keys(v).length === 0) delete obj[k];
        }
    }
}

/** Overrides win; plain objects are merged, arrays and other values replaced. */
function deepMerge(target, source) {
    for (const [k, v] of Object.entries(source)) {
        if (FORBIDDEN_KEYS.has(k)) continue;
        if (isPlainObject(v) && isPlainObject(target[k])) deepMerge(target[k], v);
        else target[k] = clone(v);
    }
    return target;
}

module.exports = GuildSettings;
