const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCommandRegistry, discordPermissions } = require('../lib/YoyoLib');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const quiet = { onError: () => {} };

/**
 * Interaction mimicking discord.js: `deferred` / `replied` only flip once the (simulated) API call
 * resolves, and acknowledging twice throws like Discord's 40060 error.
 */
function liveInteraction(fields = {}, latency = 5) {
    const calls = [];
    const i = {
        user: { id: 'u' }, guildId: 'g', replied: false, deferred: false, calls,
        options: { getSubcommand: () => null, getSubcommandGroup: () => null },
        async _ack(name, payload, flag) {
            if (this.replied || this.deferred || this._acking) throw new Error('Interaction has already been acknowledged.');
            this._acking = true;
            calls.push([name, payload]);
            await sleep(latency);
            this[flag] = true;
        },
        reply(p) { return this._ack('reply', p, 'replied'); },
        deferReply(p) { return this._ack('deferReply', p, 'deferred'); },
        update(p) { return this._ack('update', p, 'replied'); },
        deferUpdate(p) { return this._ack('deferUpdate', p, 'deferred'); },
        async editReply(p) {
            if (!this.deferred && !this.replied) throw new Error('not acknowledged');
            calls.push(['editReply', p]);
            this.replied = true;
        },
        async followUp(p) {
            if (!this.deferred && !this.replied) throw new Error('not acknowledged');
            calls.push(['followUp', p]);
        },
        ...fields,
    };
    return i;
}
const slashI = (name, extra) => liveInteraction({ type: 2, commandType: 1, commandName: name, ...extra });
const buttonI = (customId, extra) => liveInteraction({ type: 3, componentType: 2, customId, ...extra });
const names = (i) => i.calls.map(c => c[0]);

// ─── autoDefer ───────────────────────────────────────────────────────────────

test('autoDefer - slow command is deferred and reply() becomes editReply()', async () => {
    const registry = createCommandRegistry({ ...quiet, autoDefer: { after: 20 } });
    registry.slash({ name: 'slow', description: 'x', execute: async (i) => { await sleep(60); await i.reply({ content: 'done', flags: 64 }); } });

    const i = slashI('slow');
    const res = await registry.handleInteraction(i);

    assert.strictEqual(res.status, 'ok');
    assert.deepStrictEqual(names(i), ['deferReply', 'editReply']);
    assert.deepStrictEqual(i.calls[0][1], {});
    assert.deepStrictEqual(i.calls[1][1], { content: 'done' }); // ephemeral flag dropped for editReply
});

test('autoDefer - fast handlers are left alone', async () => {
    const registry = createCommandRegistry({ ...quiet, autoDefer: { after: 20 } });
    registry.slash({ name: 'fast', description: 'x', execute: (i) => i.reply('hi') });

    const i = slashI('fast');
    await registry.handleInteraction(i);
    await sleep(40);
    assert.deepStrictEqual(names(i), ['reply']);
});

test('autoDefer - no double acknowledgement when a reply is still in flight', async () => {
    const registry = createCommandRegistry({ ...quiet, autoDefer: { after: 10 } });
    registry.slash({ name: 'race', description: 'x', execute: (i) => i.reply('hi') });

    const i = slashI('race', {}, 0);
    i._ack = async function (name, p, flag) { // slow API: the reply is in flight when the timer fires
        if (this.replied || this.deferred) throw new Error('already acknowledged');
        this.calls.push([name, p]);
        await sleep(40);
        this[flag] = true;
    };
    const res = await registry.handleInteraction(i);
    assert.strictEqual(res.status, 'ok');
    assert.deepStrictEqual(names(i), ['reply']);
});

test('autoDefer - buttons use deferUpdate, update() becomes editReply(), reply() a followUp', async () => {
    const registry = createCommandRegistry({ ...quiet, autoDefer: { after: 15 } });
    registry.button({ id: 'refresh', execute: async (i) => { await sleep(40); await i.update({ content: 'v2' }); await i.reply('also'); } });

    const i = buttonI('refresh');
    await registry.handleInteraction(i);
    assert.deepStrictEqual(names(i), ['deferUpdate', 'editReply', 'followUp']);
});

test('autoDefer - ephemeral option, per-handler opt-out and handler calling deferReply itself', async () => {
    const registry = createCommandRegistry({ ...quiet, autoDefer: { after: 10, ephemeral: true } });
    registry.slash({ name: 'secret', description: 'x', execute: async (i) => { await sleep(30); await i.deferReply(); await i.reply('ok'); } });
    registry.slash({ name: 'modal', description: 'x', autoDefer: false, execute: async () => { await sleep(30); } });

    const a = slashI('secret');
    await registry.handleInteraction(a);
    assert.deepStrictEqual(names(a), ['deferReply', 'editReply']); // the handler's own deferReply became a no-op
    assert.deepStrictEqual(a.calls[0][1], { flags: 64 });

    const b = slashI('modal');
    await registry.handleInteraction(b);
    assert.deepStrictEqual(names(b), []);
});

test('autoDefer - errors after a defer fill the deferred reply', async () => {
    const registry = createCommandRegistry({ ...quiet, autoDefer: { after: 10 } });
    registry.slash({ name: 'crash', description: 'x', execute: async () => { await sleep(30); throw new Error('boom'); } });

    const i = slashI('crash');
    const res = await registry.handleInteraction(i);
    assert.strictEqual(res.status, 'error');
    assert.deepStrictEqual(names(i), ['deferReply', 'editReply']);
    assert.match(i.calls[1][1].content, /went wrong/);
});

// ─── Permissions ─────────────────────────────────────────────────────────────

test('botPermissions / userPermissions on interactions', async () => {
    const { PermissionFlags } = discordPermissions;
    const registry = createCommandRegistry(quiet);
    let runs = 0;
    registry.slash({
        name: 'ban', description: 'x',
        botPermissions: ['BanMembers'], userPermissions: ['BAN_MEMBERS'],
        execute: () => { runs++; },
    });

    const noBotPerm = slashI('ban', { appPermissions: { bitfield: 0n }, memberPermissions: { bitfield: PermissionFlags.BanMembers } });
    let res = await registry.handleInteraction(noBotPerm);
    assert.strictEqual(res.status, 'bot_missing_permissions');
    assert.deepStrictEqual(res.missing, ['BanMembers']);
    assert.match(noBotPerm.calls[0][1].content, /Ban Members/);

    const noUserPerm = slashI('ban', { app_permissions: '8', member: { user: { id: 'u' }, permissions: '0' } }); // raw payload
    res = await registry.handleInteraction(noUserPerm);
    assert.strictEqual(res.status, 'user_missing_permissions');

    const admin = slashI('ban', { appPermissions: { bitfield: PermissionFlags.Administrator }, memberPermissions: { bitfield: PermissionFlags.BanMembers } });
    assert.strictEqual((await registry.handleInteraction(admin)).status, 'ok');

    const dm = slashI('ban'); // no permission data: cannot check, so allowed
    assert.strictEqual((await registry.handleInteraction(dm)).status, 'ok');
    assert.strictEqual(runs, 2);
});

test('botPermissions on prefix messages use channel permissions', async () => {
    const { PermissionFlags } = discordPermissions;
    const registry = createCommandRegistry({ ...quiet, prefix: '!' });
    registry.prefix({ name: 'purge', botPermissions: ['ManageMessages'], execute: () => {} });

    const me = { id: 'bot' };
    const message = (bits) => ({
        type: 0, content: '!purge', author: { id: 'u' }, replies: [],
        guild: { id: 'g', members: { me } },
        channel: { id: 'c', permissionsFor: (member) => (member === me ? { bitfield: bits } : null) },
        async reply(p) { this.replies.push(p); },
    });

    const blocked = message(PermissionFlags.SendMessages);
    assert.strictEqual((await registry.handleMessage(blocked)).status, 'bot_missing_permissions');
    assert.match(blocked.replies[0].content, /Manage Messages/);
    assert.strictEqual((await registry.handleMessage(message(PermissionFlags.ManageMessages))).status, 'ok');
});

test('permission names are validated at registration and resolved in toJSON()', () => {
    const registry = createCommandRegistry();
    assert.throws(() => registry.slash({ name: 'x', description: 'x', botPermissions: ['ManageRole'], execute() {} }), /Unknown permission "ManageRole"/);

    registry.slash({ name: 'mod', description: 'x', defaultMemberPermissions: ['BanMembers', 'KICK_MEMBERS'], execute() {} });
    registry.slash({ name: 'open', description: 'x', defaultMemberPermissions: null, execute() {} });
    const [mod, open] = registry.toJSON();
    assert.strictEqual(mod.default_member_permissions, '6');
    assert.strictEqual(open.default_member_permissions, null);
});

test('discordPermissions helpers', () => {
    const { resolvePermissions, missingPermissions, formatPermission, PermissionFlags } = discordPermissions;
    assert.strictEqual(resolvePermissions(['ManageRoles', 'manage_channels']), PermissionFlags.ManageRoles | PermissionFlags.ManageChannels);
    assert.strictEqual(resolvePermissions('ManageEmojisAndStickers'), PermissionFlags.ManageGuildExpressions);
    assert.deepStrictEqual(missingPermissions(PermissionFlags.ManageRoles, ['ManageRoles', 'KickMembers']), ['KickMembers']);
    assert.deepStrictEqual(missingPermissions(PermissionFlags.Administrator, ['KickMembers']), []);
    assert.strictEqual(formatPermission('SendTTSMessages'), 'Send TTS Messages');
    assert.strictEqual(formatPermission('UseVAD'), 'Use Voice Activity');
});

// ─── Deploy only if changed ──────────────────────────────────────────────────

test('deploy({ onlyIfChanged }) skips unchanged commands', async () => {
    const cacheFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'yoyolib-deploy-')), 'hash.json');
    const originalFetch = global.fetch;
    let calls = 0;
    global.fetch = async () => { calls++; return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => [] }; };

    try {
        const opts = { token: 't', applicationId: 'app', guildId: 'g', onlyIfChanged: true, cacheFile };
        const registry = createCommandRegistry();
        registry.slash({ name: 'ping', description: 'x', execute() {} });

        assert.deepStrictEqual(await registry.deploy(opts), []);
        assert.strictEqual(await registry.deploy(opts), null);
        assert.strictEqual(calls, 1);

        // other target → deployed
        await registry.deploy({ ...opts, guildId: 'other' });
        assert.strictEqual(calls, 2);

        // changed commands → deployed again
        registry.slash({ name: 'pong', description: 'x', execute() {} });
        await registry.deploy(opts);
        assert.strictEqual(calls, 3);

        // without the option, always deployed
        await registry.deploy({ token: 't', applicationId: 'app', guildId: 'g' });
        assert.strictEqual(calls, 4);
        assert.match(registry.commandsHash(), /^[a-f0-9]{64}$/);
    } finally {
        global.fetch = originalFetch;
    }
});
