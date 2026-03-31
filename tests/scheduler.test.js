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
