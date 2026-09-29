const assert = require('node:assert');
const test = require('node:test');

// Node cannot see every CommonJS export as an ESM named export, hence the explicit .mjs entry points.
test('ESM entry points expose every CommonJS export', async () => {
    for (const [cjs, mjs] of [['../index.js', '../index.mjs'], ['../lib/testing/index.js', '../lib/testing/index.mjs']]) {
        const expected = Object.keys(require(cjs)).sort();
        const esm = await import(mjs);
        const named = Object.keys(esm).filter(k => k !== 'default').sort();
        assert.deepStrictEqual(named, expected, `${mjs} is out of sync with ${cjs}`);
        assert.strictEqual(esm.default, require(cjs));
    }
});

test('ESM named imports through the package exports', async () => {
    const { createCommandRegistry, discordFormat, httpClient } = await import('yoyolib');
    const { mockInteraction } = await import('yoyolib/testing');
    assert.strictEqual(typeof createCommandRegistry, 'function');
    assert.strictEqual(discordFormat.userMention('1'), '<@1>');
    assert.strictEqual(typeof httpClient.get, 'function');
    assert.strictEqual(typeof mockInteraction, 'function');
});
