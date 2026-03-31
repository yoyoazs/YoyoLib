'use strict';

const EventBus = require('../eventBus/EventBus');

/**
 * An In-Memory Asynchronous Job Queue with concurrency limits.
 * Emits 'start', 'end', 'error', 'drain' events via its internal EventBus.
 */
class JobQueue {
    /**
     * @param {object} [options]
     * @param {number} [options.concurrency=1] - Maximum concurrent running jobs
     */
    constructor({ concurrency = 1 } = {}) {
        if (typeof concurrency !== 'number' || concurrency <= 0) {
            throw new TypeError('Concurrency must be >= 1');
        }
        this.concurrency = concurrency;
        
        /** @type {Array<{ taskFn: () => Promise<any>, resolve: Function, reject: Function }>} */
        this._queue = [];
        this._activeCount = 0;
        
        this.events = new EventBus();
    }

    /**
     * Adds an async job to the queue and returns a Promise that resolves when the job completes.
     * @param {() => Promise<any>} taskFn - The async function to execute.
     * @returns {Promise<any>}
     */
    push(taskFn) {
        if (typeof taskFn !== 'function') throw new TypeError('Task must be a function');
        
        return new Promise((resolve, reject) => {
            this._queue.push({ taskFn, resolve, reject });
            this._processNext();
        });
    }

    /**
     * Clears all pending jobs in the queue.
     */
    clear() {
        this._queue.length = 0;
    }

    /**
     * How many jobs are waiting to run?
     */
    get waiting() {
        return this._queue.length;
    }

    /**
     * How many jobs are currently executing?
     */
    get active() {
        return this._activeCount;
    }

    /** @private */
    async _processNext() {
        if (this._activeCount >= this.concurrency || this._queue.length === 0) {
            return;
        }

        const item = this._queue.shift();
        this._activeCount++;
        
        this.events.emit('start');

        try {
            const result = await item.taskFn();
            item.resolve(result);
            this.events.emit('end');
        } catch (error) {
            item.reject(error);
            this.events.emit('error', error);
        } finally {
            this._activeCount--;

            if (this._activeCount === 0 && this._queue.length === 0) {
                this.events.emit('drain');
            } else {
                this._processNext();
            }
        }
    }
}

module.exports = JobQueue;
