'use strict';

const { parseDuration, formatDuration } = require('../utils/duration');

/**
 * Per-key cooldowns, e.g. "user 123 can use /daily once every 24h"
 * or "a guild can run /purge 3 times per minute".
 *
 * @example
 * const cooldowns = new CooldownManager();
 * const res = cooldowns.hit('daily', userId, '24h');
 * if (!res.ok) return reply(`Try again in ${res.remainingText}`);
 */
class CooldownManager {
    /**
     * @param {object} [options]
     * @param {number} [options.sweepInterval=60000] - How often expired entries are purged (ms). 0 disables it.
     */
    constructor({ sweepInterval = 60000 } = {}) {
        /** @type {Map<string, { count: number, resetAt: number }>} */
        this._entries = new Map();
        this._timer = null;
        if (sweepInterval > 0) {
            this._timer = setInterval(() => this.sweep(), sweepInterval);
            if (typeof this._timer.unref === 'function') this._timer.unref();
        }
    }

    /**
     * Consumes one use for `id` in `bucket`.
     * @param {string} bucket - What is being limited (e.g. a command name).
     * @param {string} id     - Who is limited (user id, guild id, 'global'...).
     * @param {string|number|{duration: string|number, uses?: number}} rule
     *        A duration ('5s', 3000) for one use per window, or `{ duration, uses }`.
     * @returns {CooldownResult}
     */
    hit(bucket, id, rule) {
        return this._evaluate(bucket, id, rule, true);
    }

    /**
     * Same as hit() without consuming a use.
     * @returns {CooldownResult}
     */
    check(bucket, id, rule) {
        return this._evaluate(bucket, id, rule, false);
    }

    /**
     * Resets the cooldown of one id, or of the whole bucket when id is omitted.
     * @param {string} bucket
     * @param {string} [id]
     * @returns {number} Number of entries removed.
     */
    reset(bucket, id) {
        if (id !== undefined) return this._entries.delete(key(bucket, id)) ? 1 : 0;
        let removed = 0;
        const prefix = `${bucket}\u0000`;
        for (const k of this._entries.keys()) {
            if (k.startsWith(prefix)) { this._entries.delete(k); removed++; }
        }
        return removed;
    }

    /** Removes every cooldown. */
    clear() {
        this._entries.clear();
    }

    /** Purges expired entries. Called automatically every `sweepInterval`. */
    sweep() {
        const now = Date.now();
        for (const [k, entry] of this._entries) {
            if (entry.resetAt <= now) this._entries.delete(k);
        }
    }

    /** Stops the background sweep timer. */
    destroy() {
        if (this._timer) clearInterval(this._timer);
        this._timer = null;
    }

    /** @private */
    _evaluate(bucket, id, rule, consume) {
        if (!bucket || id === undefined || id === null || id === '') throw new TypeError('bucket and id are required');
        const { duration, uses } = normalizeRule(rule);
        const now = Date.now();
        const k = key(bucket, id);

        let entry = this._entries.get(k);
        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + duration };
            if (consume) this._entries.set(k, entry);
        }

        const blocked = entry.count >= uses;
        if (!blocked && consume) entry.count++;

        const used = entry.count;
        const remaining = blocked ? Math.max(0, entry.resetAt - now) : 0;
        return {
            ok: !blocked,
            remaining,
            remainingText: formatDuration(remaining, { long: true }),
            resetAt: entry.resetAt,
            usesLeft: Math.max(0, uses - used),
            limit: uses,
        };
    }
}

/**
 * @typedef {object} CooldownResult
 * @property {boolean} ok            - False when the cooldown is active.
 * @property {number}  remaining     - Ms until the cooldown ends (0 when ok).
 * @property {string}  remainingText - Human form of `remaining` ("4 seconds").
 * @property {number}  resetAt       - Epoch ms when the window resets.
 * @property {number}  usesLeft      - Uses left in the current window.
 * @property {number}  limit         - Uses allowed per window.
 */

function key(bucket, id) {
    return `${bucket}\u0000${id}`;
}

function normalizeRule(rule) {
    const obj = rule !== null && typeof rule === 'object' ? rule : { duration: rule };
    const duration = parseDuration(obj.duration);
    const uses = obj.uses === undefined ? 1 : obj.uses;
    if (!(duration > 0)) throw new TypeError('Cooldown duration must be positive');
    if (!Number.isInteger(uses) || uses < 1) throw new TypeError('Cooldown uses must be a positive integer');
    return { duration, uses };
}

module.exports = CooldownManager;
module.exports.normalizeRule = normalizeRule;
