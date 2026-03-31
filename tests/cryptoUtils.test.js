const assert = require('node:assert');
const test = require('node:test');
const { cryptoUtils } = require('../lib/YoyoLib');

test('cryptoUtils - uuid format valid v4', (t) => {
    const id = cryptoUtils.uuid();
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('cryptoUtils - hash', (t) => {
    const originalText = 'hello world';
    const expectedSha256 = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
    
    assert.strictEqual(cryptoUtils.hash(originalText), expectedSha256);
    assert.throws(() => cryptoUtils.hash(123), { name: 'TypeError' });
});

test('cryptoUtils - randomString', (t) => {
    const s1 = cryptoUtils.randomString(8);
    const s2 = cryptoUtils.randomString(8);
    
    assert.strictEqual(s1.length, 16); // 8 bytes -> 16 hex chars
    assert.notStrictEqual(s1, s2);
});

test('cryptoUtils - AES encrypt/decrypt', (t) => {
    const secret = 'this_is_a_32_chars_secret_key_!!!';
    const text = 'SaaS Secret Data';
    
    const encrypted = cryptoUtils.encrypt(text, secret);
    assert.notStrictEqual(encrypted, text);
    assert.match(encrypted, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    
    const decrypted = cryptoUtils.decrypt(encrypted, secret);
    assert.strictEqual(decrypted, text);
});

test('cryptoUtils - AES fails on bad secret', (t) => {
    const secretStr = 'this_is_a_32_chars_secret_key_!!!';
    const encrypted = cryptoUtils.encrypt('Top Secret', secretStr);
    
    assert.throws(() => cryptoUtils.decrypt(encrypted, 'wrong_secret_key_must_be_32_chars'), { name: 'Error' });
});

