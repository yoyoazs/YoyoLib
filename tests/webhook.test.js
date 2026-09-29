const assert = require('node:assert');
const test = require('node:test');
const crypto = require('node:crypto');
const { webhookUtils } = require('../lib/YoyoLib');

const BODY = '{"event":"paid","amount":42}';
const SECRET = 'whsec_test_secret';

test('webhookUtils - GitHub signatures', () => {
    const header = 'sha256=' + crypto.createHmac('sha256', SECRET).update(BODY).digest('hex');

    assert.strictEqual(webhookUtils.verifyGithub(BODY, header, SECRET), true);
    assert.strictEqual(webhookUtils.verifyGithub(Buffer.from(BODY), header, SECRET), true);
    assert.strictEqual(webhookUtils.verifyGithub(BODY + ' ', header, SECRET), false);
    assert.strictEqual(webhookUtils.verifyGithub(BODY, header, 'wrong'), false);
    assert.strictEqual(webhookUtils.verifyGithub(BODY, header.replace('sha256=', ''), SECRET), false);
    assert.strictEqual(webhookUtils.verifyGithub(BODY, undefined, SECRET), false);
});

test('webhookUtils - Stripe-style timestamped signatures', () => {
    const t = Math.floor(Date.now() / 1000);
    const v1 = crypto.createHmac('sha256', SECRET).update(`${t}.${BODY}`).digest('hex');

    // Real Stripe headers may carry several v1 and a v0
    const header = `t=${t},v1=deadbeef,v1=${v1},v0=abc`;
    assert.strictEqual(webhookUtils.verifyStripe(BODY, header, SECRET), true);
    assert.strictEqual(webhookUtils.verifyStripe(BODY, header, 'other'), false);

    const old = t - 3600;
    const oldSig = crypto.createHmac('sha256', SECRET).update(`${old}.${BODY}`).digest('hex');
    assert.strictEqual(webhookUtils.verifyStripe(BODY, `t=${old},v1=${oldSig}`, SECRET), false);
    assert.strictEqual(webhookUtils.verifyStripe(BODY, `t=${old},v1=${oldSig}`, SECRET, { tolerance: 0 }), true);
    assert.strictEqual(webhookUtils.verifyStripe(BODY, 'garbage', SECRET), false);
});

test('webhookUtils - signTimestamped round-trips for outgoing webhooks', () => {
    const header = webhookUtils.signTimestamped(BODY, SECRET);
    assert.match(header, /^t=\d+,v1=[a-f0-9]{64}$/);
    assert.strictEqual(webhookUtils.verifyTimestamped(BODY, header, SECRET), true);
});

test('webhookUtils - Discord Ed25519 interaction signatures', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const publicKeyHex = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = crypto.sign(null, Buffer.from(timestamp + BODY), privateKey).toString('hex');

    assert.strictEqual(webhookUtils.verifyDiscord(BODY, signature, timestamp, publicKeyHex), true);
    assert.strictEqual(webhookUtils.verifyDiscord(Buffer.from(BODY), signature, timestamp, publicKeyHex), true);
    assert.strictEqual(webhookUtils.verifyDiscord(BODY, signature, String(Number(timestamp) + 1), publicKeyHex), false);
    assert.strictEqual(webhookUtils.verifyDiscord(BODY + 'x', signature, timestamp, publicKeyHex), false);
    assert.strictEqual(webhookUtils.verifyDiscord(BODY, 'zz', timestamp, publicKeyHex), false);
    assert.strictEqual(webhookUtils.verifyDiscord(BODY, signature, timestamp, 'not-hex'), false);
});

test('webhookUtils - refuses parsed bodies', () => {
    assert.throws(() => webhookUtils.verifyGithub({ event: 'paid' }, 'sha256=x', SECRET), /raw request body/);
});
