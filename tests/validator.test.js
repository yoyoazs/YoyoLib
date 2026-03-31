const assert = require('node:assert');
const test = require('node:test');
const { validate } = require('../lib/YoyoLib');

test('Validator - valid object', (t) => {
    const data = { name: "John", age: 30, isAdmin: false };
    const schema = {
        name: { type: 'string', required: true, min: 2, max: 20 },
        age: { type: 'number', required: true, min: 18 },
        isAdmin: { type: 'boolean' }
    };
    
    assert.strictEqual(validate(data, schema), true);
});

test('Validator - missing required field throws', (t) => {
    const data = { age: 30 };
    const schema = { name: { required: true } };
    
    assert.throws(() => validate(data, schema), { name: "ValidationError" });
});

test('Validator - invalid type throws', (t) => {
    const data = { name: 123 };
    const schema = { name: { type: "string" } };
    
    assert.throws(() => validate(data, schema), { name: "ValidationError" });
});

test('Validator - Regex matching', (t) => {
    const schema = { email: { type: 'string', regex: /^.+@.+\..+$/ } };
    
    // Valid email
    assert.strictEqual(validate({ email: 'test@example.com' }, schema), true);
    
    // Invalid email
    assert.throws(() => validate({ email: 'invalid-email' }, schema), { name: 'ValidationError' });
});
