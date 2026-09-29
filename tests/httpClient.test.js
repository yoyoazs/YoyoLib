const assert = require('node:assert');
const test = require('node:test');
const { httpClient } = require('../lib/YoyoLib');

// Note: Testing actual HTTP requires mocking global.fetch or an actual server.
// We will test if our wrapper cleanly forms requests and uses native fetch via a mock.

test('httpClient - basic GET query param injection', async (t) => {
    // 1. Mock native fetch
    let requestedUrl = '';
    const originalFetch = global.fetch;
    
    global.fetch = async (url, options) => {
        requestedUrl = url;
        return { ok: true, json: async () => ({ status: 'success' }), headers: { get: () => 'application/json' } };
    };

    // 2. Call our client
    const res = await httpClient.get('http://api.com/users', { query: { limit: 10, page: 2 } });
    
    // 3. Verify
    assert.strictEqual(requestedUrl, 'http://api.com/users?limit=10&page=2');
    assert.deepStrictEqual(res, { status: 'success' });
    
    // Restore fetch
    global.fetch = originalFetch;
});

test('httpClient - throws HttpError on >400 status', async (t) => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({ 
        ok: false, 
        status: 404, 
        statusText: 'Not Found',
        json: async () => ({ error: 'User not found' }),
        headers: { get: () => 'application/json' } 
    });

    try {
        await httpClient.get('http://api.com/user/999');
        assert.fail('Should have thrown an HttpError');
    } catch (e) {
        assert.strictEqual(e.name, 'HttpError');
        assert.strictEqual(e.status, 404);
        assert.deepStrictEqual(e.data, { error: 'User not found' });
    } finally {
        global.fetch = originalFetch;
    }
});

test('httpClient - timeout aborts slowly responding requests', async (t) => {
    const originalFetch = global.fetch;
    
    // Mock a fetch that takes 1000ms
    global.fetch = async (url, options) => {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 1000);
            if (options.signal) {
                options.signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(new Error('AbortError'));
                });
            }
        });
    };

    try {
        // We set timeout to 100ms, it should throw AbortError
        await httpClient.get('http://api.com/slow', { timeout: 100 });
        assert.fail('Should have aborted');
    } catch (e) {
        assert.strictEqual(e.message, 'AbortError');
    } finally {
        global.fetch = originalFetch;
    }
});

test('httpClient - does not retry 4xx client errors', async () => {
    const originalFetch = global.fetch;
    let calls = 0;
    global.fetch = async () => {
        calls++;
        return { ok: false, status: 404, statusText: 'Not Found', headers: { get: () => null }, text: async () => '' };
    };

    try {
        await assert.rejects(httpClient.get('http://api.com/x', { retries: 3, retryDelay: 0 }), { status: 404 });
        assert.strictEqual(calls, 1);
    } finally {
        global.fetch = originalFetch;
    }
});

test('httpClient - retries 5xx and honors Retry-After on 429', async () => {
    const originalFetch = global.fetch;
    const responses = [
        { ok: false, status: 503, statusText: 'Unavailable', headers: { get: () => null }, text: async () => '' },
        { ok: false, status: 429, statusText: 'Too Many', headers: { get: (h) => h === 'retry-after' ? '0' : null }, text: async () => '' },
        { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ done: true }) },
    ];
    let calls = 0;
    global.fetch = async () => responses[calls++];

    try {
        const res = await httpClient.get('http://api.com/x', { retries: 3, retryDelay: 0 });
        assert.deepStrictEqual(res, { done: true });
        assert.strictEqual(calls, 3);
    } finally {
        global.fetch = originalFetch;
    }
});

test('httpClient - formats bearer token correctly', async (t) => {
    let sentHeaders;
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
        sentHeaders = options.headers;
        return { ok: true, json: async () => ({}), headers: { get: () => 'application/json' } };
    };

    await httpClient.get('http://api.com/auth', { bearer: 'my-token' });
    assert.strictEqual(sentHeaders['Authorization'], 'Bearer my-token');

    global.fetch = originalFetch;
});
