'use strict';

// ─── retry ────────────────────────────────────────────────────────────────────

/**
 * Retries an async function up to `attempts` times with an optional delay.
 *
 * @template T
 * @param {() => Promise<T>} fn               - Async function to retry.
 * @param {object}           [options]
 * @param {number}           [options.attempts=3]  - Max number of attempts (including the first).
 * @param {number}           [options.delay=0]     - Delay in ms between attempts.
 * @param {number}           [options.factor=1]    - Backoff multiplier applied to delay each retry.
 * @param {Function}         [options.onRetry]     - Called on each retry: (error, attempt) => void.
 * @returns {Promise<T>}
 * @throws The last error if all attempts fail.
 *
 * @example
 * const data = await retry(() => fetch('https://api.example.com'), { attempts: 3, delay: 500 });
 */
async function retry(fn, { attempts = 3, delay = 0, factor = 1, onRetry } = {}) {
    let lastError;
    let currentDelay = delay;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) {
                if (typeof onRetry === 'function') onRetry(err, attempt);
                if (currentDelay > 0) await _sleep(currentDelay);
                currentDelay = Math.round(currentDelay * factor);
            }
        }
    }
    throw lastError;
}

// ─── throttle ─────────────────────────────────────────────────────────────────

/**
 * Returns a throttled version of `fn` that can only be called at most once per `ms`.
 * The first call fires immediately. Subsequent calls within the window are dropped.
 *
 * @param {Function} fn - Function to throttle.
 * @param {number}   ms - Minimum interval in milliseconds.
 * @returns {Function}
 *
 * @example
 * const throttled = throttle(() => console.log('ping'), 500);
 * window.addEventListener('mousemove', throttled);
 */
function throttle(fn, ms) {
    if (typeof fn !== 'function') throw new TypeError('fn must be a function');
    if (typeof ms !== 'number' || ms < 0) throw new TypeError('ms must be a non-negative number');

    let lastCall = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastCall >= ms) {
            lastCall = now;
            return fn.apply(this, args);
        }
    };
}

// ─── debounce ─────────────────────────────────────────────────────────────────

/**
 * Returns a debounced version of `fn` that delays invoking until after `ms`
 * milliseconds have elapsed since the last call.
 * Supports `leading` mode (fires on the first call instead of the last).
 *
 * @param {Function} fn                  - Function to debounce.
 * @param {number}   ms                  - Delay in milliseconds.
 * @param {object}   [options]
 * @param {boolean}  [options.leading=false] - If true, fires on the leading edge.
 * @returns {Function & { cancel: () => void, flush: () => void }}
 *
 * @example
 * const save = debounce(() => api.save(), 300);
 * input.addEventListener('input', save);
 * // cancel a pending call:
 * save.cancel();
 */
function debounce(fn, ms, { leading = false } = {}) {
    if (typeof fn !== 'function') throw new TypeError('fn must be a function');
    if (typeof ms !== 'number' || ms < 0) throw new TypeError('ms must be a non-negative number');

    let timer      = null;
    let lastArgs   = null;
    let lastThis   = null;
    let called     = false;

    function debounced(...args) {
        lastArgs = args;
        lastThis = this;

        if (leading && !called) {
            called = true;
            fn.apply(lastThis, lastArgs);
        }

        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer  = null;
            called = false;
            if (!leading) fn.apply(lastThis, lastArgs);
        }, ms);
    }

    /** Cancels the pending invocation. */
    debounced.cancel = () => {
        if (timer) { clearTimeout(timer); timer = null; }
        called = false;
    };

    /** Immediately invokes the pending call (if any). */
    debounced.flush = () => {
        if (timer) {
            clearTimeout(timer);
            timer  = null;
            called = false;
            if (lastArgs) fn.apply(lastThis, lastArgs);
        }
    };

    return debounced;
}

// ─── sleep (private helper) ────────────────────────────────────────────────────

/** @private */
function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { retry, throttle, debounce };
