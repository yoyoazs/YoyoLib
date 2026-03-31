const assert = require('node:assert');
const test = require('node:test');
const { createDataMasker } = require('../lib/YoyoLib.js');

test('DataMasker - Whitelist Mode', () => {
    const masker = createDataMasker({
        mode: 'whitelist',
        fields: ['id', 'email']
    });

    const input = {
        id: 1,
        email: 'alice@example.com',
        password: '123',
        address: {
            city: 'Paris',
            street: 'Main'
        }
    };

    const masked = masker.mask(input);

    assert.strictEqual(masked.id, 1);
    assert.strictEqual(masked.email, 'alice@example.com');
    assert.strictEqual(masked.password, '***MASKED***');
    assert.strictEqual(masked.address.city, '***MASKED***');
});

test('DataMasker - Custom Maskers (Email domain)', () => {
    const masker = createDataMasker({
        customMaskers: {
            email: (val) => {
                if (typeof val !== 'string') return val;
                const [user, domain] = val.split('@');
                return `${user[0]}***@${domain}`;
            }
        }
    });

    const input = {
        name: 'Bob',
        email: 'bob.smith@gmail.com'
    };

    const masked = masker.mask(input);

    assert.strictEqual(masked.name, 'Bob');
    assert.strictEqual(masked.email, 'b***@gmail.com');
});

test('DataMasker - Recursive Deep Masking & Circular Protection', () => {
    const masker = createDataMasker({
        fields: ['secret']
    });

    const input = {
        a: {
            b: {
                secret: 'shhh'
            }
        }
    };
    input.self = input;

    const masked = masker.mask(input);

    assert.strictEqual(masked.a.b.secret, '***MASKED***');
    assert.strictEqual(masked.self, '[Circular]');
});
