const assert = require('node:assert');
const test = require('node:test');
const { jwtUtils } = require('../lib/YoyoLib');

const SECRET = 'my_super_secret_key_123';

test('jwtUtils - sign and verify token', (t) => {
    const payload = { userId: 42, role: 'admin' };
    
    // Sign
    const token = jwtUtils.sign(payload, SECRET, 3600);
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(token.split('.').length, 3);
    
    // Verify
    const decoded = jwtUtils.verify(token, SECRET);
    assert.strictEqual(decoded.userId, 42);
    assert.strictEqual(decoded.role, 'admin');
    assert.ok(decoded.exp > Date.now() / 1000); // Expiry works
    assert.ok(decoded.iat <= Date.now() / 1000); // Issued At works
});

test('jwtUtils - decode without verification', (t) => {
    const payload = { public_id: '1234' };
    const token = jwtUtils.sign(payload, SECRET, 3600);
    
    const decoded = jwtUtils.decode(token);
    assert.strictEqual(decoded.public_id, '1234');
    assert.ok(decoded.iat);
});

test('jwtUtils - fails on bad secret', (t) => {
    const token = jwtUtils.sign({ id: 1 }, SECRET);
    assert.throws(() => jwtUtils.verify(token, 'wrong_secret'), { message: 'Invalid signature' });
});

test('jwtUtils - fails on expired token', (t) => {
    // Expires in -1 seconds (already expired)
    const token = jwtUtils.sign({ id: 1 }, SECRET, -1);
    assert.throws(() => jwtUtils.verify(token, SECRET), { message: 'Token expired' });
});
