const assert = require('node:assert');
const test = require('node:test');
const { ansiColors } = require('../lib/YoyoLib');

test('ansiColors - wraps text with codes (simulating non-tty for CI)', (t) => {
    // In CI (non-tty), it should return plain text
    const redText = ansiColors.red('Hello');
    assert.strictEqual(typeof redText, 'string');
    // If we're not in a TTY, it should be the same as input
    if (!process.stdout.isTTY) {
        assert.strictEqual(redText, 'Hello');
    } else {
        assert.ok(redText.includes('\x1b[31m'));
    }
});

test('ansiColors - bold and reset', (t) => {
    const boldText = ansiColors.bold('Bold');
    if (process.stdout.isTTY) {
        assert.ok(boldText.startsWith('\x1b[1m'));
        assert.ok(boldText.endsWith('\x1b[0m'));
    }
});
