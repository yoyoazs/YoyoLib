const assert = require('node:assert');
const test = require('node:test');
const { createRateLimiter } = require('../lib/YoyoLib');

test('RateLimiter - limits requests within window', (t) => {
    // limit max 3 per second
    const limiter = createRateLimiter({ limit: 3, window: 1 });
    const ip = '192.168.0.1';

    // 1st
    const r1 = limiter.consume(ip);
    assert.strictEqual(r1.allowed, true);
    assert.strictEqual(r1.remaining, 2);

    // 2nd
    const r2 = limiter.consume(ip);
    assert.strictEqual(r2.allowed, true);
    assert.strictEqual(r2.remaining, 1);

    // 3rd
    const r3 = limiter.consume(ip);
    assert.strictEqual(r3.allowed, true);
    assert.strictEqual(r3.remaining, 0);

    // 4th -> blocked
    const r4 = limiter.consume(ip);
    assert.strictEqual(r4.allowed, false);
    assert.strictEqual(r4.remaining, 0);
});

test('RateLimiter - keys are independent', (t) => {
    const limiter = createRateLimiter({ limit: 2, window: 60 });
    
    limiter.consume('user-A');
    limiter.consume('user-A');
    
    // user A is blocked
    assert.strictEqual(limiter.consume('user-A').allowed, false);
    
    // User B should be fine
    assert.strictEqual(limiter.consume('user-B').allowed, true);
});
