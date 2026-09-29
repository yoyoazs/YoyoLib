const assert = require('node:assert');
const test = require('node:test');
const { parseDuration, formatDuration } = require('../lib/YoyoLib');

test('parseDuration - simple and compound values', () => {
    assert.strictEqual(parseDuration('10s'), 10000);
    assert.strictEqual(parseDuration('1h30m'), 5400000);
    assert.strictEqual(parseDuration('2d 4h'), 2 * 86400000 + 4 * 3600000);
    assert.strictEqual(parseDuration('1 day 2 hours'), 86400000 + 2 * 3600000);
    assert.strictEqual(parseDuration('1.5h'), 5400000);
    assert.strictEqual(parseDuration('3 jours'), 3 * 86400000);
    assert.strictEqual(parseDuration(250), 250);
    assert.strictEqual(parseDuration('250'), 250);
});

test('parseDuration - rejects invalid input', () => {
    assert.throws(() => parseDuration('abc'), TypeError);
    assert.throws(() => parseDuration('10 parsecs'), TypeError);
    assert.throws(() => parseDuration('1h garbage'), TypeError);
    assert.throws(() => parseDuration(''), TypeError);
    assert.throws(() => parseDuration(null), TypeError);
});

test('formatDuration - short and long forms', () => {
    assert.strictEqual(formatDuration(5400000), '1h 30m');
    assert.strictEqual(formatDuration(5400000, { long: true }), '1 hour 30 minutes');
    assert.strictEqual(formatDuration(90061000, { maxUnits: 4 }), '1d 1h 1m 1s');
    assert.strictEqual(formatDuration(500), '500ms');
    assert.strictEqual(formatDuration(1000, { long: true }), '1 second');
});
