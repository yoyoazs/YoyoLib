'use strict';

const crypto = require('crypto');
const { safeEqual } = require('../utils/cryptoUtils');

// DER header of an Ed25519 SubjectPublicKeyInfo; the raw 32-byte key follows it
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * Verification of incoming webhooks (Stripe, GitHub, Discord interactions, custom HMAC)
 * and signing of your own outgoing webhooks.
 *
 * All verify functions need the RAW request body (string or Buffer), exactly as received.
 * Re-serializing a parsed JSON body changes the bytes and breaks the signature.
 * With Express: `express.raw({ type: 'application/json' })` or the `verify` option of express.json().
 */

/**
 * Computes an HMAC signature.
 * @param {string|Buffer} payload
 * @param {string|Buffer} secret
 * @param {object} [options]
 * @param {string} [options.algorithm='sha256']
 * @param {'hex'|'base64'|'base64url'} [options.encoding='hex']
 * @returns {string}
 */
function sign(payload, secret, { algorithm = 'sha256', encoding = 'hex' } = {}) {
    assertRaw(payload);
    if (!secret) throw new TypeError('secret is required');
    return crypto.createHmac(algorithm, secret).update(payload).digest(encoding);
}

/**
 * Verifies an HMAC signature in constant time.
 * @param {object} options
 * @param {string|Buffer} options.payload   - Raw body.
 * @param {string}        options.signature - Received signature (header value).
 * @param {string|Buffer} options.secret
 * @param {string}        [options.algorithm='sha256']
 * @param {'hex'|'base64'|'base64url'} [options.encoding='hex']
 * @param {string}        [options.prefix=''] - Prefix to strip from the header (e.g. 'sha256=').
 * @returns {boolean}
 */
function verifyHmac({ payload, signature, secret, algorithm = 'sha256', encoding = 'hex', prefix = '' }) {
    if (typeof signature !== 'string' || !signature) return false;
    if (prefix) {
        if (!signature.startsWith(prefix)) return false;
        signature = signature.slice(prefix.length);
    }
    const expected = sign(payload, secret, { algorithm, encoding });
    return safeEqual(expected, signature);
}

/**
 * Verifies a GitHub webhook (`X-Hub-Signature-256` header).
 * @param {string|Buffer} payload - Raw body.
 * @param {string} signatureHeader - e.g. "sha256=abc..."
 * @param {string} secret
 * @returns {boolean}
 */
function verifyGithub(payload, signatureHeader, secret) {
    return verifyHmac({ payload, signature: signatureHeader, secret, prefix: 'sha256=' });
}

/**
 * Creates a timestamped signature header "t=<unix>,v1=<hmac>" (the format used by Stripe).
 * Use it to sign the webhooks your SaaS sends to its customers.
 * @param {string|Buffer} payload
 * @param {string} secret
 * @param {number} [timestamp] - Unix seconds (default: now).
 * @returns {string}
 */
function signTimestamped(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
    assertRaw(payload);
    return `t=${timestamp},v1=${sign(`${timestamp}.${payload}`, secret)}`;
}

/**
 * Verifies a "t=<unix>,v1=<hmac>[,v1=...]" header and rejects old timestamps (replay protection).
 * @param {string|Buffer} payload - Raw body.
 * @param {string} header
 * @param {string} secret
 * @param {object} [options]
 * @param {number} [options.tolerance=300] - Max age in seconds. 0 disables the check.
 * @returns {boolean}
 */
function verifyTimestamped(payload, header, secret, { tolerance = 300 } = {}) {
    assertRaw(payload);
    if (typeof header !== 'string' || !header) return false;

    let timestamp = null;
    const signatures = [];
    for (const part of header.split(',')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        const k = part.slice(0, idx).trim();
        const v = part.slice(idx + 1).trim();
        if (k === 't') timestamp = Number(v);
        else if (k === 'v1') signatures.push(v);
    }
    if (!Number.isInteger(timestamp) || signatures.length === 0) return false;
    if (tolerance > 0 && Math.abs(Math.floor(Date.now() / 1000) - timestamp) > tolerance) return false;

    const expected = sign(`${timestamp}.${payload}`, secret);
    return signatures.some(sig => safeEqual(expected, sig));
}

/**
 * Verifies a Stripe webhook (`Stripe-Signature` header).
 * @param {string|Buffer} payload - Raw body.
 * @param {string} signatureHeader
 * @param {string} secret - Endpoint secret ("whsec_...").
 * @param {object} [options]
 * @param {number} [options.tolerance=300]
 * @returns {boolean}
 */
function verifyStripe(payload, signatureHeader, secret, options) {
    return verifyTimestamped(payload, signatureHeader, secret, options);
}

/**
 * Verifies a Discord interaction request (HTTP interactions endpoint).
 * Discord requires this check and sends invalid signatures on purpose to test it:
 * answer 401 when it returns false.
 * @param {string|Buffer} payload   - Raw body.
 * @param {string} signature        - `X-Signature-Ed25519` header (hex).
 * @param {string} timestamp        - `X-Signature-Timestamp` header.
 * @param {string} publicKey        - Application public key (hex, from the developer portal).
 * @returns {boolean}
 */
function verifyDiscord(payload, signature, timestamp, publicKey) {
    assertRaw(payload);
    if (!signature || !timestamp || !publicKey) return false;
    try {
        const key = crypto.createPublicKey({
            key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKey, 'hex')]),
            format: 'der',
            type: 'spki',
        });
        const message = Buffer.concat([Buffer.from(String(timestamp)), Buffer.isBuffer(payload) ? payload : Buffer.from(payload)]);
        return crypto.verify(null, message, key, Buffer.from(signature, 'hex'));
    } catch (_) {
        return false;
    }
}

function assertRaw(payload) {
    if (typeof payload !== 'string' && !Buffer.isBuffer(payload)) {
        throw new TypeError('payload must be the raw request body (string or Buffer), not a parsed object');
    }
}

module.exports = {
    sign,
    verifyHmac,
    verifyGithub,
    signTimestamped,
    verifyTimestamped,
    verifyStripe,
    verifyDiscord,
    safeEqual,
};
