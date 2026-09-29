const assert = require('node:assert');
const test = require('node:test');
const { createCommandRegistry } = require('../lib/YoyoLib');
const { parseArguments, formatUsage, validateArgDefs } = require('../lib/bot/arguments');

const USER = '123456789012345678';
const CHANNEL = '223456789012345678';
const ROLE = '323456789012345678';

const banArgs = [
    { name: 'user', type: 'user' },
    { name: 'duration', type: 'duration', required: false, max: '30d' },
    { name: 'reason', type: 'rest', default: 'No reason' },
];

test('arguments - mentions, ids, durations and rest', async () => {
    assert.deepStrictEqual(
        await parseArguments(banArgs, [`<@!${USER}>`, '2h', 'spamming', 'links']),
        { user: USER, duration: 7200000, reason: 'spamming links' },
    );
    // optional duration that does not match is skipped: its token goes to "reason"
    assert.deepStrictEqual(
        await parseArguments(banArgs, [USER, 'spamming']),
        { user: USER, duration: undefined, reason: 'spamming' },
    );
    assert.deepStrictEqual(await parseArguments(banArgs, [`<@${USER}>`]), { user: USER, duration: undefined, reason: 'No reason' });

    const all = [{ name: 'c', type: 'channel' }, { name: 'r', type: 'role' }, { name: 's', type: 'snowflake' }];
    assert.deepStrictEqual(await parseArguments(all, [`<#${CHANNEL}>`, `<@&${ROLE}>`, USER]), { c: CHANNEL, r: ROLE, s: USER });
});

test('arguments - numbers, booleans, strings and choices', async () => {
    const defs = [
        { name: 'amount', type: 'integer', min: 1, max: 100 },
        { name: 'ratio', type: 'number' },
        { name: 'silent', type: 'boolean' },
        { name: 'mode', choices: ['Fast', 'Safe'] },
        { name: 'tag', min: 2, max: 4, regex: /^[a-z]+$/ },
    ];
    assert.deepStrictEqual(
        await parseArguments(defs, ['10', '0,5', 'oui', 'fast', 'abc']),
        { amount: 10, ratio: 0.5, silent: true, mode: 'Fast', tag: 'abc' },
    );

    const fails = async (tokens, message) => assert.rejects(parseArguments(defs, tokens), { name: 'ArgumentError', message });
    await fails(['1.5'], /whole number/);
    await fails(['500'], /at most 100/);
    await fails(['5', 'x'], /must be a number/);
    await fails(['5', '1', 'maybe'], /yes or no/);
    await fails(['5', '1', 'no', 'slow'], /one of: Fast, Safe/);
    await fails(['5', '1', 'no', 'safe', 'ABC'], /invalid format/);
    await fails(['5', '1', 'no', 'safe'], /Missing argument "tag"/);
});

test('arguments - durations need a unit and respect min/max', async () => {
    const defs = [{ name: 'd', type: 'duration', min: '1m', max: '1d' }];
    assert.strictEqual((await parseArguments(defs, ['1h30m'])).d, 5400000);
    await assert.rejects(parseArguments(defs, ['10']), /duration like/);
    await assert.rejects(parseArguments(defs, ['30s']), /at least 1m/);
    await assert.rejects(parseArguments(defs, ['2d']), /at most 1d/);
});

test('arguments - resolvers turn ids into objects', async () => {
    const resolvers = { user: async (id) => (id === USER ? { id, tag: 'alice' } : null) };
    const defs = [{ name: 'target', type: 'user' }];
    assert.deepStrictEqual(await parseArguments(defs, [USER], { resolvers }), { target: { id: USER, tag: 'alice' } });
    await assert.rejects(parseArguments(defs, ['999999999999999999'], { resolvers }), /User not found/);
});

test('arguments - definitions are validated and usage is generated', () => {
    assert.throws(() => validateArgDefs([{ name: 'a', type: 'rest' }, { name: 'b' }], 'x'), /must be the last one/);
    assert.throws(() => validateArgDefs([{ name: 'a', type: 'emoji' }], 'x'), /Unknown argument type/);
    assert.throws(() => validateArgDefs([{ name: 'a' }, { name: 'a' }], 'x'), /Duplicate/);
    assert.strictEqual(formatUsage('!', 'ban', banArgs), '!ban <user> [duration] [reason...]');
    assert.strictEqual(formatUsage('<@1>', 'ban', []), '<@1> ban');
});

test('CommandRegistry - prefix args are parsed before the cooldown and usage is replied', async () => {
    const registry = createCommandRegistry({ prefix: '!', onError: () => {} });
    const seen = [];
    registry.prefix({ name: 'ban', aliases: ['b'], args: banArgs, cooldown: '1h', execute: (m, args, ctx) => seen.push([args, ctx.args]) });
    assert.throws(() => registry.prefix({ name: 'bad', args: [{ name: 'x', type: 'nope' }], execute() {} }), /Unknown argument type/);

    const message = (content) => ({ content, author: { id: 'u' }, replies: [], async reply(p) { this.replies.push(p); } });

    const wrong = message('!b notauser');
    const res = await registry.handleMessage(wrong);
    assert.strictEqual(res.status, 'invalid_args');
    assert.strictEqual(wrong.replies[0].content, '❌ "user" must be a user mention or ID\nUsage: `!b <user> [duration] [reason...]`');

    // the typo did not consume the cooldown
    assert.strictEqual((await registry.handleMessage(message(`!ban <@${USER}> 1d raid`))).status, 'ok');
    assert.deepStrictEqual(seen[0], [{ user: USER, duration: 86400000, reason: 'raid' }, [`<@${USER}>`, '1d', 'raid']]);
    assert.strictEqual((await registry.handleMessage(message(`!ban ${USER}`))).status, 'cooldown');
});
