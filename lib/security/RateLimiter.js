'use strict';

const Cache = require('../cache/Cache');

class RateLimiter {
    /**
     * Creates a new fixed-window rate limiter.
     * @param {object} options
     * @param {number} [options.limit=100] - Max allowed hits per time window
     * @param {number} [options.window=60] - Time window in seconds
     * @param {object} [options.store]     - Shared async store (MemoryStore, RedisStore...).
     *        When set, consume() and reset() return Promises and limits are shared between processes.
     * @param {string} [options.name='default'] - Namespace for keys in a shared store.
     */
    constructor({ limit = 100, window = 60, store = null, name = 'default' } = {}) {
        if (typeof limit !== 'number' || limit <= 0) throw new TypeError('limit must be positive');
        if (typeof window !== 'number' || window <= 0) throw new TypeError('window must be positive');

        this.limit = limit;
        this.window = window;
        this.name = name;
        this._sharedStore = store;

        // TTL is the time window in seconds
        this._store = new Cache({ ttl: window });
    }

    /**
     * Consumes 1 point for the given key (e.g. IP address, User ID).
     * @param {string} key - Identifier representing the client
     * @returns {{ allowed: boolean, remaining: number, resetIn: number, hits: number }
     *          | Promise<{ allowed: boolean, remaining: number, resetIn: number, hits: number }>}
     *          Status object (a Promise when a store is configured)
     */
    consume(key) {
        if (!key || typeof key !== 'string') throw new TypeError('Key must be a valid string');
        if (this._sharedStore) return this._consumeShared(key);

        let hits = this._store.get(key) || 0;
        let ttlMs = this._store.ttl(key);

        hits++;

        // If the key is new or expired, ttlMs will be null or <= 0
        if (!ttlMs || ttlMs <= 0) {
            // First hit, store with the max TTL of our window
            this._store.set(key, hits, this.window);
            ttlMs = this.window * 1000;
        } else {
            // Successive hits keep the remaining window instead of restarting it
            this._store.set(key, hits, ttlMs / 1000);
        }

        return this._status(hits, ttlMs);
    }

    /** @private */
    async _consumeShared(key) {
        const windowMs = this.window * 1000;
        const { value, ttl } = await this._sharedStore.increment(this._key(key), windowMs);
        return this._status(value, ttl === null ? windowMs : ttl);
    }

    /** @private */
    _status(hits, resetIn) {
        return {
            allowed: hits <= this.limit,
            remaining: Math.max(0, this.limit - hits),
            resetIn, // ms until the window completely clears
            hits
        };
    }

    /** @private */
    _key(key) {
        return `ratelimit:${this.name}:${key}`;
    }

    /**
     * Returns a (req, res, next) middleware for Express, Connect or node:http.
     * Sets RateLimit-Limit / RateLimit-Remaining / RateLimit-Reset headers and answers 429 with Retry-After.
     * Fastify: `fastify.addHook('onRequest', (req, reply, done) => mw(req.raw, reply.raw, done))`.
     *
     * @param {object} [options]
     * @param {(req: any) => string|null|undefined|Promise<string|null|undefined>} [options.key]
     *        Identifies the client (default: IP). Return a falsy value to skip limiting.
     * @param {any} [options.message={ error: 'Too Many Requests' }] - 429 body (object → JSON).
     * @returns {(req: any, res: any, next?: (err?: any) => void) => Promise<void>}
     */
    middleware({ key = defaultKey, message = { error: 'Too Many Requests' } } = {}) {
        return async (req, res, next = () => {}) => {
            let status;
            try {
                const id = await key(req);
                if (!id) return next();
                status = await this.consume(String(id));
            } catch (err) {
                return next(err);
            }

            const resetSeconds = Math.ceil(status.resetIn / 1000);
            res.setHeader('RateLimit-Limit', String(this.limit));
            res.setHeader('RateLimit-Remaining', String(status.remaining));
            res.setHeader('RateLimit-Reset', String(resetSeconds));
            if (status.allowed) return next();

            res.statusCode = 429;
            res.setHeader('Retry-After', String(resetSeconds));
            if (typeof message === 'string') {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end(message);
            } else {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify(message));
            }
        };
    }

    /**
     * Clears the limit of one key.
     * @param {string} key
     * @returns {boolean|Promise<boolean>}
     */
    reset(key) {
        if (this._sharedStore) return this._sharedStore.delete(this._key(key));
        return this._store.delete(key);
    }

    /**
     * Clears all limits manually.
     * @returns {void|Promise<number>}
     */
    resetAll() {
        if (this._sharedStore) return this._sharedStore.deleteByPrefix(`ratelimit:${this.name}:`);
        this._store.clear();
    }
}

function defaultKey(req) {
    return req.ip || (req.socket && req.socket.remoteAddress) || null;
}

module.exports = RateLimiter;
