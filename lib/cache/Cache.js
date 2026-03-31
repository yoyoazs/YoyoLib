'use strict';

const fs = require('fs');
const path = require('path');

class Cache {
    /**
     * @param {object} [options]
     * @param {number} [options.ttl=0]      - Default TTL in seconds (0 = no expiry).
     * @param {number} [options.maxSize=0]  - Max number of entries (0 = unlimited). LRU eviction.
     * @param {string} [options.persist]    - Optional file path to persist cache to disk.
     */
    constructor({ ttl = 0, maxSize = 0, persist = null } = {}) {
        this._defaultTtl = ttl * 1000;   // convert to ms
        this._maxSize    = maxSize;
        this._persistFile = persist ? path.resolve(persist) : null;
        /** @type {Map<string, { value: *, expiresAt: number|null }>} */
        this._store      = new Map();

        // Auto-restore logic if persistence is enabled
        if (this._persistFile) {
            this.restore();
        }
    }

    // ─── Core ─────────────────────────────────────────────────────────────────

    /**
     * Stores a value. Overwrites existing entries with the same key.
     * @param {string} key
     * @param {*}      value
     * @param {number} [ttl]  - Per-entry TTL in seconds. Overrides the default TTL.
     *                          Pass 0 to disable expiry for this entry.
     * @returns {Cache} this (chainable)
     */
    set(key, value, ttl) {
        // Evict LRU entry if maxSize is reached (and this is a new key)
        if (this._maxSize > 0 && !this._store.has(key) && this._store.size >= this._maxSize) {
            const oldestKey = this._store.keys().next().value;
            this._store.delete(oldestKey);
        }

        // Delete first to move key to end of insertion order (LRU update)
        if (this._store.has(key)) this._store.delete(key);

        const ttlMs     = ttl !== undefined ? ttl * 1000 : this._defaultTtl;
        const expiresAt = ttlMs > 0 ? Date.now() + ttlMs : null;
        this._store.set(key, { value, expiresAt });
        return this;
    }

    /**
     * Retrieves a value. Returns `null` if not found or expired.
     * @param {string} key
     * @returns {*|null}
     */
    get(key) {
        const entry = this._store.get(key);
        if (!entry) return null;
        if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
            this._store.delete(key);
            return null;
        }
        return entry.value;
    }

    /**
     * Returns true if the key exists and has not expired.
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Deletes an entry by key.
     * @param {string} key
     * @returns {boolean}
     */
    delete(key) {
        return this._store.delete(key);
    }

    /**
     * Removes all entries (including non-expired ones).
     * @returns {Cache} this (chainable)
     */
    clear() {
        this._store.clear();
        return this;
    }

    // ─── Stats ────────────────────────────────────────────────────────────────

    /**
     * Returns the number of entries that have not yet expired.
     * @returns {number}
     */
    size() {
        this._evictExpired();
        return this._store.size;
    }

    /**
     * Returns an array of all non-expired keys.
     * @returns {string[]}
     */
    keys() {
        this._evictExpired();
        return [...this._store.keys()];
    }

    /**
     * Returns the remaining TTL of an entry in milliseconds.
     * Returns `null` if the entry has no expiry, `-1` if expired or not found.
     * @param {string} key
     * @returns {number|null}
     */
    ttl(key) {
        const entry = this._store.get(key);
        if (!entry) return -1;
        if (entry.expiresAt === null) return null;
        const remaining = entry.expiresAt - Date.now();
        return remaining > 0 ? remaining : -1;
    }

    // ─── Persistence ──────────────────────────────────────────────────────────

    /**
     * Saves the current cache dictionary to disk (if persist option is set).
     * Returns true if successfully saved.
     * @returns {boolean}
     */
    save() {
        if (!this._persistFile) return false;
        this._evictExpired(); // don't write expired items to disk
        try {
            const data = {};
            for (const [k, v] of this._store.entries()) {
                data[k] = v;
            }
            fs.mkdirSync(path.dirname(this._persistFile), { recursive: true });
            fs.writeFileSync(this._persistFile, JSON.stringify(data), 'utf-8');
            return true;
        } catch (_) {
            return false;
        }
    }

    /**
     * Restores the cache from disk (if persist option is set and valid).
     * Automatically invoked on constructor.
     * @returns {boolean} - True if restored from disk.
     */
    restore() {
        if (!this._persistFile || !fs.existsSync(this._persistFile)) return false;
        try {
            const raw = fs.readFileSync(this._persistFile, 'utf-8');
            const data = JSON.parse(raw);
            this._store.clear();
            for (const [k, v] of Object.entries(data)) {
                this._store.set(k, v);
            }
            this._evictExpired(); // remove anything that expired while the app was offline
            return true;
        } catch (_) {
            return false;
        }
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    /** @private - Removes all expired entries. */
    _evictExpired() {
        const now = Date.now();
        for (const [key, entry] of this._store) {
            if (entry.expiresAt !== null && now > entry.expiresAt) {
                this._store.delete(key);
            }
        }
    }
}

module.exports = Cache;
