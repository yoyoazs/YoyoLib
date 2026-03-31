'use strict';

class EventBus {
    constructor() {
        /** @type {Map<string, Set<Function>>} */
        this._listeners = new Map();
        /** @type {Map<string, Set<Function>>} */
        this._onceListeners = new Map();
    }

    /**
     * Subscribes a handler to an event. Multiple handlers per event are supported.
     * @param {string}   event   - Event name.
     * @param {Function} handler - Callback function.
     * @returns {EventBus} this (chainable)
     * @throws {TypeError}
     */
    on(event, handler) {
        this._validateArgs(event, handler);
        if (!this._listeners.has(event)) this._listeners.set(event, new Set());
        this._listeners.get(event).add(handler);
        return this;
    }

    /**
     * Subscribes a handler that fires only once, then auto-unsubscribes.
     * @param {string}   event
     * @param {Function} handler
     * @returns {EventBus} this (chainable)
     * @throws {TypeError}
     */
    once(event, handler) {
        this._validateArgs(event, handler);
        if (!this._onceListeners.has(event)) this._onceListeners.set(event, new Set());
        this._onceListeners.get(event).add(handler);
        return this;
    }

    /**
     * Unsubscribes a specific handler from an event.
     * @param {string}   event
     * @param {Function} handler
     * @returns {boolean} - True if the handler was found and removed.
     */
    off(event, handler) {
        let removed = false;
        if (this._listeners.has(event))
            removed = this._listeners.get(event).delete(handler) || removed;
        if (this._onceListeners.has(event))
            removed = this._onceListeners.get(event).delete(handler) || removed;
        return removed;
    }

    /**
     * Emits an event, calling all registered handlers with the provided data.
     * @param {string} event
     * @param {...*}   args  - Arguments passed to each handler.
     * @returns {number} - Number of handlers called.
     */
    emit(event, ...args) {
        let count = 0;

        if (this._listeners.has(event)) {
            for (const handler of this._listeners.get(event)) {
                handler(...args);
                count++;
            }
        }

        if (this._onceListeners.has(event)) {
            for (const handler of this._onceListeners.get(event)) {
                handler(...args);
                count++;
            }
            this._onceListeners.delete(event);
        }

        return count;
    }

    /**
     * Emits an event asynchronously, resolving when all handlers (which may return Promises) finish.
     * @param {string} event
     * @param {...*}   args
     * @returns {Promise<any[]>} - Resolves with an array of values returned by the handlers.
     */
    async emitAsync(event, ...args) {
        const promises = [];

        if (this._listeners.has(event)) {
            for (const handler of this._listeners.get(event)) {
                promises.push(handler(...args));
            }
        }

        if (this._onceListeners.has(event)) {
            for (const handler of this._onceListeners.get(event)) {
                promises.push(handler(...args));
            }
            this._onceListeners.delete(event);
        }

        return Promise.all(promises);
    }

    /**
     * Removes all handlers for a specific event, or all events if no event is given.
     * @param {string} [event]
     * @returns {EventBus} this (chainable)
     */
    clear(event) {
        if (event) {
            this._listeners.delete(event);
            this._onceListeners.delete(event);
        } else {
            this._listeners.clear();
            this._onceListeners.clear();
        }
        return this;
    }

    /**
     * Returns the number of active listeners for an event.
     * @param {string} event
     * @returns {number}
     */
    listenerCount(event) {
        const regular = this._listeners.has(event) ? this._listeners.get(event).size : 0;
        const once    = this._onceListeners.has(event) ? this._onceListeners.get(event).size : 0;
        return regular + once;
    }

    /**
     * Returns an array of all registered event names.
     * @returns {string[]}
     */
    eventNames() {
        const names = new Set([
            ...this._listeners.keys(),
            ...this._onceListeners.keys(),
        ]);
        return [...names];
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    /** @private */
    _validateArgs(event, handler) {
        if (!event || typeof event !== 'string') throw new TypeError('Event name must be a non-empty string');
        if (typeof handler !== 'function')        throw new TypeError('Handler must be a function');
    }
}

module.exports = EventBus;
