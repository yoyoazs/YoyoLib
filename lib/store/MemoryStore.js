'use strict';

/**
 * In-memory implementation of the YoyoLib store interface.
 * All methods are async so it can be swapped with RedisStore (or any custom store)
 * without changing the calling code.
 *
 * Store interface:
 *   get(key)                    → value | null
 *   set(key, value, ttlMs?)     → void
 *   delete(key)                 → boolean
 *   increment(key, ttlMs, by=1) → { value, ttl }  (ttl only set when the key is created: fixed window)
 *   ttl(key)                    → ms left, null if no expiry, -1 if missing
 *   deleteByPrefix(prefix)      → number of keys removed
 */
class MemoryStore {
    /**
     * @param {object} [options]
     * @param {number} [options.sweepInterval=60000] - Purge interval for expired keys (ms). 0 disables it.
     */
    constructor({ sweepInterval = 60000 } = {}) {
        /** @type {Map<string, { value: any, expiresAt: number|null }>} */
        this._data = new Map();
        this._timer = null;
        if (sweepInterval > 0) {
            this._timer = setInterval(() => this._sweep(), sweepInterval);
            if (typeof this._timer.unref === 'function') this._timer.unref();
        }
    }

    async get(key) {
        const entry = this._live(key);
        return entry ? entry.value : null;
    }

    async set(key, value, ttlMs) {
        this._data.set(key, { value, expiresAt: ttlMs > 0 ? Date.now() + ttlMs : null });
    }

    async delete(key) {
        return this._data.delete(key);
    }

    async increment(key, ttlMs, by = 1) {
        let entry = this._live(key);
        if (!entry) {
            entry = { value: 0, expiresAt: ttlMs > 0 ? Date.now() + ttlMs : null };
            this._data.set(key, entry);
        }
        entry.value = Number(entry.value) + by;
        return { value: entry.value, ttl: entry.expiresAt === null ? null : entry.expiresAt - Date.now() };
    }

    async ttl(key) {
        const entry = this._live(key);
        if (!entry) return -1;
        return entry.expiresAt === null ? null : entry.expiresAt - Date.now();
    }

    async deleteByPrefix(prefix) {
        let removed = 0;
        for (const key of this._data.keys()) {
            if (key.startsWith(prefix)) { this._data.delete(key); removed++; }
        }
        return removed;
    }

    /** Stops the background sweep timer. */
    close() {
        if (this._timer) clearInterval(this._timer);
        this._timer = null;
    }

    /** @private Returns the entry if present and not expired. */
    _live(key) {
        const entry = this._data.get(key);
        if (!entry) return null;
        if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
            this._data.delete(key);
            return null;
        }
        return entry;
    }

    /** @private */
    _sweep() {
        const now = Date.now();
        for (const [key, entry] of this._data) {
            if (entry.expiresAt !== null && entry.expiresAt <= now) this._data.delete(key);
        }
    }
}

module.exports = MemoryStore;
