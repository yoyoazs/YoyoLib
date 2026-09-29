'use strict';

const crypto = require('crypto');

/**
 * Generates a standard universally unique identifier (UUID) v4.
 * Useful for request IDs, session IDs, and database primary keys.
 * @returns {string} 
 */
function uuid() {
    return crypto.randomUUID();
}

/**
 * Creates a fast cryptographic Hash of a string using a specified algorithm.
 * @param {string} text - The input string to hash
 * @param {string} [algorithm='sha256'] - The algorithm ('sha256', 'md5', 'sha512', etc.)
 * @returns {string} The computed hash as an hexadecimal string.
 */
function hash(text, algorithm = 'sha256') {
    if (typeof text !== 'string') throw new TypeError('Text to hash must be a string');
    return crypto.createHash(algorithm).update(text).digest('hex');
}

/**
 * Generates a random hexadecimal string of a specified length.
 * Can be used to create tokens, secrets, or temporary passwords.
 * @param {number} [length=16] - Size in bytes (string length will be double: 32 chars)
 * @returns {string} The randomized string in hex.
 */
function randomString(length = 16) {
    if (typeof length !== 'number' || length <= 0) throw new TypeError('Length must be a positive number');
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Encrypts a string using AES-256-GCM.
 * @param {string} text - Text to encrypt
 * @param {string} secret - 32-character secret key
 * @returns {string} Encrypted data in format iv:content:tag (hex)
 */
function encrypt(text, secret) {
    if (typeof text !== 'string') throw new TypeError('Text must be a string');
    if (!secret || secret.length < 32) throw new Error('Secret must be at least 32 characters');

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(secret).subarray(0, 32), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${encrypted}:${tag}`;
}

/**
 * Decrypts a string previously encrypted with encrypt().
 * @param {string} encryptedData - Format iv:content:tag
 * @param {string} secret - 32-character secret key
 * @returns {string} Decrypted text
 */
function decrypt(encryptedData, secret) {
    if (!encryptedData || typeof encryptedData !== 'string') throw new TypeError('Data must be a string');
    const [ivHex, content, tagHex] = encryptedData.split(':');
    if (!ivHex || !content || !tagHex) throw new Error('Invalid encrypted data format');

    const decipher = crypto.createDecipheriv(
        'aes-256-gcm', 
        Buffer.from(secret).subarray(0, 32), 
        Buffer.from(ivHex, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    
    let decrypted = decipher.update(content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

/**
 * Generates an API key for your users, plus the hash to store in your database.
 * Only show `key` once to the user; store `hash` (and optionally `last4` for display).
 * @param {object} [options]
 * @param {string} [options.prefix='sk']  - Visible prefix, e.g. 'sk_live', 'pk_test'.
 * @param {number} [options.bytes=32]     - Random bytes (entropy).
 * @returns {{ key: string, hash: string, last4: string }}
 *
 * @example
 * const { key, hash } = generateApiKey({ prefix: 'sk_live' });
 * // later: const row = await db.apiKeys.findOne({ hash: hashApiKey(req.headers['x-api-key']) });
 */
function generateApiKey({ prefix = 'sk', bytes = 32 } = {}) {
    if (typeof bytes !== 'number' || bytes < 16) throw new TypeError('bytes must be at least 16');
    const key = `${prefix}_${crypto.randomBytes(bytes).toString('base64url')}`;
    return { key, hash: hashApiKey(key), last4: key.slice(-4) };
}

/**
 * Hashes an API key for storage and lookup (SHA-256, hex).
 * A fast hash is fine here because keys are long random strings, unlike passwords.
 * @param {string} key
 * @returns {string}
 */
function hashApiKey(key) {
    if (typeof key !== 'string' || !key) throw new TypeError('API key must be a non-empty string');
    return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Constant-time string comparison (for tokens, signatures, API keys).
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
    uuid,
    hash,
    randomString,
    encrypt,
    decrypt,
    generateApiKey,
    hashApiKey,
    safeEqual
};

