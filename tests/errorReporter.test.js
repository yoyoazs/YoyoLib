const assert = require('node:assert');
const test = require('node:test');
const { createErrorReporter, createContextTracker } = require('../lib/YoyoLib');

test('ErrorReporter - manual reporting with mock fetch', async (t) => {
    let sentPayload = null;
    const originalFetch = global.fetch;
    
    global.fetch = async (url, options) => {
        sentPayload = JSON.parse(options.body);
        return { ok: true, json: async () => ({}) };
    };

    const reporter = createErrorReporter('http://webhook.com');
    await reporter.report(new Error('Manual Crash'), { user: 'yoyo' });

    assert.strictEqual(sentPayload.message, 'Manual Crash');
    assert.strictEqual(sentPayload.context.user, 'yoyo');
    assert.ok(sentPayload.stack);

    global.fetch = originalFetch;
});

test('ErrorReporter - wrap async function', async (t) => {
    let callCount = 0;
    const originalFetch = global.fetch;
    global.fetch = async () => {
        callCount++;
        return { ok: true, json: async () => ({}) };
    };

    const reporter = createErrorReporter('http://webhook.com');
    
    const failingTask = async () => {
        throw new Error('Async Task Failed');
    };

    const wrapped = reporter.wrap(failingTask);

    try {
        await wrapped();
        assert.fail('Should have rethrown the error');
    } catch (e) {
        assert.strictEqual(e.message, 'Async Task Failed');
    }

    assert.strictEqual(callCount, 1, 'Webhook should have been called');

    global.fetch = originalFetch;
});

test('ErrorReporter - with ContextTracker enrichment', async (t) => {
    let sentPayload = null;
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
        sentPayload = JSON.parse(options.body);
        return { ok: true, json: async () => ({}) };
    };

    const tracker = createContextTracker();
    const reporter = createErrorReporter('http://webhook.com', { contextTracker: tracker });

    await tracker.run({ requestId: 'TRACK-123' }, async () => {
        await reporter.report('Enriched Error');
    });

    assert.strictEqual(sentPayload.context.alsContext.requestId, 'TRACK-123');

    global.fetch = originalFetch;
});
