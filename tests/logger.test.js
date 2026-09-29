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

test('Logger - child accepts bindings and shares the parent stream', () => {
    const parent = createLogger(false, false, { json: true });
    const child = parent.child({ module: 'auth' });

    const lines = [];
    const original = console.log;
    console.log = (line) => lines.push(line);
    try {
        child.info('hello');
    } finally {
        console.log = original;
    }

    assert.strictEqual(JSON.parse(lines[0]).name, 'auth');
    assert.strictEqual(child._root, parent);
});

test('Logger - errors are logged with their stack', () => {
    const logger = createLogger(false, false, { json: true });
    const lines = [];
    const original = console.log;
    console.log = (line) => lines.push(line);
    try {
        logger.error(new Error('kaboom'));
        logger.info({ user: 'alice', id: 1 });
    } finally {
        console.log = original;
    }

    const errLine = JSON.parse(lines[0]);
    assert.strictEqual(errLine.message, 'kaboom');
    assert.ok(errLine.stack.includes('kaboom'));
    assert.ok(JSON.parse(lines[1]).message.includes("user: 'alice'"));
});
