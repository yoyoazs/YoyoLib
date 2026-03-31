'use strict';

const httpClient = require('../network/httpClient');

/**
 * A module to catch and report errors to a remote webhook (Discord, Slack, etc.).
 * Essential for monitoring SaaS applications in production.
 */
class ErrorReporter {
    /**
     * @param {string} webhookUrl - URL to send POST requests to
     * @param {object} [options]
     * @param {string} [options.appName='YoyoLibApp'] - App name displayed in reports
     * @param {object} [options.contextTracker] - Optional ContextTracker instance to enrich reports
     */
    constructor(webhookUrl, { appName = 'YoyoLibApp', contextTracker = null } = {}) {
        if (!webhookUrl || typeof webhookUrl !== 'string') {
            throw new TypeError('webhookUrl is required for ErrorReporter');
        }
        this.webhookUrl = webhookUrl;
        this.appName = appName;
        this.contextTracker = contextTracker;
    }

    /**
     * Reports an error manually.
     * @param {Error|string} error 
     * @param {object} [extraContext] 
     * @returns {Promise<void>}
     */
    async report(error, extraContext = {}) {
        const errObj = error instanceof Error ? error : new Error(String(error));
        const context = {
            appName: this.appName,
            timestamp: new Date().toISOString(),
            ...extraContext
        };

        // Enrich with ContextTracker if available
        if (this.contextTracker) {
            const alsContext = this.contextTracker.get();
            if (alsContext) {
                context.alsContext = alsContext;
            }
        }

        const payload = {
            appName: this.appName,
            message: errObj.message,
            stack: errObj.stack,
            context
        };

        try {
            await httpClient.post(this.webhookUrl, { json: payload });
        } catch (reportErr) {
            // We don't want to crash the whole app if reporting itself fails
            console.error('[ErrorReporter] Failed to send report:', reportErr.message);
        }
    }

    /**
     * Wraps an asynchronous function to automatically report any uncaught errors.
     * @param {Function} asyncFn - Async function to wrap
     * @returns {Function} Wrapped async function
     */
    wrap(asyncFn) {
        return async (...args) => {
            try {
                return await asyncFn(...args);
            } catch (error) {
                await this.report(error, { type: 'wrapped_async_error' });
                throw error; // Rethrow so the usual app logic handles it too
            }
        };
    }

    /**
     * Captures a synchronous function call.
     * @param {Function} fn 
     * @param  {...any} args 
     * @returns {any}
     */
    capture(fn, ...args) {
        try {
            return fn(...args);
        } catch (error) {
            this.report(error, { type: 'captured_sync_error' });
            throw error;
        }
    }

    /**
     * Installs global error handlers for uncaughtException and unhandledRejection.
     */
    initGlobalHandler() {
        process.on('uncaughtException', async (error) => {
            console.error('[ErrorReporter] Global Uncaught Exception:', error);
            await this.report(error, { type: 'uncaught_exception', fatal: true });
            // By default Node.js exits on uncaughtException, we keep this behavior for stability
            process.exit(1);
        });

        process.on('unhandledRejection', async (reason) => {
            console.error('[ErrorReporter] Global Unhandled Rejection:', reason);
            await this.report(reason, { type: 'unhandled_rejection' });
        });
    }
}

module.exports = ErrorReporter;
