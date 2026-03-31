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

module.exports = {
    uuid,
    hash,
    randomString,
    encrypt,
    decrypt
};

