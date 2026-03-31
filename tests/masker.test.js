const assert = require('node:assert');
const test = require('node:test');
const { createDataMasker } = require('../lib/YoyoLib');

test('DataMasker - masks sensitive fields recursively', (t) => {
    const masker = createDataMasker();
    const input = {
        user: 'alice',
        password: 'secret_password_123',
        meta: {
            token: 'ABC-123',
            inner: {
                KEY: 'private_key'
            }
        },
        items: [
            { id: 1, secret: 'shhh' }
        ]
    };

    const masked = masker.mask(input);

    assert.strictEqual(masked.user, 'alice');
    assert.strictEqual(masked.password, '***MASKED***');
    assert.strictEqual(masked.meta.token, '***MASKED***');
    assert.strictEqual(masked.meta.inner.KEY, '***MASKED***');
    assert.strictEqual(masked.items[0].secret, '***MASKED***');
    assert.strictEqual(masked.items[0].id, 1);
    
    // Ensure original is not mutated
    assert.strictEqual(input.password, 'secret_password_123');
});

test('DataMasker - handles circular references', (t) => {
    const masker = createDataMasker();
    const input = { name: 'circular' };
    input.self = input;

    const masked = masker.mask(input);
    assert.strictEqual(masked.self, '[Circular]');
});
