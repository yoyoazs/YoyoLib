'use strict';

const Cache = require('../cache/Cache');

class RateLimiter {
    /**
     * Creates a new rate limiter backed by a Cache instance.
     * @param {object} options
     * @param {number} [options.limit=100] - Max allowed hits per time window
     * @param {number} [options.window=60] - Time window in seconds
     */
    constructor({ limit = 100, window = 60 } = {}) {
        if (typeof limit !== 'number' || limit <= 0) throw new TypeError('limit must be positive');
        if (typeof window !== 'number' || window <= 0) throw new TypeError('window must be positive');
        
        this.limit = limit;
        this.window = window;
        
        // TTL is the time window in seconds
        this._store = new Cache({ ttl: window });
    }

    /**
     * Consumes 1 point for the given key (e.g. IP address, User ID).
     * @param {string} key - Identifier representing the client 
     * @returns {{ allowed: boolean, remaining: number, resetIn: number }} Status object
     */
    consume(key) {
        if (!key || typeof key !== 'string') throw new TypeError('Key must be a valid string');

        let hits = this._store.get(key) || 0;
        let ttlMs = this._store.ttl(key);

        hits++;
        
        // If the key is new or expired, ttlMs will be null or <= 0
        if (!ttlMs || ttlMs <= 0) {
            // First hit, store with the max TTL of our window
            this._store.set(key, hits, this.window);
            ttlMs = this.window * 1000;
        } else {
            // Successive hits simply update the value but keep the *original* expiry logic
            // In our simple Cache, set() resets the TTL if we pass a second param,
            // but we can pass ttlMs / 1000 to keep the exact same remaining window!
            this._store.set(key, hits, ttlMs / 1000);
        }

        const remaining = Math.max(0, this.limit - hits);
        const allowed = hits <= this.limit;

        return {
            allowed,
            remaining,
            resetIn: ttlMs, // ms until the window completely clears
            hits
        };
    }
    
    /**
     * Clears all limits manually.
     */
    resetAll() {
        this._store.clear();
    }
}

module.exports = RateLimiter;
