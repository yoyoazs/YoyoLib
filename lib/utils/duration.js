'use strict';

const UNITS = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
};

const ALIASES = {
    ms: 'ms', msec: 'ms', millisecond: 'ms', milliseconds: 'ms',
    s: 's', sec: 's', secs: 's', second: 's', seconds: 's',
    m: 'm', min: 'm', mins: 'm', minute: 'm', minutes: 'm',
    h: 'h', hr: 'h', hrs: 'h', hour: 'h', hours: 'h',
    d: 'd', day: 'd', days: 'd', j: 'd', jour: 'd', jours: 'd',
    w: 'w', wk: 'w', week: 'w', weeks: 'w', sem: 'w', semaine: 'w', semaines: 'w',
};

/**
 * Parses a human duration into milliseconds.
 * Accepts compound values ("1h30m", "2d 4h", "1 day 2 hours").
 * A plain number (or numeric string) is treated as milliseconds.
 *
 * @param {string|number} input
 * @returns {number} Duration in milliseconds.
 * @throws {TypeError} If the input cannot be parsed.
 *
 * @example
 * parseDuration('1h30m'); // 5400000
 * parseDuration('10s');   // 10000
 */
function parseDuration(input) {
    if (typeof input === 'number') {
        if (!Number.isFinite(input)) throw new TypeError('Duration must be a finite number');
        return input;
    }
    if (typeof input !== 'string' || input.trim() === '') throw new TypeError('Duration must be a non-empty string or a number');

    const str = input.trim().toLowerCase();
    if (/^-?\d+(\.\d+)?$/.test(str)) return Number(str);

    const re = /(-?\d+(?:\.\d+)?)\s*([a-z]+)/g;
    let total = 0;
    let consumed = '';
    let match;
    while ((match = re.exec(str)) !== null) {
        const unit = ALIASES[match[2]];
        if (!unit) throw new TypeError(`Unknown duration unit "${match[2]}" in "${input}"`);
        total += Number(match[1]) * UNITS[unit];
        consumed += match[0];
    }

    if (consumed.replace(/\s+/g, '') !== str.replace(/\s+/g, '')) {
        throw new TypeError(`Invalid duration: "${input}"`);
    }
    return Math.round(total);
}

/**
 * Formats milliseconds into a compact human string.
 *
 * @param {number} ms
 * @param {object} [options]
 * @param {boolean} [options.long=false] - "1 hour 30 minutes" instead of "1h 30m".
 * @param {number}  [options.maxUnits=2] - Maximum number of units to display.
 * @returns {string}
 *
 * @example
 * formatDuration(5400000);                 // "1h 30m"
 * formatDuration(5400000, { long: true }); // "1 hour 30 minutes"
 */
function formatDuration(ms, { long = false, maxUnits = 2 } = {}) {
    if (typeof ms !== 'number' || !Number.isFinite(ms)) throw new TypeError('ms must be a finite number');

    const sign = ms < 0 ? '-' : '';
    let remaining = Math.abs(Math.round(ms));
    if (remaining < 1000) return long ? `${sign}${remaining} millisecond${remaining === 1 ? '' : 's'}` : `${sign}${remaining}ms`;

    const names = { d: 'day', h: 'hour', m: 'minute', s: 'second' };
    const parts = [];
    for (const unit of ['d', 'h', 'm', 's']) {
        const value = Math.floor(remaining / UNITS[unit]);
        if (value > 0) {
            parts.push(long ? `${value} ${names[unit]}${value === 1 ? '' : 's'}` : `${value}${unit}`);
            remaining -= value * UNITS[unit];
        }
        if (parts.length >= maxUnits) break;
    }
    return sign + parts.join(' ');
}

module.exports = { parseDuration, formatDuration };
