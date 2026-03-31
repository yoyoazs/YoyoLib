'use strict';

const crypto = require('crypto');

/**
 * Base64URL encode buffer/string.
 * @param {string|Buffer} str
 * @returns {string}
 */
const b64Encode = (str) => {
    return Buffer.from(str)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
};

/**
 * Base64URL decode string.
 * @param {string} str
 * @returns {string}
 */
const b64Decode = (str) => {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return Buffer.from(base64, 'base64').toString('utf8');
};

/**
 * Creates an HMAC SHA-256 signature for JWT.
 * @param {string} input
 * @param {string} secret
 * @returns {string}
 */
const signHS256 = (input, secret) => {
    return crypto.createHmac('sha256', secret).update(input).digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
};

/**
 * Minimalist JWT implementation using HS256 algorithm.
 */
class jwtUtils {
    /**
     * Signs a JSON Web Token.
     * @param {object} payload - Data to encode.
     * @param {string} secret - Secret key.
     * @param {number} [expiresIn=86400] - Expiry in seconds (default 24h).
     * @returns {string} The signed JWT.
     */
    static sign(payload, secret, expiresIn = 86400) {
        if (!payload || typeof payload !== 'object') throw new TypeError('Payload must be an object');
        if (!secret || typeof secret !== 'string') throw new TypeError('Secret is required');

        const header = { alg: 'HS256', typ: 'JWT' };
        
        // Add absolute expiry time and Issue At time
        const now = Math.floor(Date.now() / 1000);
        const data = { ...payload, iat: now, exp: now + expiresIn };

        const encodedHeader = b64Encode(JSON.stringify(header));
        const encodedData = b64Encode(JSON.stringify(data));

        const tokenData = `${encodedHeader}.${encodedData}`;
        const signature = signHS256(tokenData, secret);

        return `${tokenData}.${signature}`;
    }

    /**
     * Verifies and decodes a JSON Web Token.
     * @param {string} token - The signed token.
     * @param {string} secret - Secret key.
     * @returns {object} The decoded payload.
     * @throws {Error} If token is invalid or expired.
     */
    static verify(token, secret) {
        if (!token || typeof token !== 'string') throw new Error('Invalid token format');
        if (!secret || typeof secret !== 'string') throw new TypeError('Secret is required');

        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Malformed token');

        const [encodedHeader, encodedData, signature] = parts;
        const validSignature = signHS256(`${encodedHeader}.${encodedData}`, secret);

        // Prevent timing attacks by using crypto.timingSafeEqual
        if (validSignature.length !== signature.length || 
            !crypto.timingSafeEqual(Buffer.from(validSignature), Buffer.from(signature))) {
            throw new Error('Invalid signature');
        }

        const payload = JSON.parse(b64Decode(encodedData));
        if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
            throw new Error('Token expired');
        }

        return payload;
    }

    /**
     * Decode a JSON Web Token payload WITHOUT verifying the signature.
     * Only use this to inspect data, do not trust this payload for auth!
     * @param {string} token 
     * @returns {object}
     */
    static decode(token) {
        if (!token || typeof token !== 'string') throw new Error('Invalid token format');
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Malformed token');

        try {
            return JSON.parse(b64Decode(parts[1]));
        } catch (e) {
            throw new Error('Invalid token payload');
        }
    }
}

module.exports = jwtUtils;
