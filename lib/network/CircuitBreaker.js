'use strict';

/**
 * A Circuit Breaker for asynchronous operations.
 * Prevents cascading failures when integrating with external services.
 */
class CircuitBreaker {
    /**
     * @param {Function} action - Async function to wrap
     * @param {object} [options]
     * @param {number} [options.failureThreshold=3] - Max consecutive failures before opening circuit
     * @param {number} [options.resetTimeout=10000] - Ms to wait before Half-Open state test
     */
    constructor(action, { failureThreshold = 3, resetTimeout = 10000 } = {}) {
        this.action = action;
        this.failureThreshold = failureThreshold;
        this.resetTimeout = resetTimeout;
        
        this.state = 'CLOSED'; // 'CLOSED', 'OPEN', 'HALF_OPEN'
        this.failures = 0;
        this.nextAttemptAt = 0;
    }

    /**
     * Executes the protected action.
     * @param  {...any} args - Arguments to pass to the action
     * @returns {Promise<any>}
     */
    async fire(...args) {
        if (this.state === 'OPEN') {
            if (Date.now() > this.nextAttemptAt) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('CircuitBreaker is OPEN: Failing fast to prevent cascading failures');
            }
        }

        try {
            const result = await this.action(...args);
            // On success, reset the breaker
            this.failures = 0;
            this.state = 'CLOSED';
            return result;
        } catch (error) {
            this.failures++;
            if (this.failures >= this.failureThreshold) {
                this.state = 'OPEN';
                this.nextAttemptAt = Date.now() + this.resetTimeout;
            }
            throw error; // Propagate the original error
        }
    }
}

module.exports = CircuitBreaker;
