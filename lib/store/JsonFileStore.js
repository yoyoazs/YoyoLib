'use strict';

const fs = require('fs');
const path = require('path');
const MemoryStore = require('./MemoryStore');

/**
 * MemoryStore persisted to a JSON file: data survives restarts without a database.
 * Good fit for small bots and single-process apps (use RedisStore for several processes).
 *
 * Writes are batched (`writeDelay`) and atomic (temp file + rename), so a crash never leaves
 * a half-written file. Call close() (e.g. from ShutdownManager) to flush pending writes on exit.
 */
class JsonFileStore extends MemoryStore {
    /**
     * @param {object} [options]
     * @param {string} [options.file='data/store.json'] - JSON file path (relative to cwd).
     * @param {number} [options.writeDelay=100] - Batch writes happening within this delay (ms). 0 writes synchronously.
     * @param {number} [options.sweepInterval=60000]
     */
    constructor({ file = 'data/store.json', writeDelay = 100, sweepInterval = 60000 } = {}) {
        super({ sweepInterval });
        this.file = path.resolve(process.cwd(), file);
        this._writeDelay = writeDelay;
        this._writeTimer = null;
        this._load();
    }

    async set(key, value, ttlMs) {
        await super.set(key, value, ttlMs);
        this._scheduleSave();
    }

    async delete(key) {
        const removed = await super.delete(key);
        if (removed) this._scheduleSave();
        return removed;
    }

    async increment(key, ttlMs, by = 1) {
        const res = await super.increment(key, ttlMs, by);
        this._scheduleSave();
        return res;
    }

    async deleteByPrefix(prefix) {
        const removed = await super.deleteByPrefix(prefix);
        if (removed) this._scheduleSave();
        return removed;
    }

    /** Writes pending changes now. */
    flush() {
        if (this._writeTimer) clearTimeout(this._writeTimer);
        this._writeTimer = null;
        this._save();
    }

    /** Flushes pending writes and stops timers. */
    close() {
        this.flush();
        super.close();
    }

    /** @private */
    _scheduleSave() {
        if (this._writeDelay <= 0) return this._save();
        if (this._writeTimer) return;
        this._writeTimer = setTimeout(() => {
            this._writeTimer = null;
            this._save();
        }, this._writeDelay);
    }

    /** @private */
    _save() {
        const now = Date.now();
        const out = {};
        for (const [key, entry] of this._data) {
            if (entry.expiresAt === null || entry.expiresAt > now) out[key] = entry;
        }
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        const tmp = `${this.file}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(out));
        fs.renameSync(tmp, this.file);
    }

    /** @private */
    _load() {
        if (!fs.existsSync(this.file)) return;
        let raw;
        try {
            raw = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        } catch (err) {
            // Never silently start empty and overwrite the user's data on the next write
            throw new Error(`JsonFileStore: cannot parse ${this.file}: ${err.message}`);
        }
        const now = Date.now();
        for (const [key, entry] of Object.entries(raw || {})) {
            if (!entry || typeof entry !== 'object' || !('value' in entry)) continue;
            const expiresAt = typeof entry.expiresAt === 'number' ? entry.expiresAt : null;
            if (expiresAt === null || expiresAt > now) this._data.set(key, { value: entry.value, expiresAt });
        }
    }
}

module.exports = JsonFileStore;
