const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createJobScheduler, MemoryStore, JsonFileStore } = require('../lib/YoyoLib');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const quiet = { onError: () => {} };

test('JobScheduler - runs a job at its time with a copy of the payload', async () => {
    const jobs = createJobScheduler({ ...quiet, pollInterval: '1m' });
    const runs = [];
    jobs.define('unmute', (payload, job) => { runs.push([payload, job.name, Date.now()]); payload.mutated = true; });
    jobs.start();
    try {
        const payload = { guildId: 'g', userId: 'u' };
        const scheduledAt = Date.now();
        const job = await jobs.scheduleIn('unmute', 40, payload);
        payload.guildId = 'changed after scheduling';

        await sleep(20);
        assert.strictEqual(runs.length, 0);
        await sleep(80);
        assert.strictEqual(runs.length, 1);
        assert.deepStrictEqual(runs[0][0], { guildId: 'g', userId: 'u', mutated: true });
        assert.ok(runs[0][2] - scheduledAt >= 35, 'ran too early'); // the wake-up timer, not the 1m poll
        assert.strictEqual(await jobs.get(job.id), null);
    } finally {
        await jobs.stop(); // a started scheduler keeps the process alive
    }
});

test('JobScheduler - a wake-up timer firing before Date.now() reaches runAt still runs the job', async () => {
    const jobs = createJobScheduler({ ...quiet, pollInterval: '1m' });
    let ran = false;
    jobs.define('x', () => { ran = true; });
    jobs.start();
    const realNow = Date.now;
    try {
        await jobs.scheduleIn('x', 20, {});
        // The wall clock lags behind the timers (large lag: Windows timers fire late and would hide a small one)
        Date.now = () => realNow() - 30;
        await sleep(150);
        assert.strictEqual(ran, true);
    } finally {
        Date.now = realNow;
        await jobs.stop();
    }
});

test('JobScheduler - jobs survive a restart (JsonFileStore)', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'yoyolib-jobs-')), 'jobs.json');

    const before = new JsonFileStore({ file, writeDelay: 0, sweepInterval: 0 });
    const first = createJobScheduler({ ...quiet, store: before });
    await first.scheduleAt('reminder', new Date(Date.now() - 1000), { text: 'drink water' }); // due while "offline"
    await first.scheduleIn('reminder', '1h', { text: 'later' }, { id: 'later' });
    before.close();

    const after = new JsonFileStore({ file, writeDelay: 0, sweepInterval: 0 });
    const second = createJobScheduler({ ...quiet, store: after });
    const seen = [];
    second.define('reminder', (p) => seen.push(p.text));
    second.start();
    try {
        await sleep(30);
    } finally {
        await second.stop();
    }

    assert.deepStrictEqual(seen, ['drink water']);
    assert.deepStrictEqual((await second.list()).map(j => j.id), ['later']);
    after.close();
});

test('JobScheduler - retries with backoff, then drops the job', async () => {
    const errors = [];
    const jobs = createJobScheduler({ retryDelay: 10, maxAttempts: 3, onError: (e, job, final) => errors.push([job.attempts, final]) });
    let calls = 0;
    jobs.define('flaky', () => { calls++; if (calls < 3) throw new Error('nope'); });
    jobs.define('broken', () => { throw new Error('always'); });

    await jobs.scheduleAt('flaky', Date.now(), {}, { id: 'f' });
    await jobs.scheduleAt('broken', Date.now(), {}, { id: 'b', maxAttempts: 1 });
    await jobs.tick();

    const retried = await jobs.get('f');
    assert.strictEqual(retried.attempts, 1);
    assert.strictEqual(retried.lastError, 'nope');
    assert.ok(retried.runAt > Date.now());
    assert.strictEqual(await jobs.get('b'), null); // maxAttempts 1: dropped

    await sleep(15); await jobs.tick(); // attempt 2 fails (next retry in 20 ms)
    await sleep(25); await jobs.tick(); // attempt 3 succeeds
    assert.strictEqual(calls, 3);
    assert.strictEqual(await jobs.get('f'), null);
    assert.deepStrictEqual(errors.sort(), [[1, false], [1, true], [2, false]].sort());
});

test('JobScheduler - ids replace jobs, cancel, list and unknown names', async () => {
    const jobs = createJobScheduler(quiet);
    const later = Date.now() + 60000;
    await jobs.scheduleAt('tempban', later, { v: 1 }, { id: 'ban:g:u' });
    await jobs.scheduleAt('tempban', later + 1000, { v: 2 }, { id: 'ban:g:u' });
    await jobs.scheduleAt('giveaway', later - 1000, {});
    await jobs.scheduleAt('nobody-handles-this', Date.now() - 1, {}, { id: 'orphan' });

    // soonest first
    assert.deepStrictEqual((await jobs.list()).map(j => j.name), ['nobody-handles-this', 'giveaway', 'tempban']);
    assert.strictEqual((await jobs.list('tempban')).length, 1);
    assert.strictEqual((await jobs.get('ban:g:u')).payload.v, 2);

    assert.strictEqual(await jobs.cancel('ban:g:u'), true);
    assert.strictEqual(await jobs.cancel('ban:g:u'), false);

    await jobs.tick();
    assert.ok(await jobs.get('orphan'), 'jobs without a handler stay for another process');
    await assert.rejects(jobs.scheduleAt('x', 'tomorrow'), /Invalid date/);
    assert.throws(() => createJobScheduler({ store: { get() {} } }), /entries/);
});

test('JobScheduler - a job runs once even with several schedulers on the same store', async () => {
    const store = new MemoryStore({ sweepInterval: 0 });
    let runs = 0;
    const handler = async () => { runs++; await sleep(20); };
    const a = createJobScheduler({ ...quiet, store }).define('once', handler);
    const b = createJobScheduler({ ...quiet, store }).define('once', handler);

    await a.scheduleAt('once', Date.now() - 1, {});
    await Promise.all([a.tick(), b.tick(), a.tick()]);
    assert.strictEqual(runs, 1);
    assert.deepStrictEqual(await a.list(), []);
});

test('JobScheduler - a job rescheduled while running is kept', async () => {
    const jobs = createJobScheduler(quiet);
    jobs.define('slow', async () => {
        await sleep(20);
    });
    await jobs.scheduleAt('slow', Date.now() - 1, {}, { id: 'x' });
    const running = jobs.tick();
    await sleep(5);
    await jobs.scheduleIn('slow', '1h', { again: true }, { id: 'x' });
    await running;
    assert.deepStrictEqual((await jobs.get('x')).payload, { again: true });
});
