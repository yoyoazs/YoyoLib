const assert = require('node:assert');
const test = require('node:test');
const { createHealthChecker } = require('../lib/YoyoLib');

test('HealthChecker - aggregates status from multiple services', async (t) => {
    const health = createHealthChecker();
    
    health.register('database', async () => true);
    health.register('redis', () => false);

    const report = await health.getStatus();

    assert.strictEqual(report.status, 'DOWN');
    assert.strictEqual(report.services.database, 'UP');
    assert.strictEqual(report.services.redis, 'DOWN');
    assert.ok(report.uptime >= 0);
});

test('HealthChecker - handles errors in checkers', async (t) => {
    const health = createHealthChecker();
    
    health.register('external-api', async () => {
        throw new Error('Connection Refused');
    });

    const report = await health.getStatus();

    assert.strictEqual(report.status, 'DOWN');
    assert.ok(report.services['external-api'].includes('ERROR'));
});
