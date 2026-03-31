'use strict';

const { AsyncLocalStorage } = require('async_hooks');

/**
 * A simple context tracker using Node.js AsyncLocalStorage.
 * Essential for tracking request IDs, user sessions, etc. across async calls 
 * without passing them through every function argument.
 */
class ContextTracker {
    constructor() {
        this.als = new AsyncLocalStorage();
    }

    /**
     * Executes a function within a new context.
     * @param {object} context - The context object to store
     * @param {Function} callback - Function to execute
     * @returns {any}
     */
    run(context, callback) {
        if (!context || typeof context !== 'object') throw new TypeError('Context must be an object');
        return this.als.run(context, callback);
    }

    /**
     * Gets a value from the current context.
     * @param {string} [key] - Key to retrieve. If null, returns the full context object.
     * @returns {any}
     */
    get(key) {
        const store = this.als.getStore();
        if (!store) return undefined;
        return key ? store[key] : store;
    }

    /**
     * Updates/Sets a value in the current context.
     * @param {string} key 
     * @param {any} value 
     */
    set(key, value) {
        const store = this.als.getStore();
        if (store) {
            store[key] = value;
        }
    }
}

module.exports = ContextTracker;
