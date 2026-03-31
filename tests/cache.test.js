const assert = require('node:assert');
const test = require('node:test');
const { createCache } = require('../lib/YoyoLib');

const testSleep = (ms) => new Promise(r => setTimeout(r, ms));

test('Cache - basic set/get', (t) => {
    const cache = createCache();
    cache.set('a', 1);
    assert.strictEqual(cache.get('a'), 1);
    assert.strictEqual(cache.has('a'), true);
});

test('Cache - TTL expiry', async (t) => {
    const cache = createCache({ ttl: 0.05 }); // 50ms
    cache.set('a', 1);
    
    assert.strictEqual(cache.get('a'), 1);
    await testSleep(60);
    assert.strictEqual(cache.get('a'), null);
});

test('Cache - LRU Eviction', (t) => {
    const cache = createCache({ maxSize: 2 });
    cache.set('1', 'a');
    cache.set('2', 'b');
    cache.set('3', 'c'); // Should evict '1'
    
    assert.strictEqual(cache.get('1'), null);
    assert.strictEqual(cache.get('3'), 'c');
    assert.strictEqual(cache.size(), 2);
});
