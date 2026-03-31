'use strict';

/**
 * Orchestrates a graceful shutdown of the application.
 * Listens for SIGINT (Ctrl+C) and SIGTERM (Docker/PM2) and runs cleanup tasks.
 */
class ShutdownManager {
    /**
     * @param {object} [options]
     * @param {number} [options.timeout=10000] - Max time in ms to wait for cleanup tasks
     * @param {boolean} [options.log=true] - Whether to log shutdown progress to console
     */
    constructor({ timeout = 10000, log = true } = {}) {
        this.timeout = timeout;
        this.log = log;
        this._tasks = new Map();
        this._isShuttingDown = false;
    }

    /**
     * Registers a cleanup task to run before exit.
     * @param {string} name - Task name for logging
     * @param {Function} taskFn - The cleanup function (can be async)
     */
    register(name, taskFn) {
        if (typeof taskFn !== 'function') throw new TypeError('Task must be a function');
        this._tasks.set(name, taskFn);
    }

    /**
     * Starts listening for termination signals.
     */
    listen() {
        ['SIGINT', 'SIGTERM'].forEach(signal => {
            process.on(signal, () => this.shutdown(signal));
        });
    }

    /**
     * Manually triggers a graceful shutdown.
     * @param {string} [signal='MANUAL'] 
     */
    async shutdown(signal = 'MANUAL') {
        if (this._isShuttingDown) return;
        this._isShuttingDown = true;

        if (this.log) {
            console.log(`\n\x1b[33m[ShutdownManager]\x1b[0m Received ${signal}. Starting graceful shutdown...`);
        }

        const forceExit = setTimeout(() => {
            if (this.log) {
                console.error(`\x1b[31m[ShutdownManager]\x1b[0m Shutdown timed out after ${this.timeout}ms. Forcing exit...`);
            }
            process.exit(1);
        }, this.timeout);

        const tasks = Array.from(this._tasks.entries());
        
        for (const [name, taskFn] of tasks) {
            if (this.log) {
                process.stdout.write(`  \x1b[90m- Cleaning up:\x1b[0m ${name}... `);
            }
            try {
                await taskFn();
                if (this.log) {
                    process.stdout.write(`\x1b[32mOK\x1b[0m\n`);
                }
            } catch (err) {
                if (this.log) {
                    process.stdout.write(`\x1b[31mFAILED\x1b[0m (${err.message})\n`);
                }
            }
        }

        clearTimeout(forceExit);
        if (this.log) {
            console.log(`\x1b[32m[ShutdownManager]\x1b[0m Graceful shutdown completed. Goodbye!\n`);
        }
        process.exit(0);
    }
}

module.exports = ShutdownManager;
