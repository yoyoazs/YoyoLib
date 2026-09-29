'use strict';

const { EventEmitter } = require('events');
const { resolvePermissions, PermissionFlags } = require('../bot/permissions');

/**
 * Test doubles shaped like discord.js v14 objects, to unit-test bot handlers without Discord.
 * They follow Discord's rules: an interaction can only be acknowledged once (error 40060),
 * editReply/followUp need an acknowledgement first, and `replied` / `deferred` only change
 * once the (simulated) API call resolves.
 *
 * @example
 * const { mockInteraction } = require('yoyolib/testing');
 * const i = mockInteraction({ name: 'ban', options: { user: { id: '1' }, reason: 'spam' } });
 * await registry.handleInteraction(i);
 * assert.strictEqual(i.lastReply().content, 'Banned!');
 */

const TYPES = {
    slash:          { type: 2, commandType: 1 },
    userContext:    { type: 2, commandType: 2 },
    messageContext: { type: 2, commandType: 3 },
    autocomplete:   { type: 4, commandType: 1 },
    button:         { type: 3, componentType: 2 },
    select:         { type: 3, componentType: 3 },
    modal:          { type: 5 },
};

let idCounter = 0;
const nextId = () => String(100000000000000000n + BigInt(++idCounter));

class DiscordAPIError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'DiscordAPIError';
        this.code = code;
    }
}

function toPayload(p) {
    return typeof p === 'string' ? { content: p } : { ...(p || {}) };
}

function permissionsField(value, fallback) {
    const bitfield = value === undefined ? fallback : resolvePermissions(value);
    if (bitfield === null) return null;
    return {
        bitfield,
        has(perm) {
            if ((bitfield & PermissionFlags.Administrator) === PermissionFlags.Administrator) return true;
            const need = resolvePermissions(perm);
            return (bitfield & need) === need;
        },
    };
}

function mockSentMessage(payload, channelId) {
    const message = {
        id: nextId(),
        channelId,
        ...toPayload(payload),
        edits: [],
        deleted: false,
        async edit(p) { const next = toPayload(p); message.edits.push(next); Object.assign(message, next); return message; },
        async delete() { message.deleted = true; },
    };
    return message;
}

/**
 * Creates a fake interaction.
 * @param {object} [options]
 * @param {'slash'|'userContext'|'messageContext'|'autocomplete'|'button'|'select'|'modal'} [options.type='slash']
 * @param {string} [options.name]       - Command name.
 * @param {string} [options.customId]   - Component / modal custom id.
 * @param {string} [options.subcommand] - "sub" or "group sub".
 * @param {Record<string, any>} [options.options] - Option values (users/channels/roles as objects with an id).
 * @param {string} [options.focused]    - Focused option name (autocomplete).
 * @param {string[]} [options.values]   - Select menu values.
 * @param {Record<string, string>} [options.fields] - Modal text inputs.
 * @param {{ id: string, username?: string, bot?: boolean }} [options.user]
 * @param {string|null} [options.guildId]  - null simulates a DM.
 * @param {string} [options.channelId]
 * @param {string} [options.locale='en-US']
 * @param {string} [options.guildLocale]
 * @param {any} [options.appPermissions]    - Names or bits. Default: everything except Administrator.
 * @param {any} [options.memberPermissions] - Names or bits. Default: SendMessages | UseApplicationCommands.
 * @param {number} [options.latency=0]      - Simulated API latency (ms).
 */
function mockInteraction(options = {}) {
    const {
        type = 'slash', name, customId, subcommand = null, focused, values = [], fields = {},
        user = { id: '100000000000000001', username: 'tester' }, guildId = '200000000000000001',
        channelId = '300000000000000001', locale = 'en-US', guildLocale = guildId ? 'en-US' : null,
        appPermissions, memberPermissions, latency = 0,
    } = options;
    const kind = TYPES[type];
    if (!kind) throw new TypeError(`Unknown interaction type "${type}"`);
    const optionValues = options.options || {};
    const [group, sub] = subcommand && subcommand.includes(' ') ? subcommand.split(' ') : [null, subcommand];

    const everything = Object.values(PermissionFlags).reduce((a, b) => a | b, 0n) & ~PermissionFlags.Administrator;
    const calls = [];
    const wait = () => (latency > 0 ? new Promise(r => setTimeout(r, latency)) : Promise.resolve());
    let acknowledging = false;

    const i = {
        id: nextId(),
        applicationId: '400000000000000001',
        token: 'mock-token',
        ...kind,
        commandName: name,
        customId,
        user: { bot: false, ...user },
        member: guildId ? { user: { bot: false, ...user }, permissions: permissionsField(memberPermissions, PermissionFlags.SendMessages | PermissionFlags.UseApplicationCommands) } : null,
        guildId,
        channelId,
        locale,
        guildLocale,
        appPermissions: permissionsField(appPermissions, everything),
        memberPermissions: guildId ? permissionsField(memberPermissions, PermissionFlags.SendMessages | PermissionFlags.UseApplicationCommands) : null,
        values,
        replied: false,
        deferred: false,
        ephemeral: null,
        calls,
        responded: null, // autocomplete choices
        modal: null,     // modal shown with showModal()

        options: {
            get: (n) => (n in optionValues ? { name: n, value: optionValues[n], focused: n === focused } : null),
            getString: (n) => optionValues[n] ?? null,
            getInteger: (n) => optionValues[n] ?? null,
            getNumber: (n) => optionValues[n] ?? null,
            getBoolean: (n) => optionValues[n] ?? null,
            getUser: (n) => optionValues[n] ?? null,
            getMember: (n) => optionValues[n] ?? null,
            getChannel: (n) => optionValues[n] ?? null,
            getRole: (n) => optionValues[n] ?? null,
            getMentionable: (n) => optionValues[n] ?? null,
            getAttachment: (n) => optionValues[n] ?? null,
            getSubcommand: (required = true) => {
                if (!sub && required) throw new Error('A subcommand was expected');
                return sub || null;
            },
            getSubcommandGroup: (required = true) => {
                if (!group && required) throw new Error('A subcommand group was expected');
                return group || null;
            },
            getFocused: (full = false) => (full ? { name: focused, value: optionValues[focused] ?? '' } : (optionValues[focused] ?? '')),
        },
        fields: {
            getTextInputValue: (n) => {
                if (!(n in fields)) throw new Error(`No text input "${n}"`);
                return fields[n];
            },
        },

        isChatInputCommand: () => type === 'slash',
        isCommand: () => kind.type === 2,
        isContextMenuCommand: () => type === 'userContext' || type === 'messageContext',
        isUserContextMenuCommand: () => type === 'userContext',
        isMessageContextMenuCommand: () => type === 'messageContext',
        isAutocomplete: () => type === 'autocomplete',
        isButton: () => type === 'button',
        isStringSelectMenu: () => type === 'select',
        isAnySelectMenu: () => type === 'select',
        isModalSubmit: () => type === 'modal',
        isMessageComponent: () => type === 'button' || type === 'select',
        isRepliable: () => type !== 'autocomplete',
        inGuild: () => Boolean(guildId),
    };

    async function acknowledge(method, payload, flag) {
        if (type === 'autocomplete') throw new DiscordAPIError(40060, 'Autocomplete interactions can only respond()');
        if (i.replied || i.deferred || acknowledging) throw new DiscordAPIError(40060, 'Interaction has already been acknowledged.');
        if ((method === 'update' || method === 'deferUpdate') && kind.type !== 3 && kind.type !== 5) {
            throw new DiscordAPIError(40060, `${method}() is only available on components`);
        }
        acknowledging = true;
        calls.push({ method, payload });
        await wait();
        acknowledging = false;
        if (flag) i[flag] = true;
        const flags = payload && typeof payload.flags === 'number' ? payload.flags : 0;
        if (method === 'reply' || method === 'deferReply') i.ephemeral = Boolean(payload && (payload.ephemeral || flags & 64));
    }

    function requireAck(method) {
        if (!i.replied && !i.deferred) throw new DiscordAPIError(10015, `${method}() requires the interaction to be acknowledged first`);
    }

    Object.assign(i, {
        async reply(p) { await acknowledge('reply', toPayload(p), 'replied'); return undefined; },
        async deferReply(p) { await acknowledge('deferReply', toPayload(p), 'deferred'); },
        async update(p) { await acknowledge('update', toPayload(p), 'replied'); },
        async deferUpdate() { await acknowledge('deferUpdate', undefined, 'deferred'); },
        async showModal(modal) {
            if (kind.type === 5) throw new DiscordAPIError(40060, 'A modal cannot open another modal');
            await acknowledge('showModal', modal, null);
            i.modal = modal;
            i.replied = true;
        },
        async editReply(p) {
            requireAck('editReply');
            await wait();
            calls.push({ method: 'editReply', payload: toPayload(p) });
            i.replied = true;
            return mockSentMessage(p, channelId);
        },
        async followUp(p) {
            requireAck('followUp');
            await wait();
            calls.push({ method: 'followUp', payload: toPayload(p) });
            return mockSentMessage(p, channelId);
        },
        async deleteReply() {
            requireAck('deleteReply');
            calls.push({ method: 'deleteReply', payload: undefined });
        },
        async fetchReply() {
            requireAck('fetchReply');
            const last = [...calls].reverse().find(c => ['reply', 'editReply', 'update'].includes(c.method));
            return mockSentMessage(last ? last.payload : {}, channelId);
        },
        async respond(choices) {
            if (type !== 'autocomplete') throw new DiscordAPIError(40060, 'respond() is only for autocomplete');
            if (i.responded) throw new DiscordAPIError(40060, 'Interaction has already been acknowledged.');
            calls.push({ method: 'respond', payload: choices });
            i.responded = choices;
        },

        /** Payloads of every visible answer (reply, editReply, followUp, update), in order. */
        replies() {
            return calls.filter(c => ['reply', 'editReply', 'followUp', 'update'].includes(c.method)).map(c => c.payload);
        },
        /** Last visible answer, or undefined. */
        lastReply() {
            const all = i.replies();
            return all[all.length - 1];
        },
        /** Names of the methods called, in order. */
        methods() {
            return calls.map(c => c.method);
        },
    });

    return i;
}

/**
 * Creates a fake message (for prefix commands).
 * @param {object} [options]
 * @param {string} [options.content='']
 * @param {{ id: string, username?: string, bot?: boolean }} [options.author]
 * @param {string|null} [options.guildId] - null simulates a DM.
 * @param {string} [options.channelId]
 * @param {any} [options.botPermissions]    - Bot permissions in the channel (names or bits). Default: everything.
 * @param {any} [options.memberPermissions] - Author permissions in the channel. Default: SendMessages.
 * @param {string} [options.botId]
 */
function mockMessage(options = {}) {
    const {
        content = '', author = { id: '100000000000000001', username: 'tester' },
        guildId = '200000000000000001', channelId = '300000000000000001',
        botPermissions, memberPermissions, botId = '500000000000000001',
    } = options;
    const everything = Object.values(PermissionFlags).reduce((a, b) => a | b, 0n) & ~PermissionFlags.Administrator;
    const me = { id: botId, user: { id: botId, bot: true } };
    const sent = [];
    const botPerms = permissionsField(botPermissions, everything);
    const memberPerms = permissionsField(memberPermissions, PermissionFlags.SendMessages);

    const channel = {
        id: channelId,
        sent,
        async send(p) { const m = mockSentMessage(p, channelId); sent.push(m); return m; },
        permissionsFor: (member) => (member === me ? botPerms : memberPerms),
    };
    const message = {
        id: nextId(),
        type: 0,
        content,
        author: { bot: false, ...author },
        guildId,
        channelId,
        channel,
        guild: guildId ? { id: guildId, members: { me } } : null,
        member: guildId ? { user: author, permissions: memberPerms, permissionsIn: () => memberPerms } : null,
        replies: [],
        async reply(p) {
            const m = mockSentMessage(p, channelId);
            message.replies.push(m);
            return m;
        },
        lastReply() {
            return message.replies[message.replies.length - 1];
        },
    };
    return message;
}

/**
 * Creates a fake client (EventEmitter with a bot user), for registry.attach().
 * @param {object} [options]
 * @param {string} [options.id]
 */
function mockClient({ id = '500000000000000001' } = {}) {
    const client = new EventEmitter();
    client.user = { id, bot: true, username: 'bot' };
    return client;
}

module.exports = { mockInteraction, mockMessage, mockClient, DiscordAPIError };
