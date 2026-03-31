const assert = require('node:assert');
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const { createEnvLoader } = require('../lib/YoyoLib');

const TEST_DIR = path.join(__dirname, 'tmp');
const TEST_ENV_FILE = path.join(TEST_DIR, '.test_env');

test.before(() => {
    if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
});

test.after(() => {
    if (fs.existsSync(TEST_ENV_FILE)) fs.unlinkSync(TEST_ENV_FILE);
});

test('EnvLoader - file parsing', (t) => {
    const envContent = `
# Comment
PORT=8080
DEBUG=true
ALLOWED_CORS="http://a.com, http://b.com"
NUMBER_STR="123"
    `;
    fs.writeFileSync(TEST_ENV_FILE, envContent.trim());
    
    const env = createEnvLoader(TEST_ENV_FILE);
    
    assert.strictEqual(env.getNumber('PORT'), 8080);
    assert.strictEqual(env.getBool('DEBUG'), true);
    assert.strictEqual(env.getNumber('NUMBER_STR'), 123);
    assert.deepStrictEqual(env.getArray('ALLOWED_CORS'), ['http://a.com', 'http://b.com']);
    assert.strictEqual(env.has('PORT'), true);
});

test('EnvLoader - require throws if missing', (t) => {
    const env = createEnvLoader(TEST_ENV_FILE); // file might be empty or missing
    assert.throws(() => env.require('NON_EXISTENT_VAR'), { name: 'EnvError' });
});
