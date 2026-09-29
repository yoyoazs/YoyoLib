const assert = require('node:assert');
const test = require('node:test');
const { createCommandRegistry } = require('../lib/YoyoLib');
const { mockInteraction, mockMessage } = require('../lib/testing');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const row = (payload) => payload.components[payload.components.length - 1].components;
const click = (customId, userId = '100000000000000001') => mockInteraction({ type: 'button', customId, user: { id: userId } });

test('paginate - pages, author-only buttons and expired sessions', async () => {
    const registry = createCommandRegistry({ onError: (e) => { throw e; } });
    registry.slash({ name: 'list', description: 'x', execute: (i, ctx) => ctx.registry.paginate(i, ['p1', { content: 'p2', embeds: [{ title: 'two' }] }, 'p3']) });

    const cmd = mockInteraction({ name: 'list' });
    await registry.handleInteraction(cmd);
    let buttons = row(cmd.lastReply());
    assert.strictEqual(cmd.lastReply().content, 'p1');
    assert.deepStrictEqual(buttons.map(b => [b.label, b.disabled]), [['◀', true], ['1/3', true], ['▶', false]]);

    const next = click(buttons[2].custom_id);
    assert.strictEqual((await registry.handleInteraction(next)).status, 'ok');
    assert.deepStrictEqual(next.methods(), ['update']);
    assert.strictEqual(next.lastReply().content, 'p2');
    assert.deepStrictEqual(next.lastReply().embeds, [{ title: 'two' }]);
    buttons = row(next.lastReply());
    assert.deepStrictEqual(buttons.map(b => [b.label, b.disabled]), [['◀', false], ['2/3', true], ['▶', false]]);

    const intruder = click(buttons[2].custom_id, 'someone-else');
    await registry.handleInteraction(intruder);
    assert.match(intruder.lastReply().content, /Only the person/);
    assert.strictEqual(intruder.lastReply().flags, 64);

    const stale = click('yoyo:page:000000000000:next');
    await registry.handleInteraction(stale);
    assert.match(stale.lastReply().content, /expired/);

    assert.strictEqual(registry.list('button').length, 0); // internal handler hidden
});

test('paginate - buttons are disabled after inactivity, single page has no buttons', async () => {
    const registry = createCommandRegistry();
    const cmd = mockInteraction({ name: 'x' });
    await registry.paginate(cmd, ['a', 'b'], { timeout: 30 });
    await sleep(60);
    assert.deepStrictEqual(cmd.methods(), ['reply', 'editReply']);
    assert.ok(row(cmd.lastReply()).every(b => b.disabled));

    const single = mockInteraction({ name: 'x' });
    const session = await registry.paginate(single, ['only']);
    assert.strictEqual(session.id, null);
    assert.strictEqual(single.lastReply().components, undefined);
    await assert.rejects(registry.paginate(single, []), TypeError);
});

test('paginate - works from a prefix message and after a defer', async () => {
    const registry = createCommandRegistry();
    const msg = mockMessage({ content: '!list' });
    const { stop } = await registry.paginate(msg, ['a', 'b']);
    const sent = msg.lastReply();

    const next = click(row(sent)[2].custom_id, msg.author.id);
    await registry.handleInteraction(next);
    assert.strictEqual(next.lastReply().content, 'b');

    await stop();
    assert.ok(row(sent.edits[0]).every(b => b.disabled));

    const deferred = mockInteraction({ name: 'x' });
    await deferred.deferReply();
    await registry.paginate(deferred, ['a', 'b'], { ephemeral: true });
    assert.deepStrictEqual(deferred.methods(), ['deferReply', 'editReply']);
    assert.strictEqual(deferred.lastReply().flags, undefined);
});

test('confirm - resolves with the answer, the button interaction and disables buttons', async () => {
    const registry = createCommandRegistry({ onError: (e) => { throw e; } });
    let answer;
    registry.slash({
        name: 'wipe', description: 'x',
        execute: async (i, ctx) => {
            answer = await ctx.registry.confirm(i, 'Delete everything?', { danger: true });
            if (answer.confirmed) await answer.interaction.followUp('Deleted.');
        },
    });

    const cmd = mockInteraction({ name: 'wipe' });
    const running = registry.handleInteraction(cmd);
    await sleep(5);
    const buttons = row(cmd.lastReply());
    assert.deepStrictEqual(buttons.map(b => [b.label, b.style]), [['Confirm', 4], ['Cancel', 2]]);

    const yes = click(buttons[0].custom_id);
    await registry.handleInteraction(yes);
    await running;

    assert.strictEqual(answer.confirmed, true);
    assert.strictEqual(answer.reason, 'confirmed');
    assert.strictEqual(answer.interaction, yes);
    assert.deepStrictEqual(yes.methods(), ['update', 'followUp']);
    assert.ok(row(yes.calls[0].payload).every(b => b.disabled));

    // a second click on the same prompt is refused
    const again = click(buttons[0].custom_id);
    await registry.handleInteraction(again);
    assert.match(again.lastReply().content, /expired/);
});

test('confirm - cancel and timeout', async () => {
    const registry = createCommandRegistry();
    const a = mockInteraction({ name: 'x' });
    const pending = registry.confirm(a, 'Sure?');
    await sleep(1);
    await registry.handleInteraction(click(row(a.lastReply())[1].custom_id));
    assert.deepStrictEqual((await pending).confirmed, false);
    assert.strictEqual((await pending).reason, 'cancelled');

    const b = mockInteraction({ name: 'x' });
    const timedOut = await registry.confirm(b, 'Sure?', { timeout: 20 });
    assert.deepStrictEqual([timedOut.confirmed, timedOut.reason, timedOut.interaction], [false, 'timeout', null]);
    assert.ok(row(b.lastReply()).every(btn => btn.disabled));

    await assert.rejects(registry.confirm(mockInteraction(), { content: 'x', components: [1, 2, 3, 4, 5] }), RangeError);
});
