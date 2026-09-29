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
     * @param {'auto'|'discord'|'slack'|'raw'|Function} [options.format='auto']
     *        Payload format. 'auto' detects Discord/Slack from the URL; a function receives
     *        the raw report and returns the body to send.
     */
    constructor(webhookUrl, { appName = 'YoyoLibApp', contextTracker = null, format = 'auto' } = {}) {
        if (!webhookUrl || typeof webhookUrl !== 'string') {
            throw new TypeError('webhookUrl is required for ErrorReporter');
        }
        this.webhookUrl = webhookUrl;
        this.appName = appName;
        this.contextTracker = contextTracker;
        this.format = format === 'auto' ? detectFormat(webhookUrl) : format;
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

        const report = {
            appName: this.appName,
            message: errObj.message,
            stack: errObj.stack,
            context
        };

        try {
            await httpClient.post(this.webhookUrl, { json: this.buildPayload(report) });
        } catch (reportErr) {
            // We don't want to crash the whole app if reporting itself fails
            console.error('[ErrorReporter] Failed to send report:', reportErr.message);
        }
    }

    /**
     * Converts a raw report into the body expected by the configured webhook.
     * @param {{ appName: string, message: string, stack: string, context: object }} report
     * @returns {object}
     */
    buildPayload(report) {
        if (typeof this.format === 'function') return this.format(report);

        const contextStr = safeStringify(report.context);
        if (this.format === 'discord') {
            return {
                username: truncate(report.appName, 80),
                embeds: [{
                    title: truncate(`❌ ${report.message || 'Error'}`, 256),
                    description: '```\n' + truncate(report.stack || report.message, 4000) + '\n```',
                    color: 0xE74C3C,
                    fields: [{ name: 'Context', value: '```json\n' + truncate(contextStr, 1000) + '\n```' }],
                    timestamp: report.context.timestamp,
                }],
            };
        }
        if (this.format === 'slack') {
            return {
                text: `*[${report.appName}]* ${report.message}\n\`\`\`${truncate(report.stack || '', 2500)}\`\`\`\n\`\`\`${truncate(contextStr, 1000)}\`\`\``,
            };
        }
        return report;
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

function detectFormat(url) {
    if (/^https:\/\/(?:[\w-]+\.)?discord(?:app)?\.com\/api\/(?:v\d+\/)?webhooks\//i.test(url)) return 'discord';
    if (/^https:\/\/hooks\.slack\.com\//i.test(url)) return 'slack';
    return 'raw';
}

function truncate(str, max) {
    str = String(str);
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function safeStringify(value) {
    const seen = new WeakSet();
    try {
        return JSON.stringify(value, (_, v) => {
            if (typeof v === 'object' && v !== null) {
                if (seen.has(v)) return '[Circular]';
                seen.add(v);
            }
            return v;
        }, 2);
    } catch (_) {
        return String(value);
    }
}

module.exports = ErrorReporter;
