const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createGuildSettings, createCommandRegistry, MemoryStore, JsonFileStore } = require('../lib/YoyoLib');

const G = '123456789012345678';
const CHANNEL = '987654321098765432';

const defaults = { prefix: '!', locale: 'en', logChannel: null, modules: { music: true, levels: false }, admins: [] };
const schema = {
    prefix: { type: 'string', min: 1, max: 5 },
    locale: { choices: ['en', 'fr'] },
    logChannel: { type: 'snowflake' },
    'modules.music': { type: 'boolean' },
    'modules.levels': { type: 'boolean' },
    admins: { type: 'array', max: 2 },
    volume: { type: 'number', min: 0, max: 100, validate: (v) => Number.isInteger(v) || 'Volume must be an integer' },
};

test('GuildSettings - defaults, overrides and dot paths', async () => {
    const store = new MemoryStore({ sweepInterval: 0 });
    const settings = createGuildSettings({ store, defaults, schema });

    assert.deepStrictEqual(await settings.get(G), defaults);
    assert.strictEqual(await settings.get(null, 'prefix'), '!'); // DMs → defaults

    await settings.set(G, 'prefix', '?');
    await settings.set(G, { locale: 'fr', modules: { music: false } });

    assert.strictEqual(await settings.get(G, 'prefix'), '?');
    assert.strictEqual(await settings.get(G, 'modules.music'), false);
    assert.strictEqual(await settings.get(G, 'modules.levels'), false); // untouched default kept
    assert.deepStrictEqual(await settings.overrides(G), { prefix: '?', locale: 'fr', modules: { music: false } });

    // only overrides are stored
    assert.deepStrictEqual(await store.get(`guild-settings:${G}`), { prefix: '?', locale: 'fr', modules: { music: false } });
});

test('GuildSettings - reset restores defaults and cleans the store', async () => {
    const store = new MemoryStore({ sweepInterval: 0 });
    const settings = createGuildSettings({ store, defaults, schema });

    await settings.set(G, { prefix: '?', modules: { music: false } });
    await settings.reset(G, 'modules.music');
    assert.deepStrictEqual(await settings.overrides(G), { prefix: '?' }); // empty "modules" pruned

    await settings.reset(G, 'prefix');
    assert.strictEqual(await store.get(`guild-settings:${G}`), null);

    await settings.set(G, 'locale', 'fr');
    await settings.delete(G);
    assert.deepStrictEqual(await settings.get(G), defaults);
});

test('GuildSettings - validation', async () => {
    const settings = createGuildSettings({ defaults, schema });

    const rejects = (key, value, message) => assert.rejects(settings.set(G, key, value), { name: 'ValidationError', message });
    await rejects('prefix', '', /at least 1 characters/);
    await rejects('prefix', 'toolong', /at most 5 characters/);
    await rejects('prefix', 3, /must be a string/);
    await rejects('locale', 'de', /one of: en, fr/);
    await rejects('logChannel', 'general', /Discord ID/);
    await rejects('admins', ['a', 'b', 'c'], /at most 2 items/);
    await rejects('volume', 150, /at most 100/);
    await rejects('volume', 5.5, /Volume must be an integer/);
    await rejects('unknown', 1, /Unknown setting "unknown"/);
    await rejects('modules', { music: 'yes' }, /must be a boolean/);
    await rejects('__proto__.polluted', true, /Invalid setting key/);

    // null is accepted when the default is null
    await settings.set(G, 'logChannel', CHANNEL);
    await settings.set(G, 'logChannel', null);
    assert.strictEqual(await settings.get(G, 'logChannel'), null);

    // a failing patch writes nothing
    await assert.rejects(settings.set(G, { prefix: '$', locale: 'de' }), /one of/);
    assert.strictEqual(await settings.get(G, 'prefix'), '!');
    assert.strictEqual({}.polluted, undefined);
});

test('GuildSettings - without schema, any safe key is accepted', async () => {
    const settings = createGuildSettings({ defaults: { a: 1 } });
    await settings.set(G, 'custom.nested', 'x');
    assert.strictEqual(await settings.get(G, 'custom.nested'), 'x');
    await assert.rejects(settings.set(G, { constructor: { prototype: { polluted: true } } }), /Invalid setting key/);
    assert.strictEqual({}.polluted, undefined);
});

test('GuildSettings - returned objects cannot corrupt the cache or defaults', async () => {
    const settings = createGuildSettings({ defaults, schema });
    const s = await settings.get(G);
    s.prefix = 'mutated';
    s.modules.music = 'mutated';
    s.admins.push('x');
    assert.deepStrictEqual(await settings.get(G), defaults);
});

test('GuildSettings - local cache, dedupe and invalidate', async () => {
    const inner = new MemoryStore({ sweepInterval: 0 });
    let reads = 0;
    const store = { ...inner, get: async (k) => { reads++; return inner.get(k); }, set: (...a) => inner.set(...a), delete: (k) => inner.delete(k) };
    const settings = createGuildSettings({ store, defaults, schema, cacheTtl: '1m' });

    await Promise.all([settings.get(G), settings.get(G), settings.get(G)]);
    assert.strictEqual(reads, 1);
    await settings.get(G, 'prefix');
    assert.strictEqual(reads, 1);

    // another process changed the store
    await inner.set(`guild-settings:${G}`, { prefix: '>' });
    assert.strictEqual(await settings.get(G, 'prefix'), '!'); // cached
    settings.invalidate(G);
    assert.strictEqual(await settings.get(G, 'prefix'), '>');

    // writes always read fresh data first, so they do not erase external changes
    await inner.set(`guild-settings:${G}`, { prefix: '>', locale: 'fr' });
    await settings.set(G, 'modules.music', false);
    assert.deepStrictEqual(await settings.overrides(G), { prefix: '>', locale: 'fr', modules: { music: false } });
});

test('GuildSettings - for() binds a guild and the registry exposes ctx.settings', async () => {
    const settings = createGuildSettings({ defaults, schema });
    const bound = settings.for(G);
    await bound.set('prefix', '%');
    assert.strictEqual(await bound.get('prefix'), '%');

    const registry = createCommandRegistry({
        settings,
        prefix: (msg) => settings.get(msg.guildId, 'prefix'),
        onError: () => {},
    });
    let seen;
    registry.prefix({ name: 'config', execute: async (m, args, ctx) => { seen = await ctx.settings.get('prefix'); } });

    const res = await registry.handleMessage({ content: '%config', author: { id: 'u' }, guildId: G, reply() {} });
    assert.strictEqual(res.status, 'ok');
    assert.strictEqual(seen, '%');
    assert.strictEqual((await registry.handleMessage({ content: '!config', author: { id: 'u' }, guildId: G, reply() {} })).status, 'ignored');
});

test('JsonFileStore - persists across restarts with atomic writes', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'yoyolib-json-')), 'nested', 'store.json');

    const first = new JsonFileStore({ file, writeDelay: 10, sweepInterval: 0 });
    const settings = createGuildSettings({ store: first, defaults, schema });
    await settings.set(G, { prefix: '?', modules: { levels: true } });
    await first.set('temp', 'x', 1); // expires almost immediately
    first.close();

    await new Promise(r => setTimeout(r, 5));
    const second = new JsonFileStore({ file, sweepInterval: 0 });
    const reloaded = createGuildSettings({ store: second, defaults, schema });
    assert.strictEqual(await reloaded.get(G, 'prefix'), '?');
    assert.strictEqual(await reloaded.get(G, 'modules.levels'), true);
    assert.strictEqual(await second.get('temp'), null);
    assert.deepStrictEqual(fs.readdirSync(path.dirname(file)), ['store.json']); // no leftover temp file
    second.close();

    fs.writeFileSync(file, '{ broken');
    assert.throws(() => new JsonFileStore({ file }), /cannot parse/);
});
