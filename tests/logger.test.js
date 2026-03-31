const assert = require('node:assert');
const test = require('node:test');
const { createLogger } = require('../lib/YoyoLib');

test('Logger - default initialization', (t) => {
    const logger = createLogger();
    assert.strictEqual(logger.getLevel(), 'debug');
    assert.strictEqual(logger.json, false);
});

test('Logger - json mode and level', (t) => {
    const logger = createLogger(false, false, { json: true, level: 'warn' });
    assert.strictEqual(logger.json, true);
    assert.strictEqual(logger.getLevel(), 'warn');
});

test('Logger - child logger inherits config', (t) => {
    const parent = createLogger(false, false, { json: true, level: 'error' });
    const child = parent.child('TestModule');
    
    assert.strictEqual(child.json, true);
    assert.strictEqual(child.getLevel(), 'error');
});
