'use strict';

const crypto = require('crypto');
const { parseDuration } = require('../utils/duration');

/** customIds used by the built-in menus: yoyo:<kind>:<session>:<action> */
const CUSTOM_ID = /^yoyo:(?<kind>page|confirm):(?<session>[a-f0-9]{12}):(?<action>[a-z]+)$/;
const EPHEMERAL = 64;
const BUTTON = { PRIMARY: 1, SECONDARY: 2, SUCCESS: 3, DANGER: 4 };

/**
 * Paginated messages and confirmation prompts built on the registry's button routing.
 * Sessions live in memory: after a restart, old buttons answer "expired".
 */
class InteractiveSessions {
    /** @param {import('./CommandRegistry')} registry */
    constructor(registry) {
        this.registry = registry;
        /** @type {Map<string, object>} */
        this.sessions = new Map();
    }

    /**
     * Sends pages with ◀ ▶ buttons. Only `userId` (default: the author) can turn pages.
     * @param {any} target - Interaction or message to answer.
     * @param {Array<string|object>} pages - Message payloads (content, embeds...).
     * @param {object} [options]
     * @param {string|null} [options.userId] - Who may use the buttons (null = anyone).
     * @param {string|number} [options.timeout='2m'] - Inactivity delay before the buttons are disabled.
     * @param {boolean} [options.ephemeral=false]
     * @param {number} [options.startPage=0]
     * @param {{ prev?: string, next?: string }} [options.labels]
     * @returns {Promise<{ id: string|null, stop: () => Promise<void> }>}
     */
    async paginate(target, pages, { userId, timeout = '2m', ephemeral = false, startPage = 0, labels = {} } = {}) {
        if (!Array.isArray(pages) || pages.length === 0) throw new TypeError('pages must be a non-empty array');
        const payloads = pages.map(toPayload);
        payloads.forEach(assertRoom);
        if (payloads.length === 1) {
            await this._send(target, payloads[0], ephemeral);
            return { id: null, stop: async () => {} };
        }

        const id = newId();
        const session = {
            kind: 'page',
            pages: payloads,
            page: Math.min(Math.max(0, startPage), payloads.length - 1),
            userId: userId === undefined ? authorId(target) : userId,
            timeoutMs: parseDuration(timeout),
            labels: { prev: '◀', next: '▶', ...labels },
            edit: null,
            timer: null,
        };
        session.edit = await this._send(target, this._pageView(id, session), ephemeral);
        this.sessions.set(id, session);
        this._arm(id, session);
        return { id, stop: () => this._expire(id) };
    }

    /**
     * Asks a yes/no question with buttons.
     * @param {any} target
     * @param {string|object} content
     * @param {object} [options]
     * @param {string|null} [options.userId] - Who may answer (null = anyone). Default: the author.
     * @param {string|number} [options.timeout='30s']
     * @param {boolean} [options.ephemeral=false]
     * @param {string} [options.confirmLabel='Confirm']
     * @param {string} [options.cancelLabel='Cancel']
     * @param {boolean} [options.danger=false] - Red confirm button (destructive actions).
     * @returns {Promise<{ confirmed: boolean, reason: 'confirmed'|'cancelled'|'timeout', interaction: any }>}
     *          `interaction` is the button click (already acknowledged with update()): use followUp()/editReply().
     */
    async confirm(target, content, {
        userId, timeout = '30s', ephemeral = false, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false,
    } = {}) {
        const payload = toPayload(content);
        assertRoom(payload);
        const id = newId();
        const session = {
            kind: 'confirm',
            payload,
            userId: userId === undefined ? authorId(target) : userId,
            timeoutMs: parseDuration(timeout),
            labels: { confirm: confirmLabel, cancel: cancelLabel },
            danger,
            edit: null,
            timer: null,
            resolve: null,
        };
        const result = new Promise(resolve => { session.resolve = resolve; });
        session.edit = await this._send(target, this._confirmView(id, session, false), ephemeral);
        this.sessions.set(id, session);
        this._arm(id, session);
        return result;
    }

    /** Called by the registry for every yoyo:* button. */
    async handleClick(interaction, ctx) {
        const { session: id, action } = ctx.params;
        const session = this.sessions.get(id);
        const messages = this.registry.messages;
        if (!session) return this.registry.reply(interaction, await messages.sessionExpired(ctx));
        if (session.userId && ctx.userId !== session.userId) return this.registry.reply(interaction, await messages.notYourSession(ctx));

        if (session.kind === 'page') {
            if (action === 'prev') session.page = Math.max(0, session.page - 1);
            else if (action === 'next') session.page = Math.min(session.pages.length - 1, session.page + 1);
            this._arm(id, session); // inactivity timeout restarts
            await interaction.update(this._pageView(id, session));
            return;
        }

        // confirm
        const confirmed = action === 'yes';
        this._end(id);
        await interaction.update(this._confirmView(id, session, true));
        session.resolve({ confirmed, reason: confirmed ? 'confirmed' : 'cancelled', interaction });
    }

    /** @private */
    _pageView(id, session, disabled = false) {
        const page = session.pages[session.page];
        const last = session.pages.length - 1;
        const row = {
            type: 1,
            components: [
                button(`yoyo:page:${id}:prev`, session.labels.prev, BUTTON.SECONDARY, disabled || session.page === 0),
                button(`yoyo:page:${id}:count`, `${session.page + 1}/${session.pages.length}`, BUTTON.SECONDARY, true),
                button(`yoyo:page:${id}:next`, session.labels.next, BUTTON.SECONDARY, disabled || session.page === last),
            ],
        };
        return { ...page, components: [...(page.components || []), row] };
    }

    /** @private */
    _confirmView(id, session, disabled) {
        const row = {
            type: 1,
            components: [
                button(`yoyo:confirm:${id}:yes`, session.labels.confirm, session.danger ? BUTTON.DANGER : BUTTON.SUCCESS, disabled),
                button(`yoyo:confirm:${id}:no`, session.labels.cancel, BUTTON.SECONDARY, disabled),
            ],
        };
        return { ...session.payload, components: [...(session.payload.components || []), row] };
    }

    /** @private (Re)starts the inactivity timer. */
    _arm(id, session) {
        if (session.timer) clearTimeout(session.timer);
        session.timer = setTimeout(() => { this._expire(id); }, session.timeoutMs);
        // A pending confirm() is awaited by the caller: its timer must keep the process alive.
        // Pagination timers only disable buttons, so they must not.
        if (session.kind === 'page' && typeof session.timer.unref === 'function') session.timer.unref();
    }

    /** @private Removes a session without touching the message. */
    _end(id) {
        const session = this.sessions.get(id);
        if (!session) return null;
        clearTimeout(session.timer);
        this.sessions.delete(id);
        return session;
    }

    /** @private Ends a session and disables its buttons. */
    async _expire(id) {
        const session = this._end(id);
        if (!session) return;
        const view = session.kind === 'page' ? this._pageView(id, session, true) : this._confirmView(id, session, true);
        try { await session.edit(view); } catch (_) { /* message deleted or token expired */ }
        if (session.kind === 'confirm') session.resolve({ confirmed: false, reason: 'timeout', interaction: null });
    }

    /**
     * Sends a payload to an interaction (reply, editReply or followUp depending on its state) or a message,
     * and returns a function able to edit what was sent.
     * @private
     */
    async _send(target, payload, ephemeral) {
        const isInteraction = !target.author && typeof target.type === 'number' && typeof target.reply === 'function' && 'token' in target;
        if (!isInteraction) {
            const sent = await target.reply(payload);
            return (p) => (sent && typeof sent.edit === 'function' ? sent.edit(p) : undefined);
        }
        const withFlags = ephemeral ? { ...payload, flags: (payload.flags || 0) | EPHEMERAL } : payload;
        if (target.deferred && !target.replied) {
            const { flags, ...rest } = withFlags; // editReply cannot change ephemerality
            await target.editReply(rest);
            return (p) => target.editReply(p);
        }
        if (target.replied) {
            const msg = await target.followUp(withFlags);
            return (p) => (target.webhook && msg ? target.webhook.editMessage(msg, p) : msg.edit(p));
        }
        await target.reply(withFlags);
        return (p) => target.editReply(p);
    }
}

function button(customId, label, style, disabled) {
    return { type: 2, style, custom_id: customId, label, disabled: Boolean(disabled) };
}

function toPayload(p) {
    return typeof p === 'string' ? { content: p } : { ...(p || {}) };
}

function assertRoom(payload) {
    if ((payload.components || []).length >= 5) throw new RangeError('A message has at most 5 component rows: keep one free for the buttons');
}

function newId() {
    return crypto.randomBytes(6).toString('hex');
}

function authorId(target) {
    if (target.user && target.user.id) return target.user.id;
    if (target.member && target.member.user) return target.member.user.id;
    if (target.author) return target.author.id;
    return null;
}

module.exports = { InteractiveSessions, CUSTOM_ID };
