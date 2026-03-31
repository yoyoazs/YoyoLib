const assert = require('node:assert');
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const { createConfigManager } = require('../lib/YoyoLib');

const TEST_DIR = path.join(__dirname, 'tmp');
const TEST_FILE = path.join(TEST_DIR, 'test_config.json');

test.before(() => {
    if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
});

test.afterEach(() => {
    if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
});

test('ConfigManager - init and defaults', (t) => {
    const config = createConfigManager(TEST_FILE, { a: 1, b: { c: 2 } });
    
    assert.strictEqual(config.get('a'), 1);
    assert.strictEqual(config.get('b.c'), 2);
    assert.strictEqual(config.get('missing', 'default_val'), 'default_val');
});

test('ConfigManager - set, save and reload', (t) => {
    const config1 = createConfigManager(TEST_FILE, { a: 1 });
    
    config1.set('a', 42);
    config1.set('nested.val', 'hello');
    assert.strictEqual(config1.save(), config1); // chainable
    
    // Create new instance pointing to same file
    const config2 = createConfigManager(TEST_FILE, { a: 1 });
    
    assert.strictEqual(config2.get('a'), 42);
    assert.strictEqual(config2.get('nested.val'), 'hello');
});
