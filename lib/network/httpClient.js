'use strict';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/** @returns {boolean} */
function isRetryable(err) {
    if (!(err instanceof HttpError)) return true; // network failure or timeout
    return err.status === 408 || err.status === 429 || err.status >= 500;
}

/**
 * Parses a Retry-After header (seconds or HTTP date) into milliseconds.
 * @returns {number|null}
 */
function parseRetryAfter(value) {
    if (!value) return null;
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(value);
    return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

/**
 * Supercharged HTTP Error object.
 */
class HttpError extends Error {
    constructor(status, message, url, data) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        this.url = url;
        this.data = data; // Usually the JSON error body
    }
}

/**
 * HTTP Client wrapped around native `fetch`.
 */
class httpClient {
    /**
     * Makes an HTTP request, automatically parsing JSON and handling HTTP errors.
     * @param {string} url - Target URL.
     * @param {object} [options]
     * @param {string} [options.method='GET']
     * @param {object} [options.headers]
     * @param {object} [options.query] - Query params object (appended to URL).
     * @param {object} [options.json] - JSON body to send.
     * @param {number} [options.retries=0] - Extra attempts on transient failures
     *                                       (network errors, timeouts, 408, 429, 5xx).
     * @param {number} [options.retryDelay=500] - Delay between retries in ms (a Retry-After header takes precedence).
     * @param {number} [options.maxRetryAfter=30000] - Upper bound in ms for honoring Retry-After.
     * @param {number} [options.timeout] - Timeout in milliseconds for the request.
     * @param {string} [options.bearer] - Bearer token for Auth header shortcut.
     * @returns {Promise<any>} The parsed JSON output (or text if no JSON).
     */
    static async request(url, options = {}) {
        const { 
            method = 'GET', 
            headers = {}, 
            query, 
            json, 
            retries = 0, 
            retryDelay = 500,
            maxRetryAfter = 30000,
            timeout,
            bearer,
            ...fetchOptions 
        } = options;

        let finalUrl = url;
        if (query) {
            const params = new URLSearchParams(query);
            finalUrl += (url.includes('?') ? '&' : '?') + params.toString();
        }

        const fetchConfig = {
            method,
            headers: { ...headers },
            ...fetchOptions
        };

        if (bearer) {
            fetchConfig.headers['Authorization'] = `Bearer ${bearer}`;
        }

        if (json) {
            fetchConfig.headers['Content-Type'] = 'application/json';
            fetchConfig.body = JSON.stringify(json);
        }

        // The core fetch call that throws HttpError if response.ok is false
        const makeCall = async () => {
            let timeoutId;
            if (timeout && typeof timeout === 'number') {
                const controller = new AbortController();
                fetchConfig.signal = controller.signal;
                timeoutId = setTimeout(() => controller.abort(), timeout);
            }

            let response;
            try {
                response = await fetch(finalUrl, fetchConfig);
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
            }
            
            // Try parsing JSON out of bounds to retrieve API error messages
            let responseData;
            const contentType = response.headers && response.headers.get('content-type');
            try {
                if (contentType && contentType.includes('application/json')) {
                    responseData = await response.json();
                } else {
                    responseData = await response.text();
                }
            } catch (_) { // Ignore parse errors
                responseData = null;
            }

            if (!response.ok) {
                const error = new HttpError(
                    response.status,
                    `HTTP ${response.status}: ${response.statusText}`,
                    finalUrl,
                    responseData
                );
                error.retryAfter = parseRetryAfter(response.headers && response.headers.get('retry-after'));
                throw error;
            }

            return responseData;
        };

        if (retries <= 0) return makeCall();

        // Only transient failures are retried: network errors, timeouts, 408, 429 and 5xx.
        // 4xx client errors (400, 401, 403, 404...) will fail the same way every time.
        for (let attempt = 0; ; attempt++) {
            try {
                return await makeCall();
            } catch (err) {
                if (attempt >= retries || !isRetryable(err)) throw err;
                const wait = err.retryAfter != null ? Math.min(err.retryAfter, maxRetryAfter) : retryDelay;
                if (wait > 0) await sleep(wait);
            }
        }
    }

    static get(url, options = {})    { return this.request(url, { ...options, method: 'GET' }); }
    static post(url, options = {})   { return this.request(url, { ...options, method: 'POST' }); }
    static put(url, options = {})    { return this.request(url, { ...options, method: 'PUT' }); }
    static delete(url, options = {}) { return this.request(url, { ...options, method: 'DELETE' }); }
}

httpClient.HttpError = HttpError;

module.exports = httpClient;
