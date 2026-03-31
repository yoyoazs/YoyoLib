const assert = require('node:assert');
const test = require('node:test');
const { createShutdownManager } = require('../lib/YoyoLib');

test('ShutdownManager - registers and executes tasks (mocking exit)', async (t) => {
    // We mock process.exit to avoid killing the test runner!
    const originalExit = process.exit;
    let exitCode = null;
    process.exit = (code) => { exitCode = code; return null; };

    const sm = createShutdownManager({ log: false });
    let taskCalled = false;

    sm.register('test-task', async () => {
        await new Promise(r => setTimeout(r, 10));
        taskCalled = true;
    });

    // Manually trigger shutdown
    await sm.shutdown('TEST_SIGNAL');

    assert.strictEqual(taskCalled, true, 'Task should have been executed');
    assert.strictEqual(exitCode, 0, 'Should have exited with 0');

    // Restore exit
    process.exit = originalExit;
});

test('ShutdownManager - handles errors in tasks', async (t) => {
    const originalExit = process.exit;
    process.exit = () => {};

    const sm = createShutdownManager({ log: false });
    sm.register('failing-task', () => { throw new Error('Boom'); });

    // Should not crash the shutdown process
    await sm.shutdown();

    process.exit = originalExit;
});
