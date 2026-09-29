const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createCommandRegistry, createLangManager, CommandRegistry } = require('../lib/YoyoLib');

// ─── Fakes shaped like discord.js v14 objects ────────────────────────────────

function fakeInteraction(fields) {
    const replies = [];
    return {
        user: { id: 'user-1' },
        guildId: 'guild-1',
        channelId: 'chan-1',
        locale: 'en-US',
        replied: false,
        deferred: false,
        replies,
        async reply(payload) { this.replied = true; replies.push(payload); },
        async followUp(payload) { replies.push(payload); },
        ...fields,
    };
}

const slash = (commandName, sub, extra = {}) => fakeInteraction({
    type: 2, commandType: 1, commandName,
    options: {
        getSubcommandGroup: () => (sub && sub.includes(' ') ? sub.split(' ')[0] : null),
        getSubcommand: () => (sub ? sub.split(' ').pop() : null),
    },
    ...extra,
});
const button = (customId, extra) => fakeInteraction({ type: 3, componentType: 2, customId, ...extra });
const select = (customId) => fakeInteraction({ type: 3, componentType: 3, customId, values: ['a'] });
const modal = (customId) => fakeInteraction({ type: 5, customId });

function fakeMessage(content, extra = {}) {
    const replies = [];
    return {
        type: 0, content, author: { id: 'user-1', bot: false }, guildId: 'guild-1', channelId: 'chan-1',
        replies, async reply(payload) { replies.push(payload); }, ...extra,
    };
}

const quiet = { onError: () => {} };

// ─── Tests ───────────────────────────────────────────────────────────────────

test('CommandRegistry - slash command routing', async () => {
    const registry = createCommandRegistry(quiet);
    let called = null;
    registry.slash({ name: 'ping', description: 'Pong', execute: (i, ctx) => { called = ctx; } });

    const res = await registry.handleInteraction(slash('ping'));
    assert.deepStrictEqual([res.handled, res.status, res.kind, res.name], [true, 'ok', 'slash', 'ping']);
    assert.strictEqual(called.userId, 'user-1');
    assert.strictEqual(called.guildId, 'guild-1');

    const missing = await registry.handleInteraction(slash('nope'));
    assert.strictEqual(missing.status, 'not_found');
});

test('CommandRegistry - subcommands and subcommand groups', async () => {
    const registry = createCommandRegistry(quiet);
    const calls = [];
    registry.slash({
        name: 'ticket', description: 'Tickets',
        subcommands: {
            open: (i, ctx) => calls.push(['open', ctx.subcommand]),
            'config set': { execute: (i, ctx) => calls.push(['config set', ctx.subcommand]), ownerOnly: true },
        },
    });

    await registry.handleInteraction(slash('ticket', 'open'));
    const denied = await registry.handleInteraction(slash('ticket', 'config set'));
    const unknown = await registry.handleInteraction(slash('ticket', 'close'));

    assert.deepStrictEqual(calls, [['open', 'open']]);
    assert.strictEqual(denied.status, 'owner_only');
    assert.strictEqual(unknown.status, 'not_found');
});

test('CommandRegistry - context menus, autocomplete, selects and modals', async () => {
    const registry = createCommandRegistry(quiet);
    const seen = [];
    registry
        .userContext({ name: 'Profile', execute: () => seen.push('user') })
        .messageContext({ name: 'Report', execute: () => seen.push('message') })
        .slash({ name: 'search', description: 'Search', execute: () => {}, autocomplete: () => seen.push('autocomplete') })
        .select({ id: 'role-picker', execute: (i) => seen.push(`select:${i.values}`) })
        .modal({ id: 'feedback', execute: () => seen.push('modal') });

    await registry.handleInteraction(fakeInteraction({ type: 2, commandType: 2, commandName: 'Profile' }));
    await registry.handleInteraction(fakeInteraction({ type: 2, commandType: 3, commandName: 'Report' }));
    await registry.handleInteraction(fakeInteraction({ type: 4, commandName: 'search' }));
    await registry.handleInteraction(select('role-picker'));
    await registry.handleInteraction(modal('feedback'));

    assert.deepStrictEqual(seen, ['user', 'message', 'autocomplete', 'select:a', 'modal']);
});

test('CommandRegistry - raw API payloads are supported', async () => {
    const registry = createCommandRegistry(quiet);
    const seen = [];
    registry.slash({ name: 'config', description: 'Config', subcommands: { 'roles add': (i, ctx) => seen.push(ctx.subcommand) } });
    registry.button({ id: 'ok', execute: (i, ctx) => seen.push(ctx.userId) });

    await registry.handleInteraction({
        type: 2, member: { user: { id: 'raw-user' } }, guild_id: 'g',
        data: { type: 1, name: 'config', options: [{ type: 2, name: 'roles', options: [{ type: 1, name: 'add' }] }] },
    });
    await registry.handleInteraction({ type: 3, member: { user: { id: 'raw-user' } }, data: { component_type: 2, custom_id: 'ok' } });

    assert.deepStrictEqual(seen, ['roles add', 'raw-user']);
});

test('CommandRegistry - button customId patterns and RegExp', async () => {
    const registry = createCommandRegistry(quiet);
    const seen = [];
    registry.button({ id: 'ticket:close:{ticketId}', execute: (i, ctx) => seen.push(ctx.params) });
    registry.button({ id: /^vote:(?<choice>yes|no)$/, execute: (i, ctx) => seen.push(ctx.params) });
    registry.button({ id: 'ticket:close:all', execute: () => seen.push('exact') });

    await registry.handleInteraction(button('ticket:close:42'));
    await registry.handleInteraction(button('vote:yes'));
    await registry.handleInteraction(button('ticket:close:all')); // exact wins over pattern
    const res = await registry.handleInteraction(button('vote:maybe'));

    assert.deepStrictEqual(seen, [{ ticketId: '42' }, { choice: 'yes' }, 'exact']);
    assert.strictEqual(res.status, 'not_found');
    assert.strictEqual(CommandRegistry.buildCustomId('ticket:close:{ticketId}', { ticketId: 7 }), 'ticket:close:7');
    assert.throws(() => CommandRegistry.buildCustomId('a:{b}', {}), TypeError);
    assert.throws(() => CommandRegistry.buildCustomId('x'.repeat(101)), RangeError);
});

test('CommandRegistry - cooldowns reply ephemerally, owners bypass them', async () => {
    const registry = createCommandRegistry({ ...quiet, ownerIds: ['owner'] });
    let runs = 0;
    registry.slash({ name: 'daily', description: 'Daily', cooldown: '1h', execute: () => { runs++; } });
    registry.button({ id: 'claim:{id}', cooldown: { duration: '1h', scope: 'guild' }, execute: () => { runs++; } });

    await registry.handleInteraction(slash('daily'));
    const blocked = slash('daily');
    const res = await registry.handleInteraction(blocked);
    assert.strictEqual(res.status, 'cooldown');
    assert.strictEqual(blocked.replies[0].flags, 64);
    assert.match(blocked.replies[0].content, /hour|minute/);

    await registry.handleInteraction(slash('daily', null, { user: { id: 'owner' } }));
    await registry.handleInteraction(slash('daily', null, { user: { id: 'owner' } }));

    // component cooldown is per handler, not per customId
    await registry.handleInteraction(button('claim:1'));
    const second = await registry.handleInteraction(button('claim:2', { user: { id: 'other' } }));
    assert.strictEqual(second.status, 'cooldown');

    assert.strictEqual(runs, 4);
});

test('CommandRegistry - guildOnly and check()', async () => {
    const registry = createCommandRegistry(quiet);
    registry.slash({ name: 'ban', description: 'Ban', guildOnly: true, execute: () => {} });
    registry.slash({ name: 'admin', description: 'Admin', check: (i) => i.user.id === 'boss' || 'Admins only', execute: () => {} });

    const dm = slash('ban', null, { guildId: null });
    assert.strictEqual((await registry.handleInteraction(dm)).status, 'guild_only');

    const nope = slash('admin');
    assert.strictEqual((await registry.handleInteraction(nope)).status, 'denied');
    assert.strictEqual(nope.replies[0].content, 'Admins only');

    assert.strictEqual((await registry.handleInteraction(slash('admin', null, { user: { id: 'boss' } }))).status, 'ok');
});

test('CommandRegistry - errors are reported and answered with followUp when deferred', async () => {
    const errors = [];
    const registry = createCommandRegistry({ onError: (err, ctx) => errors.push([err.message, ctx.name]) });
    registry.slash({ name: 'crash', description: 'Crash', execute: async (i) => { i.deferred = true; throw new Error('boom'); } });

    const interaction = slash('crash');
    const res = await registry.handleInteraction(interaction);

    assert.strictEqual(res.status, 'error');
    assert.deepStrictEqual(errors, [['boom', 'crash']]);
    assert.strictEqual(interaction.replies.length, 1); // via followUp since deferred
    assert.strictEqual(interaction.replies[0].flags, 64);
});

test('CommandRegistry - middlewares can enrich or stop', async () => {
    const registry = createCommandRegistry(quiet);
    const order = [];
    registry.use(async (ctx, next) => { order.push('mw1'); ctx.state.db = 'db'; await next(); order.push('mw1-after'); });
    registry.use(async (ctx, next) => { if (ctx.name === 'blocked') return; await next(); });
    registry.slash({ name: 'ok', description: 'x', execute: (i, ctx) => order.push(`run:${ctx.state.db}`) });
    registry.slash({ name: 'blocked', description: 'x', execute: () => order.push('never') });

    await registry.handleInteraction(slash('ok'));
    const res = await registry.handleInteraction(slash('blocked'));

    assert.deepStrictEqual(order, ['mw1', 'run:db', 'mw1-after', 'mw1', 'mw1-after']);
    assert.strictEqual(res.status, 'stopped');
});

test('CommandRegistry - prefix commands with aliases, quotes and dynamic prefix', async () => {
    const registry = createCommandRegistry({ ...quiet, prefix: (msg) => (msg.guildId === 'g2' ? '?' : ['!', '!!']) });
    const seen = [];
    registry.prefix({ name: 'say', aliases: ['echo'], execute: (m, args, ctx) => seen.push([ctx.alias, args]) });

    await registry.handleMessage(fakeMessage('!say hello "big world"'));
    await registry.handleMessage(fakeMessage('!!ECHO hi'));
    await registry.handleMessage(fakeMessage('?say custom', { guildId: 'g2' }));
    const ignored = await registry.handleMessage(fakeMessage('say nothing'));
    const bot = await registry.handleMessage(fakeMessage('!say x', { author: { id: 'b', bot: true } }));

    assert.deepStrictEqual(seen, [['say', ['hello', 'big world']], ['echo', ['hi']], ['say', ['custom']]]);
    assert.strictEqual(ignored.status, 'ignored');
    assert.strictEqual(bot.status, 'ignored');
    assert.throws(() => registry.prefix({ name: 'other', aliases: ['echo'], execute() {} }), /already used/);
});

test('CommandRegistry - attach() wires events, interactions and mention prefix', async () => {
    const client = new EventEmitter();
    client.user = { id: 'bot-id' };
    const registry = createCommandRegistry({ ...quiet, prefix: '!', mentionPrefix: true });
    const seen = [];

    registry.event({ name: 'ready', once: true, execute: (c, ctx) => seen.push(`ready:${ctx.client === client}`) });
    registry.slash({ name: 'ping', description: 'x', execute: () => seen.push('ping') });
    registry.prefix({ name: 'help', execute: () => seen.push('help') });
    registry.attach(client);
    registry.event({ name: 'guildCreate', execute: (guild) => seen.push(`guild:${guild.id}`) }); // after attach

    client.emit('ready', client);
    client.emit('ready', client);
    client.emit('guildCreate', { id: 'g9' });
    client.emit('interactionCreate', slash('ping'));
    client.emit('messageCreate', fakeMessage('<@bot-id> help'));
    await new Promise(r => setImmediate(r));

    assert.deepStrictEqual(seen, ['ready:true', 'guild:g9', 'ping', 'help']);
});

test('CommandRegistry - ctx.t uses the interaction locale', async () => {
    const lang = createLangManager({ fallback: 'en' });
    lang.addResource('en', { hi: 'Hello' }).addResource('fr', { hi: 'Bonjour' });
    const registry = createCommandRegistry({ ...quiet, lang });
    let text;
    registry.slash({ name: 'hi', description: 'x', execute: (i, ctx) => { text = ctx.t('hi'); } });

    await registry.handleInteraction(slash('hi', null, { locale: 'fr' }));
    assert.strictEqual(text, 'Bonjour');
});

test('CommandRegistry - toJSON() builds deployable payloads with localizations', () => {
    const lang = createLangManager();
    lang.addResource('en-US', { cmd: { ping: { name: 'ping', description: 'Check latency' } } });
    lang.addResource('fr', { cmd: { ping: { name: 'ping', description: 'Vérifie la latence' } } });
    const registry = createCommandRegistry({ lang });

    registry.slash({ name: 'ping', description: 'Check latency', i18n: 'cmd.ping', defaultMemberPermissions: 8n, execute() {} });
    registry.slash({ data: { toJSON: () => ({ name: 'built', description: 'From builder', options: [{ type: 3, name: 'q' }] }) }, execute() {} });
    registry.userContext({ name: 'Profile', execute() {} });
    registry.button({ id: 'x', execute() {} });

    const json = registry.toJSON();
    assert.strictEqual(json.length, 3);
    assert.deepStrictEqual(json[0], {
        type: 1, name: 'ping', description: 'Check latency', default_member_permissions: '8',
        name_localizations: { 'en-US': 'ping', fr: 'ping' },
        description_localizations: { 'en-US': 'Check latency', fr: 'Vérifie la latence' },
    });
    assert.deepStrictEqual(json[1], { type: 1, name: 'built', description: 'From builder', options: [{ type: 3, name: 'q' }] });
    assert.deepStrictEqual(json[2], { type: 2, name: 'Profile' });
});

test('CommandRegistry - deploy() PUTs commands to the Discord API', async () => {
    const originalFetch = global.fetch;
    let call;
    global.fetch = async (url, opts) => {
        call = { url, opts };
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => [] };
    };
    try {
        const registry = createCommandRegistry();
        registry.slash({ name: 'ping', description: 'x', execute() {} });
        await registry.deploy({ token: 'TOKEN', applicationId: 'APP', guildId: 'G' });

        assert.strictEqual(call.url, 'https://discord.com/api/v10/applications/APP/guilds/G/commands');
        assert.strictEqual(call.opts.method, 'PUT');
        assert.strictEqual(call.opts.headers.Authorization, 'Bot TOKEN');
        assert.strictEqual(JSON.parse(call.opts.body)[0].name, 'ping');
    } finally {
        global.fetch = originalFetch;
    }
});

test('CommandRegistry - loadDir() infers types from folder names', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yoyolib-bot-'));
    const write = (rel, src) => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), src);
    };
    write('commands/ping.js', `module.exports = { name: 'ping', description: 'x', execute() {} };`);
    write('commands/admin/ban.js', `module.exports = { name: 'ban', description: 'x', execute() {} };`);
    write('buttons/confirm.js', `module.exports = [{ id: 'yes', execute() {} }, { id: 'no', execute() {} }];`);
    write('events/ready.js', `module.exports = { name: 'ready', once: true, execute() {} };`);
    write('misc/profile.js', `module.exports = { type: 'userContext', name: 'Profile', execute() {} };`);
    write('commands/_helpers.js', `throw new Error('should be skipped');`);

    const registry = createCommandRegistry().loadDir(root);
    assert.deepStrictEqual(registry.list('slash').map(d => d.name).sort(), ['ban', 'ping']);
    assert.deepStrictEqual(registry.list('button').map(d => d.id), ['yes', 'no']);
    assert.strictEqual(registry.list('event').length, 1);
    assert.strictEqual(registry.list('userContext').length, 1);

    write('orphans/x.js', `module.exports = { name: 'x', execute() {} };`);
    assert.throws(() => createCommandRegistry().loadDir(path.join(root, 'orphans')), /Cannot infer/);
});

test('CommandRegistry - registration validation', () => {
    const registry = createCommandRegistry();
    assert.throws(() => registry.register({ type: 'nope' }), /Unknown handler type/);
    assert.throws(() => registry.slash({ name: 'a' }), /execute\(\) or subcommands/);
    assert.throws(() => registry.button({ execute() {} }), /needs an id/);
    registry.slash({ name: 'a', description: 'x', execute() {} });
    assert.throws(() => registry.slash({ name: 'a', description: 'x', execute() {} }), /already registered/);
});
