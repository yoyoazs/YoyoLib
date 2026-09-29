'use strict';

const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

const DEFAULTS = { cost: 2 ** 15, blockSize: 8, parallelization: 1, keyLength: 64, saltLength: 16 };

/**
 * Password hashing with scrypt (built into Node, memory-hard, no native addon).
 * Hashes are self-describing strings: `$scrypt$n=32768,r=8,p=1$<salt>$<hash>`,
 * so parameters can be raised later and old hashes still verify (see needsRehash).
 */

/**
 * Hashes a password.
 * @param {string} password
 * @param {object} [options]
 * @param {number} [options.cost=32768]         - CPU/memory cost (N), power of two.
 * @param {number} [options.blockSize=8]        - r
 * @param {number} [options.parallelization=1] - p
 * @param {number} [options.keyLength=64]
 * @param {number} [options.saltLength=16]
 * @returns {Promise<string>}
 */
async function hash(password, options = {}) {
    if (typeof password !== 'string' || password.length === 0) throw new TypeError('Password must be a non-empty string');
    const { cost, blockSize, parallelization, keyLength, saltLength } = { ...DEFAULTS, ...options };
    if (!Number.isInteger(Math.log2(cost))) throw new TypeError('cost must be a power of two');

    const salt = crypto.randomBytes(saltLength);
    const derived = await derive(password, salt, keyLength, cost, blockSize, parallelization);
    return `$scrypt$n=${cost},r=${blockSize},p=${parallelization}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

/**
 * Checks a password against a stored hash, in constant time.
 * Returns false (never throws) for malformed hashes.
 * @param {string} password
 * @param {string} stored
 * @returns {Promise<boolean>}
 */
async function verify(password, stored) {
    if (typeof password !== 'string') return false;
    const parsed = parse(stored);
    if (!parsed) return false;
    try {
        const derived = await derive(password, parsed.salt, parsed.hash.length, parsed.n, parsed.r, parsed.p);
        return crypto.timingSafeEqual(derived, parsed.hash);
    } catch (_) {
        return false;
    }
}

/**
 * Tells whether a stored hash uses weaker parameters than the current ones.
 * Call it after a successful login and re-hash the password if true.
 * @param {string} stored
 * @param {object} [options] - Same as hash().
 * @returns {boolean}
 */
function needsRehash(stored, options = {}) {
    const parsed = parse(stored);
    if (!parsed) return true;
    const { cost, blockSize, parallelization, keyLength } = { ...DEFAULTS, ...options };
    return parsed.n < cost || parsed.r < blockSize || parsed.p < parallelization || parsed.hash.length < keyLength;
}

function derive(password, salt, keyLength, N, r, p) {
    // Node's default maxmem (32 MB) is too low for N = 2^15; allow what the parameters need
    const maxmem = 128 * N * r * p + 32 * 1024 * 1024;
    return scrypt(password.normalize('NFKC'), salt, keyLength, { N, r, p, maxmem });
}

function parse(stored) {
    if (typeof stored !== 'string') return null;
    const m = /^\$scrypt\$n=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$/.exec(stored);
    if (!m) return null;
    const n = Number(m[1]), r = Number(m[2]), p = Number(m[3]);
    // Refuse absurd parameters from a tampered hash (memory exhaustion)
    if (n < 2 || n > 2 ** 20 || r < 1 || r > 32 || p < 1 || p > 16) return null;
    const hashBuf = Buffer.from(m[5], 'base64');
    if (hashBuf.length < 16) return null;
    return { n, r, p, salt: Buffer.from(m[4], 'base64'), hash: hashBuf };
}

module.exports = { hash, verify, needsRehash };
