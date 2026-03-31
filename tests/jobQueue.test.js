const assert = require('node:assert');
const test = require('node:test');
const { JobQueue } = require('../lib/YoyoLib');

const testSleep = (ms) => new Promise(r => setTimeout(r, ms));

test('JobQueue - limits concurrency', async (t) => {
    const q = new JobQueue({ concurrency: 2 });
    let maxRunning = 0;
    let running = 0;

    const mkJob = () => async () => {
        running++;
        if (running > maxRunning) maxRunning = running;
        await testSleep(50);
        running--;
    };

    // Push 5 jobs
    [1,2,3,4,5].forEach(() => q.push(mkJob()));

    assert.strictEqual(q.waiting, 3);
    assert.strictEqual(q.active, 2); // 2 immediately start

    // Wait for the queue to drain
    await new Promise(resolve => q.events.once('drain', resolve));

    assert.strictEqual(maxRunning, 2, 'Never ran more than 2 jobs at once');
    assert.strictEqual(q.active, 0);
    assert.strictEqual(q.waiting, 0);
});

test('JobQueue - push returns a Promise', async (t) => {
    const q = new JobQueue();
    
    const res = await q.push(async () => {
        await testSleep(10);
        return 42;
    });

    assert.strictEqual(res, 42);
});

test('JobQueue - push promise rejects on error', async (t) => {
    const q = new JobQueue();
    
    try {
        await q.push(async () => {
            throw new Error('Task Failed');
        });
        assert.fail('Should have rejected');
    } catch (err) {
        assert.strictEqual(err.message, 'Task Failed');
    }
});
