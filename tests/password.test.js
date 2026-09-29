const assert = require('node:assert');
const test = require('node:test');
const { passwordUtils, cryptoUtils } = require('../lib/YoyoLib');

test('passwordUtils - hash and verify', async () => {
    const stored = await passwordUtils.hash('correct horse battery staple');

    assert.match(stored, /^\$scrypt\$n=32768,r=8,p=1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    assert.strictEqual(await passwordUtils.verify('correct horse battery staple', stored), true);
    assert.strictEqual(await passwordUtils.verify('wrong', stored), false);
    // salted: same password, different hash
    assert.notStrictEqual(await passwordUtils.hash('correct horse battery staple'), stored);
});

test('passwordUtils - needsRehash and malformed hashes', async () => {
    const weak = await passwordUtils.hash('pw', { cost: 1024 });
    assert.strictEqual(await passwordUtils.verify('pw', weak), true);
    assert.strictEqual(passwordUtils.needsRehash(weak), true);
    assert.strictEqual(passwordUtils.needsRehash(weak, { cost: 1024 }), false);

    assert.strictEqual(await passwordUtils.verify('pw', 'not-a-hash'), false);
    assert.strictEqual(await passwordUtils.verify('pw', null), false);
    // tampered parameters asking for huge memory are refused
    assert.strictEqual(await passwordUtils.verify('pw', weak.replace('n=1024', 'n=1073741824')), false);
    await assert.rejects(passwordUtils.hash(''), TypeError);
    await assert.rejects(passwordUtils.hash('pw', { cost: 1000 }), /power of two/);
});

test('cryptoUtils - API keys', () => {
    const { key, hash, last4 } = cryptoUtils.generateApiKey({ prefix: 'sk_live' });

    assert.match(key, /^sk_live_[A-Za-z0-9_-]{43}$/);
    assert.strictEqual(hash, cryptoUtils.hashApiKey(key));
    assert.strictEqual(last4, key.slice(-4));
    assert.notStrictEqual(cryptoUtils.generateApiKey().key, cryptoUtils.generateApiKey().key);
    assert.strictEqual(cryptoUtils.safeEqual(hash, cryptoUtils.hashApiKey(key)), true);
    assert.strictEqual(cryptoUtils.safeEqual(hash, 'x'), false);
    assert.throws(() => cryptoUtils.generateApiKey({ bytes: 8 }), TypeError);
});
