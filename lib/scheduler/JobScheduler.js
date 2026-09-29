'use strict';

const crypto = require('crypto');
const MemoryStore = require('../store/MemoryStore');
const { parseDuration } = require('../utils/duration');

/**
 * Persistent one-off jobs ("unmute this user in 2 hours", "end the giveaway on Friday").
 * Jobs are saved in a Store, so they survive restarts: overdue jobs run as soon as start() is called.
 *
 * With a shared store (RedisStore), several processes can run the scheduler: each job is claimed
 * with an atomic lock, so it runs once. Delivery is at-least-once: if a process crashes while
 * running a job, the job runs again after `lockTtl`. Make handlers idempotent.
 *
 * The store must implement `entries(prefix)` (MemoryStore, JsonFileStore and RedisStore do).
 */
class JobScheduler {
    /**
     * @param {object} [options]
     * @param {object} [options.store]               - Store (default MemoryStore: jobs are lost on restart!).
     * @param {string|number} [options.pollInterval='5s'] - How often the store is checked for due jobs.
     * @param {number} [options.maxAttempts=3]        - Attempts before a failing job is dropped.
     * @param {string|number} [options.retryDelay='30s'] - First retry delay, doubled at each attempt.
     * @param {string|number} [options.lockTtl='5m']  - Max run time before another process may retry the job.
     * @param {number} [options.concurrency=5]        - Jobs run in parallel per tick.
     * @param {string} [options.namespace='jobs']
     * @param {(error: Error, job: object, final: boolean) => void} [options.onError] - Default: console.error.
     */
    constructor({
        store, pollInterval = '5s', maxAttempts = 3, retryDelay = '30s', lockTtl = '5m',
        concurrency = 5, namespace = 'jobs', onError,
    } = {}) {
        this.store = store || new MemoryStore();
        if (typeof this.store.entries !== 'function') throw new TypeError('JobScheduler needs a store implementing entries(prefix)');
        this._pollMs = parseDuration(pollInterval);
        this._maxAttempts = maxAttempts;
        this._retryMs = parseDuration(retryDelay);
        this._lockMs = parseDuration(lockTtl);
        this._concurrency = Math.max(1, concurrency);
        this._ns = namespace;
        this._onError = typeof onError === 'function'
            ? onError
            : (error, job, final) => console.error(`[JobScheduler] Job "${job.name}" (${job.id}) failed${final ? ' permanently' : ''}:`, error);
        /** @type {Map<string, Function>} */
        this._handlers = new Map();
        this._running = false;
        this._pollTimer = null;
        this._wakeTimers = new Set();
        this._tickPromise = null;
        this._tickAgain = false;
    }

    /**
     * Registers the function that runs jobs of a given name.
     * @param {string} name
     * @param {(payload: any, job: object) => any} handler
     * @returns {this}
     */
    define(name, handler) {
        if (!name || typeof name !== 'string') throw new TypeError('Job name must be a string');
        if (typeof handler !== 'function') throw new TypeError('Job handler must be a function');
        this._handlers.set(name, handler);
        return this;
    }

    /**
     * Schedules a job at a date.
     * @param {string} name
     * @param {Date|number} date - Date or epoch ms.
     * @param {any} [payload={}] - JSON-serializable data given to the handler.
     * @param {object} [options]
     * @param {string} [options.id] - Stable id (e.g. `unmute:${guildId}:${userId}`): scheduling again replaces the job.
     * @param {number} [options.maxAttempts]
     * @returns {Promise<Job>}
     */
    async scheduleAt(name, date, payload = {}, { id, maxAttempts } = {}) {
        if (!name || typeof name !== 'string') throw new TypeError('Job name must be a string');
        const runAt = date instanceof Date ? date.getTime() : date;
        if (!Number.isFinite(runAt)) throw new TypeError('Invalid date');

        const job = {
            id: id ? String(id) : crypto.randomUUID(),
            name,
            runAt,
            payload: payload === undefined ? {} : JSON.parse(JSON.stringify(payload)),
            attempts: 0,
            maxAttempts: maxAttempts || this._maxAttempts,
            createdAt: Date.now(),
            version: crypto.randomBytes(6).toString('hex'),
        };
        await this.store.set(this._jobKey(job.id), job);
        this._wakeAt(runAt);
        return { ...job };
    }

    /**
     * Schedules a job after a delay ('10m', '2h', 3000).
     * @param {string} name
     * @param {string|number} delay
     * @param {any} [payload]
     * @param {object} [options] - Same as scheduleAt().
     * @returns {Promise<Job>}
     */
    scheduleIn(name, delay, payload, options) {
        return this.scheduleAt(name, Date.now() + parseDuration(delay), payload, options);
    }

    /**
     * Cancels a pending job.
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    cancel(id) {
        return this.store.delete(this._jobKey(id));
    }

    /**
     * @param {string} id
     * @returns {Promise<Job|null>}
     */
    async get(id) {
        const job = await this.store.get(this._jobKey(id));
        return job ? { ...job } : null;
    }

    /**
     * Pending jobs, soonest first.
     * @param {string} [name] - Only jobs with this name.
     * @returns {Promise<Job[]>}
     */
    async list(name) {
        const entries = await this.store.entries(`${this._ns}:job:`);
        return entries
            .map(([, job]) => job)
            .filter(job => job && (!name || job.name === name))
            .sort((a, b) => a.runAt - b.runAt)
            .map(job => ({ ...job }));
    }

    /** Starts polling; overdue jobs (e.g. missed while offline) run right away. */
    start() {
        if (this._running) return this;
        this._running = true;
        this._pollTimer = setInterval(() => { this.tick(); }, this._pollMs);
        if (typeof this._pollTimer.unref === 'function') this._pollTimer.unref();
        this.tick();
        return this;
    }

    /** Stops polling and waits for running jobs. */
    async stop() {
        this._running = false;
        clearInterval(this._pollTimer);
        for (const t of this._wakeTimers) clearTimeout(t);
        this._wakeTimers.clear();
        if (this._tickPromise) await this._tickPromise;
    }

    /**
     * Runs every due job once. Called automatically after start(); useful in tests.
     * @returns {Promise<void>}
     */
    tick() {
        if (this._tickPromise) {
            this._tickAgain = true;
            return this._tickPromise;
        }
        this._tickPromise = (async () => {
            try {
                do {
                    this._tickAgain = false;
                    await this._runDue();
                } while (this._tickAgain);
            } finally {
                this._tickPromise = null;
            }
        })();
        return this._tickPromise;
    }

    /** @private */
    async _runDue() {
        let due;
        try {
            const now = Date.now();
            due = (await this.list()).filter(job => job.runAt <= now && this._handlers.has(job.name));
        } catch (error) {
            this._onError(error, { id: '-', name: 'store' }, false);
            return;
        }
        for (let i = 0; i < due.length; i += this._concurrency) {
            await Promise.all(due.slice(i, i + this._concurrency).map(job => this._run(job)));
        }
    }

    /** @private */
    async _run(job) {
        const lockKey = `${this._ns}:lock:${job.id}`;
        let locked = false;
        try {
            const { value } = await this.store.increment(lockKey, this._lockMs);
            if (value !== 1) return; // another process (or tick) is running it
            locked = true;

            // Re-read: the job may have been cancelled or rescheduled meanwhile
            const current = await this.store.get(this._jobKey(job.id));
            if (!current || current.version !== job.version || current.runAt > Date.now()) return;

            try {
                await this._handlers.get(job.name)(JSON.parse(JSON.stringify(current.payload)), { ...current });
                await this._deleteIfUnchanged(current);
            } catch (error) {
                const attempts = current.attempts + 1;
                const final = attempts >= current.maxAttempts;
                if (final) {
                    await this._deleteIfUnchanged(current);
                } else {
                    const latest = await this.store.get(this._jobKey(job.id));
                    if (latest && latest.version === current.version) {
                        await this.store.set(this._jobKey(job.id), {
                            ...current,
                            attempts,
                            lastError: error && error.message,
                            runAt: Date.now() + this._retryMs * 2 ** (attempts - 1),
                        });
                    }
                }
                this._onError(error, { ...current, attempts }, final);
            }
        } catch (error) {
            this._onError(error, job, false);
        } finally {
            if (locked) await this.store.delete(lockKey).catch(() => {});
        }
    }

    /** @private Deletes a job unless it was rescheduled while running. */
    async _deleteIfUnchanged(job) {
        const latest = await this.store.get(this._jobKey(job.id));
        if (latest && latest.version === job.version) await this.store.delete(this._jobKey(job.id));
    }

    /** @private Runs a tick early when a job is due before the next poll. */
    _wakeAt(runAt) {
        if (!this._running) return;
        const delay = Math.max(0, runAt - Date.now());
        if (delay >= this._pollMs) return;
        const timer = setTimeout(() => { this._wakeTimers.delete(timer); this.tick(); }, delay);
        if (typeof timer.unref === 'function') timer.unref();
        this._wakeTimers.add(timer);
    }

    /** @private */
    _jobKey(id) {
        return `${this._ns}:job:${id}`;
    }
}

/**
 * @typedef {object} Job
 * @property {string} id
 * @property {string} name
 * @property {number} runAt       - Epoch ms.
 * @property {any}    payload
 * @property {number} attempts
 * @property {number} maxAttempts
 * @property {number} createdAt
 * @property {string} [lastError]
 */

module.exports = JobScheduler;
