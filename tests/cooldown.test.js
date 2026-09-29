const assert = require('node:assert');
const test = require('node:test');
const { createCooldownManager } = require('../lib/YoyoLib');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

test('CooldownManager - one use per window', async () => {
    const cd = createCooldownManager({ sweepInterval: 0 });

    const first = cd.hit('daily', 'u1', 60);
    assert.strictEqual(first.ok, true);
    assert.strictEqual(first.remaining, 0);

    const second = cd.hit('daily', 'u1', 60);
    assert.strictEqual(second.ok, false);
    assert.ok(second.remaining > 0 && second.remaining <= 60);

    // other ids and buckets are independent
    assert.strictEqual(cd.hit('daily', 'u2', 60).ok, true);
    assert.strictEqual(cd.hit('weekly', 'u1', 60).ok, true);

    await sleep(80);
    assert.strictEqual(cd.hit('daily', 'u1', 60).ok, true);
});

test('CooldownManager - several uses per window and check()', () => {
    const cd = createCooldownManager({ sweepInterval: 0 });
    const rule = { duration: '1m', uses: 2 };

    assert.strictEqual(cd.check('purge', 'g1', rule).usesLeft, 2);
    assert.strictEqual(cd.hit('purge', 'g1', rule).usesLeft, 1);
    assert.strictEqual(cd.hit('purge', 'g1', rule).usesLeft, 0);

    const blocked = cd.hit('purge', 'g1', rule);
    assert.strictEqual(blocked.ok, false);
    assert.match(blocked.remainingText, /second|minute/);
    assert.strictEqual(cd.check('purge', 'g1', rule).ok, false);
});

test('CooldownManager - reset, sweep and validation', async () => {
    const cd = createCooldownManager({ sweepInterval: 0 });
    cd.hit('a', '1', '1h');
    cd.hit('a', '2', '1h');
    cd.hit('b', '1', 10);

    assert.strictEqual(cd.reset('a', '1'), 1);
    assert.strictEqual(cd.hit('a', '1', '1h').ok, true);
    assert.strictEqual(cd.reset('a'), 2);

    await sleep(20);
    cd.sweep();
    assert.strictEqual(cd._entries.size, 0);

    assert.throws(() => cd.hit('a', '1', 0), TypeError);
    assert.throws(() => cd.hit('a', '1', { duration: '1s', uses: 0 }), TypeError);
    assert.throws(() => cd.hit('a', undefined, '1s'), TypeError);
    cd.destroy();
});
