const assert = require('node:assert');
const test = require('node:test');
const { createCommandRegistry } = require('../lib/YoyoLib');
const { mockInteraction, mockMessage, mockClient } = require('../lib/testing');

test('testing - package export resolves', () => {
    assert.strictEqual(typeof require('yoyolib/testing').mockInteraction, 'function');
});

test('mockInteraction - follows Discord acknowledgement rules', async () => {
    const i = mockInteraction({ name: 'ping' });
    await assert.rejects(i.editReply('x'), { code: 10015 });
    await i.reply({ content: 'pong', flags: 64 });
    assert.strictEqual(i.replied, true);
    assert.strictEqual(i.ephemeral, true);
    await assert.rejects(i.reply('again'), { code: 40060 });
    await assert.rejects(i.deferReply(), { code: 40060 });
    await i.followUp('more');
    assert.deepStrictEqual(i.methods(), ['reply', 'followUp']);
    assert.deepStrictEqual(i.lastReply(), { content: 'more' });
    await assert.rejects(mockInteraction().update('x'), /only available on components/);
});

test('mockInteraction - options, subcommands, autocomplete, selects and modals', async () => {
    const slash = mockInteraction({ name: 'config', subcommand: 'roles add', options: { role: { id: '9' }, silent: true } });
    assert.strictEqual(slash.options.getSubcommandGroup(), 'roles');
    assert.strictEqual(slash.options.getSubcommand(), 'add');
    assert.deepStrictEqual(slash.options.getRole('role'), { id: '9' });
    assert.strictEqual(slash.options.getBoolean('silent'), true);
    assert.strictEqual(slash.options.getString('missing'), null);
    assert.throws(() => mockInteraction().options.getSubcommand(), /expected/);

    const auto = mockInteraction({ type: 'autocomplete', name: 'search', focused: 'q', options: { q: 'ab' } });
    assert.strictEqual(auto.options.getFocused(), 'ab');
    await auto.respond([{ name: 'abc', value: 'abc' }]);
    assert.deepStrictEqual(auto.responded, [{ name: 'abc', value: 'abc' }]);
    await assert.rejects(auto.reply('x'), /respond/);

    const select = mockInteraction({ type: 'select', customId: 'roles', values: ['a', 'b'] });
    assert.ok(select.isStringSelectMenu());
    await select.update({ content: 'saved' });

    const modal = mockInteraction({ type: 'modal', customId: 'feedback', fields: { text: 'great' } });
    assert.strictEqual(modal.fields.getTextInputValue('text'), 'great');
    await assert.rejects(modal.showModal({}), /cannot open another modal/);
});

test('mockInteraction - drives a registry end to end', async () => {
    const registry = createCommandRegistry({ onError: () => {}, autoDefer: { after: 10 } });
    registry.slash({
        name: 'ban', description: 'x', botPermissions: ['BanMembers'],
        execute: async (i) => { await new Promise(r => setTimeout(r, 30)); await i.reply(`Banned ${i.options.getUser('user').id}`); },
    });

    const denied = mockInteraction({ name: 'ban', appPermissions: ['SendMessages'] });
    assert.strictEqual((await registry.handleInteraction(denied)).status, 'bot_missing_permissions');
    assert.match(denied.lastReply().content, /Ban Members/);

    const ok = mockInteraction({ name: 'ban', options: { user: { id: '42' } }, latency: 2 });
    assert.strictEqual((await registry.handleInteraction(ok)).status, 'ok');
    assert.deepStrictEqual(ok.methods(), ['deferReply', 'editReply']);
    assert.strictEqual(ok.lastReply().content, 'Banned 42');
});

test('mockMessage and mockClient - prefix commands through attach()', async () => {
    const client = mockClient();
    const registry = createCommandRegistry({ prefix: '!', mentionPrefix: true, onError: () => {} });
    registry.prefix({ name: 'purge', botPermissions: ['ManageMessages'], execute: (m) => m.reply('done') });
    registry.attach(client);

    const blocked = mockMessage({ content: '!purge', botPermissions: ['SendMessages'] });
    client.emit('messageCreate', blocked);
    const allowed = mockMessage({ content: `<@${client.user.id}> purge` });
    client.emit('messageCreate', allowed);
    await new Promise(r => setImmediate(r));

    assert.match(blocked.lastReply().content, /Manage Messages/);
    assert.strictEqual(allowed.lastReply().content, 'done');
    const sent = await allowed.channel.send('hi');
    await sent.edit('edited');
    assert.strictEqual(sent.content, 'edited');
});
