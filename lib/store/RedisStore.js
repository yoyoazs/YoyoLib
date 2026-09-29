'use strict';

// Atomic "increment and start the window if new" (fixed window counter)
const INCREMENT_SCRIPT = `
local v = redis.call('INCRBY', KEYS[1], ARGV[1])
local t = redis.call('PTTL', KEYS[1])
if t < 0 and tonumber(ARGV[2]) > 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  t = tonumber(ARGV[2])
end
return {v, t}
`;

/**
 * Redis implementation of the YoyoLib store interface (see MemoryStore).
 * Bring your own client: ioredis or node-redis v4+. YoyoLib stays dependency-free.
 * Share state between shards, workers and servers.
 *
 * @example
 * const Redis = require('ioredis');
 * const store = new RedisStore({ client: new Redis(process.env.REDIS_URL) });
 */
class RedisStore {
    /**
     * @param {object} options
     * @param {any}    options.client            - Connected ioredis or node-redis (v4+) client.
     * @param {string} [options.prefix='yoyolib:'] - Prefix added to every key.
     */
    constructor({ client, prefix = 'yoyolib:' } = {}) {
        if (!client) throw new TypeError('RedisStore requires a Redis client (ioredis or node-redis v4+)');
        if (typeof client.call === 'function') {
            // ioredis
            this._command = (args) => client.call(...args);
        } else if (typeof client.sendCommand === 'function') {
            // node-redis v4+
            this._command = (args) => client.sendCommand(args.map(String));
        } else {
            throw new TypeError('Unsupported Redis client: expected ioredis (call) or node-redis v4+ (sendCommand)');
        }
        this.prefix = prefix;
    }

    async get(key) {
        const raw = await this._command(['GET', this.prefix + key]);
        if (raw === null || raw === undefined) return null;
        try {
            return JSON.parse(raw);
        } catch (_) {
            return raw;
        }
    }

    async set(key, value, ttlMs) {
        const args = ['SET', this.prefix + key, JSON.stringify(value)];
        if (ttlMs > 0) args.push('PX', Math.ceil(ttlMs));
        await this._command(args);
    }

    async delete(key) {
        return Number(await this._command(['DEL', this.prefix + key])) > 0;
    }

    async increment(key, ttlMs, by = 1) {
        const [value, ttl] = await this._command(['EVAL', INCREMENT_SCRIPT, 1, this.prefix + key, by, Math.ceil(ttlMs || 0)]);
        const t = Number(ttl);
        return { value: Number(value), ttl: t < 0 ? null : t };
    }

    async ttl(key) {
        const t = Number(await this._command(['PTTL', this.prefix + key]));
        if (t === -2) return -1;
        if (t === -1) return null;
        return t;
    }

    async entries(prefix) {
        const keys = await this._scan(prefix);
        const out = [];
        for (let i = 0; i < keys.length; i += 200) {
            const batch = keys.slice(i, i + 200);
            const values = await this._command(['MGET', ...batch]);
            batch.forEach((key, j) => {
                const raw = values[j];
                if (raw === null || raw === undefined) return; // expired between SCAN and MGET
                let value;
                try { value = JSON.parse(raw); } catch (_) { value = raw; }
                out.push([key.slice(this.prefix.length), value]);
            });
        }
        return out;
    }

    /** @private All full keys matching a prefix. */
    async _scan(prefix) {
        const pattern = `${escapeGlob(this.prefix + prefix)}*`;
        const keys = [];
        let cursor = '0';
        do {
            const [next, found] = await this._command(['SCAN', cursor, 'MATCH', pattern, 'COUNT', 200]);
            cursor = String(next);
            if (found) keys.push(...found);
        } while (cursor !== '0');
        return keys;
    }

    async deleteByPrefix(prefix) {
        const keys = await this._scan(prefix);
        let removed = 0;
        for (let i = 0; i < keys.length; i += 200) {
            removed += Number(await this._command(['DEL', ...keys.slice(i, i + 200)]));
        }
        return removed;
    }
}

function escapeGlob(str) {
    return str.replace(/[*?[\]\\]/g, '\\$&');
}

module.exports = RedisStore;
