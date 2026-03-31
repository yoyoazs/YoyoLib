'use strict';

const { retry } = require('../utils/helpers');

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
     * @param {number} [options.retries=0] - Tries natively based on our retry wrapper.
     * @param {number} [options.retryDelay=500] - Delay between retries in ms.
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
            const contentType = response.headers.get('content-type');
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
                throw new HttpError(
                    response.status, 
                    `HTTP ${response.status}: ${response.statusText}`, 
                    finalUrl, 
                    responseData
                );
            }

            return responseData;
        };

        // If retries requested, use the retry wrapper
        if (retries > 0) {
            return retry(makeCall, { attempts: retries + 1, delay: retryDelay });
        }
        
        return makeCall();
    }

    static get(url, options = {})    { return this.request(url, { ...options, method: 'GET' }); }
    static post(url, options = {})   { return this.request(url, { ...options, method: 'POST' }); }
    static put(url, options = {})    { return this.request(url, { ...options, method: 'PUT' }); }
    static delete(url, options = {}) { return this.request(url, { ...options, method: 'DELETE' }); }
}

module.exports = httpClient;
