const assert = require('node:assert');
const test = require('node:test');
const { createScheduler } = require('../lib/YoyoLib');

const testSleep = (ms) => new Promise(r => setTimeout(r, ms));

test('Scheduler - Basic execution', async (t) => {
    const scheduler = createScheduler();
    let counter = 0;
    
    // Run every 0.1 seconds (100ms)
    scheduler.every('count', 0.1, () => {
        counter++;
    });

    assert.deepStrictEqual(scheduler.list(), ['count']);
    
    await testSleep(350); // wait enough time for 3 triggers
    scheduler.stop('count');
    
    assert.ok(counter >= 3, `Expected counter >= 3, got ${counter}`);
    assert.deepStrictEqual(scheduler.list(), []);
    
    scheduler.clear();
});

test('Scheduler - async failures go to onError instead of crashing', async () => {
    const errors = [];
    const scheduler = createScheduler({ onError: (err, name) => errors.push([name, err.message]) });

    scheduler.every('fails', 0.05, async () => { throw new Error('nope'); });
    await testSleep(130);
    scheduler.clear();

    assert.ok(errors.length >= 1);
    assert.deepStrictEqual(errors[0], ['fails', 'nope']);
});

test('Scheduler - skips a run while the previous one is still pending', async () => {
    const scheduler = createScheduler();
    let concurrent = 0;
    let maxConcurrent = 0;

    scheduler.every('slow', 0.02, async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await testSleep(80);
        concurrent--;
    }, { immediate: true });

    await testSleep(200);
    scheduler.clear();
    assert.strictEqual(maxConcurrent, 1);
});
