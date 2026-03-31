'use strict';

/**
 * Centralized health monitoring for SaaS applications.
 * Aggregates status from various services (DB, Cache, External APIs).
 */
class HealthChecker {
    constructor() {
        this._checkers = new Map();
    }

    /**
     * Registers a health check task.
     * @param {string} name - Service name (e.g., 'database')
     * @param {Function} checkFn - Function returning boolean or Promise<boolean>
     */
    register(name, checkFn) {
        if (typeof checkFn !== 'function') throw new TypeError('Check must be a function');
        this._checkers.set(name, checkFn);
    }

    /**
     * Executes all registered health checks and returns a global status report.
     * @returns {Promise<object>}
     */
    async getStatus() {
        const results = {};
        let isGlobalUp = true;
        
        const startTime = Date.now();
        const checks = Array.from(this._checkers.entries());
        
        await Promise.all(checks.map(async ([name, checkFn]) => {
            try {
                const isUp = await checkFn();
                results[name] = isUp ? 'UP' : 'DOWN';
                if (!isUp) isGlobalUp = false;
            } catch (err) {
                results[name] = `ERROR (${err.message})`;
                isGlobalUp = false;
            }
        }));

        return {
            status: isGlobalUp ? 'UP' : 'DOWN',
            timestamp: new Date().toISOString(),
            uptime: Math.floor(process.uptime()),
            latency_ms: Date.now() - startTime,
            services: results
        };
    }
}

module.exports = HealthChecker;
