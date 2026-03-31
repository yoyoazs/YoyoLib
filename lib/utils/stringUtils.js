'use strict';

/**
 * Converts a string to a URL-friendly slug.
 * @param {string} str
 * @returns {string}
 */
function slugify(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .toLowerCase()
        .normalize('NFD') // decompose accents
        .replace(/[\u0300-\u036f]/g, '') // remove decomposed accents
        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphen
        .replace(/^-+|-+$/g, ''); // Trim hyphens from start/end
}

/**
 * Truncates a string to a max length and appends a suffix (default: "...").
 * @param {string} str
 * @param {number} length
 * @param {string} [suffix="..."]
 * @returns {string}
 */
function truncate(str, length, suffix = '...') {
    if (!str || typeof str !== 'string') return '';
    if (str.length <= length) return str;
    return str.substring(0, length) + suffix;
}

/**
 * Capitalizes the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts a string to camelCase.
 * @param {string} str
 * @returns {string}
 */
function camelCase(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase())
        .replace(/^[A-Z]/, c => c.toLowerCase());
}

module.exports = {
    slugify,
    truncate,
    capitalize,
    camelCase
};
