'use strict';

class Scheduler {
    constructor() {
        /** @type {Map<string, NodeJS.Timeout>} */
        this._tasks = new Map();
    }

    /**
     * Runs a function repeatedly every `seconds`.
     * If the task name already exists, it is stopped and replaced.
     * @param {string} name - Unique identifier for the task.
     * @param {number} seconds - Interval in seconds.
     * @param {Function} callback - The function to execute.
     * @returns {Scheduler} this for chaining.
     */
    every(name, seconds, callback) {
        if (!name || typeof name !== 'string') throw new TypeError('Task name must be a string');
        if (typeof seconds !== 'number' || seconds <= 0) throw new TypeError('Interval must be a positive number of seconds');
        if (typeof callback !== 'function') throw new TypeError('Callback must be a function');

        this.stop(name);
        
        const intervalId = setInterval(callback, seconds * 1000);
        this._tasks.set(name, intervalId);
        
        return this;
    }

    /**
     * Stops a specific task by name.
     * @param {string} name
     * @returns {boolean} True if a task was stopped, false otherwise.
     */
    stop(name) {
        const intervalId = this._tasks.get(name);
        if (intervalId) {
            clearInterval(intervalId);
            this._tasks.delete(name);
            return true;
        }
        return false;
    }

    /**
     * Lists all active scheduled task names.
     * @returns {string[]}
     */
    list() {
        return Array.from(this._tasks.keys());
    }

    /**
     * Stops and removes all scheduled tasks.
     * @returns {Scheduler} this for chaining.
     */
    clear() {
        for (const [name, intervalId] of this._tasks.entries()) {
            clearInterval(intervalId);
        }
        this._tasks.clear();
        return this;
    }
}

module.exports = Scheduler;
