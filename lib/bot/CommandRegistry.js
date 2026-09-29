'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CooldownManager = require('./CooldownManager');
const httpClient = require('../network/httpClient');
const { resolvePermissions, missingPermissions, formatPermission, toBitfield } = require('./permissions');

// Discord API enums (numeric values are stable across libraries)
const INTERACTION = { PING: 1, COMMAND: 2, COMPONENT: 3, AUTOCOMPLETE: 4, MODAL: 5 };
const COMMAND_TYPE = { CHAT_INPUT: 1, USER: 2, MESSAGE: 3 };
const COMPONENT_TYPE = { BUTTON: 2 }; // 3, 5, 6, 7, 8 are select menus
const OPTION_TYPE = { SUB_COMMAND: 1, SUB_COMMAND_GROUP: 2 };
const EPHEMERAL = 64;

/** Handler kinds. `type` of a definition must be one of these. */
const KINDS = ['slash', 'userContext', 'messageContext', 'button', 'select', 'modal', 'prefix', 'event'];
const COMMAND_KINDS = ['slash', 'userContext', 'messageContext'];
const COMPONENT_KINDS = ['button', 'select', 'modal'];
/** Components attached to a message: they are usually acknowledged with deferUpdate(). */
const MESSAGE_COMPONENT_KINDS = ['button', 'select'];

/** Folder names understood by loadDir() when a definition has no `type`. */
const FOLDER_KINDS = {
    commands: 'slash', slash: 'slash',
    user: 'userContext', usercontext: 'userContext',
    message: 'messageContext', messagecontext: 'messageContext',
    buttons: 'button', button: 'button',
    selects: 'select', select: 'select', menus: 'select',
    modals: 'modal', modal: 'modal',
    prefix: 'prefix', legacy: 'prefix',
    events: 'event', event: 'event',
};

const DEFAULT_MESSAGES = {
    cooldown: (ctx, res) => `⏳ Please wait ${res.remainingText} before using this again.`,
    guildOnly: () => '❌ This can only be used in a server.',
    ownerOnly: () => '❌ This is restricted to the bot owners.',
    denied: () => '❌ You are not allowed to do that.',
    botPermissions: (ctx, missing) => `❌ I need these permissions: ${missing.map(formatPermission).join(', ')}.`,
    userPermissions: (ctx, missing) => `❌ You need these permissions: ${missing.map(formatPermission).join(', ')}.`,
    error: () => '❌ Something went wrong while running this.',
};

/**
 * Routes every kind of Discord interaction, prefix messages and gateway events
 * to handlers, with cooldowns, checks, middlewares and error handling.
 *
 * Library-agnostic: works with discord.js v14+ objects and raw API payloads.
 */
class CommandRegistry {
    /**
     * @param {object} [options]
     * @param {string|string[]|((message: any) => string|string[]|Promise<string|string[]>)} [options.prefix]
     *        Prefix(es) for prefix commands, or a function (e.g. per-guild prefix from a DB).
     * @param {boolean}  [options.mentionPrefix=false] - Also accept "@Bot command".
     * @param {string[]} [options.ownerIds=[]]         - Users allowed to run `ownerOnly` handlers.
     * @param {CooldownManager} [options.cooldowns]    - CooldownManager to use (one is created otherwise).
     * @param {object}   [options.store]               - Store for the created CooldownManager (e.g. RedisStore for sharding).
     * @param {import('../LangManager/LangManager')} [options.lang] - Exposes `ctx.t` and fills command localizations.
     * @param {(target: any) => string|null|Promise<string|null>} [options.locale] - Locale used for `ctx.t`.
     * @param {import('./GuildSettings')} [options.settings] - Exposes `ctx.settings` bound to the current guild.
     * @param {Partial<typeof DEFAULT_MESSAGES>} [options.messages] - Override the default replies.
     * @param {(error: Error, ctx: object) => any} [options.onError] - Called when a handler throws.
     * @param {boolean|{ after?: number, ephemeral?: boolean, update?: boolean }} [options.autoDefer=false]
     *        Defers interactions whose handler has not answered after `after` ms (default 2000),
     *        to beat Discord's 3 second limit. Can be overridden per handler.
     */
    constructor(options = {}) {
        this.options = options;
        this.ownerIds = new Set(options.ownerIds || []);
        this.cooldowns = options.cooldowns || new CooldownManager({ store: options.store || null });
        this.messages = { ...DEFAULT_MESSAGES, ...(options.messages || {}) };
        this.client = null;

        /** @type {Record<string, Map<string, object>>} */
        this._handlers = {};
        for (const kind of KINDS) this._handlers[kind] = new Map();
        /** @type {Record<string, Array<{ def: object, regex: RegExp, keys: string[] }>>} */
        this._patterns = { button: [], select: [], modal: [] };
        /** @type {Map<string, object>} alias → prefix command */
        this._aliases = new Map();
        this._events = [];
        this._middlewares = [];
    }

    // ─── Registration ────────────────────────────────────────────────────────

    /**
     * Registers any handler. `def.type` selects the kind (default: 'slash').
     * @param {object|object[]} def
     * @returns {this}
     */
    register(def) {
        if (Array.isArray(def)) { def.forEach(d => this.register(d)); return this; }
        if (!def || typeof def !== 'object') throw new TypeError('Handler definition must be an object');
        const kind = def.type || 'slash';
        if (!KINDS.includes(kind)) throw new TypeError(`Unknown handler type "${kind}". Valid: ${KINDS.join(', ')}`);
        const d = { ...def, type: kind };
        validatePermissionNames(d);
        if (d.subcommands) Object.values(d.subcommands).forEach(sub => typeof sub === 'object' && validatePermissionNames(sub));

        if (kind === 'event') return this._addEvent(d);
        if (COMPONENT_KINDS.includes(kind)) return this._addComponent(d);

        const name = getName(d);
        if (!name) throw new TypeError(`A ${kind} handler needs a name`);
        if (kind === 'slash' && typeof d.execute !== 'function' && !d.subcommands)
            throw new TypeError(`Slash command "${name}" needs execute() or subcommands`);
        if (kind !== 'slash' && typeof d.execute !== 'function')
            throw new TypeError(`${kind} "${name}" needs an execute() function`);
        if (this._handlers[kind].has(name)) throw new Error(`${kind} "${name}" is already registered`);
        this._handlers[kind].set(name, d);

        if (kind === 'prefix') {
            for (const alias of [name, ...(d.aliases || [])]) {
                const a = alias.toLowerCase();
                if (this._aliases.has(a)) throw new Error(`Prefix alias "${alias}" is already used`);
                this._aliases.set(a, d);
            }
        }
        return this;
    }

    /** Registers a slash command. Subcommands: `subcommands: { add: fn, 'group sub': { execute } }`. */
    slash(def) { return this.register({ ...def, type: 'slash' }); }
    /** Registers a user context menu command (right click on a user). */
    userContext(def) { return this.register({ ...def, type: 'userContext' }); }
    /** Registers a message context menu command (right click on a message). */
    messageContext(def) { return this.register({ ...def, type: 'messageContext' }); }
    /** Registers a button handler. `id` can be exact, a pattern ('ticket:close:{id}') or a RegExp. */
    button(def) { return this.register({ ...def, type: 'button' }); }
    /** Registers a select menu handler (string, user, role, channel and mentionable selects). */
    select(def) { return this.register({ ...def, type: 'select' }); }
    /** Registers a modal submit handler. */
    modal(def) { return this.register({ ...def, type: 'modal' }); }
    /** Registers a prefix (message) command: `execute(message, args, ctx)`. */
    prefix(def) { return this.register({ ...def, type: 'prefix' }); }
    /** Registers a gateway event: `execute(...eventArgs, ctx)`. */
    event(def) { return this.register({ ...def, type: 'event' }); }

    /**
     * Adds a middleware run before every command/component handler.
     * Call `await next()` to continue; skip it to stop the chain.
     * @param {(ctx: object, next: () => Promise<void>) => any} fn
     * @returns {this}
     */
    use(fn) {
        if (typeof fn !== 'function') throw new TypeError('Middleware must be a function');
        this._middlewares.push(fn);
        return this;
    }

    /**
     * Recursively loads handler files from a directory.
     * Each file exports a definition, an array of definitions, or `{ default }`.
     * Without `type`, it is inferred from the closest folder name
     * (commands, events, buttons, selects, modals, prefix, user, message).
     * Files and folders starting with "_" are ignored.
     * @param {string} dir
     * @returns {this}
     */
    loadDir(dir) {
        const root = path.resolve(process.cwd(), dir);
        if (!fs.existsSync(root)) throw new Error(`Directory not found: ${root}`);

        const walk = (current, inferred) => {
            for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
                if (entry.name.startsWith('_')) continue;
                const full = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    walk(full, FOLDER_KINDS[entry.name.toLowerCase()] || inferred);
                } else if (/\.(c?js)$/.test(entry.name)) {
                    let mod = require(full);
                    if (mod && mod.default) mod = mod.default;
                    for (const def of [].concat(mod)) {
                        if (!def || typeof def !== 'object') continue;
                        const type = def.type || inferred;
                        if (!type) throw new TypeError(`Cannot infer the handler type of ${full}: set "type" or use a known folder name`);
                        this.register({ ...def, type });
                    }
                }
            }
        };
        walk(root, FOLDER_KINDS[path.basename(root).toLowerCase()]);
        return this;
    }

    /** @private */
    _addEvent(def) {
        if (!def.name) throw new TypeError('An event handler needs a name');
        if (typeof def.execute !== 'function') throw new TypeError(`Event "${def.name}" needs an execute() function`);
        this._events.push(def);
        if (this.client) this._bindEvent(this.client, def);
        return this;
    }

    /** @private */
    _addComponent(def) {
        const id = def.id !== undefined ? def.id : def.customId;
        if (!id) throw new TypeError(`A ${def.type} handler needs an id`);
        if (typeof def.execute !== 'function') throw new TypeError(`${def.type} "${id}" needs an execute() function`);
        const d = { ...def, id };

        if (id instanceof RegExp) {
            this._patterns[def.type].push({ def: d, regex: id, keys: null });
        } else if (/\{\w+\}/.test(id)) {
            const keys = [];
            const source = id.split(/(\{\w+\})/).map(part => {
                const m = /^\{(\w+)\}$/.exec(part);
                if (!m) return escapeRegex(part);
                keys.push(m[1]);
                return '(.+?)';
            }).join('');
            this._patterns[def.type].push({ def: d, regex: new RegExp(`^${source}$`), keys });
        } else {
            if (this._handlers[def.type].has(id)) throw new Error(`${def.type} "${id}" is already registered`);
            this._handlers[def.type].set(id, d);
        }
        return this;
    }

    // ─── Lookup ──────────────────────────────────────────────────────────────

    /**
     * Returns a registered command/component definition.
     * @param {string} kind
     * @param {string} name - Command name or exact component id.
     */
    get(kind, name) {
        return this._handlers[kind] ? this._handlers[kind].get(name) : undefined;
    }

    /** Lists registered definitions of one kind (events included). */
    list(kind) {
        if (kind === 'event') return [...this._events];
        return [...this._handlers[kind].values(), ...(this._patterns[kind] || []).map(p => p.def)];
    }

    /** @private Finds the component handler matching a customId. */
    _matchComponent(kind, customId) {
        const exact = this._handlers[kind].get(customId);
        if (exact) return { def: exact, params: {} };
        for (const { def, regex, keys } of this._patterns[kind]) {
            const m = regex.exec(customId);
            if (!m) continue;
            let params;
            if (keys) {
                params = {};
                keys.forEach((k, i) => { params[k] = m[i + 1]; });
            } else {
                params = { ...(m.groups || {}) };
            }
            return { def, params };
        }
        return null;
    }

    // ─── Dispatch ────────────────────────────────────────────────────────────

    /**
     * Routes an interaction (discord.js Interaction or raw payload) to its handler.
     * @param {any} interaction
     * @returns {Promise<{ handled: boolean, status: string, kind?: string, name?: string }>}
     */
    async handleInteraction(interaction) {
        const info = describeInteraction(interaction);
        if (!info) return { handled: false, status: 'ignored' };

        if (info.kind === 'autocomplete') return this._handleAutocomplete(interaction, info);

        let def, params = {}, handler;
        if (COMMAND_KINDS.includes(info.kind)) {
            def = this._handlers[info.kind].get(info.name);
            if (def) handler = resolveSubcommand(def, interaction);
        } else {
            const match = this._matchComponent(info.kind, info.name);
            if (match) ({ def, params } = match);
            if (def) handler = def;
        }
        if (!def || !handler) return { handled: false, status: 'not_found', kind: info.kind, name: info.name };

        const ctx = await this._createContext(interaction, info, def, { params, subcommand: handler.subcommand || null });
        return this._run(ctx, def, handler, () => handler.execute(interaction, ctx));
    }

    /**
     * Routes a message to a prefix command.
     * @param {any} message - discord.js Message or raw message payload.
     * @returns {Promise<{ handled: boolean, status: string, kind?: string, name?: string }>}
     */
    async handleMessage(message) {
        if (!message || typeof message.content !== 'string') return { handled: false, status: 'ignored' };
        const author = message.author || {};
        if (author.bot) return { handled: false, status: 'ignored' };

        const used = await this._matchPrefix(message);
        if (used === null) return { handled: false, status: 'ignored' };

        const args = splitArgs(message.content.slice(used.length));
        const commandName = (args.shift() || '').toLowerCase();
        if (!commandName) return { handled: false, status: 'ignored' };
        const def = this._aliases.get(commandName);
        if (!def) return { handled: false, status: 'not_found', kind: 'prefix', name: commandName };

        const info = { kind: 'prefix', name: getName(def) };
        const ctx = await this._createContext(message, info, def, { args, prefix: used, alias: commandName });
        return this._run(ctx, def, def, () => def.execute(message, args, ctx));
    }

    /** @private */
    async _matchPrefix(message) {
        let prefixes = this.options.prefix;
        if (typeof prefixes === 'function') prefixes = await prefixes(message);
        prefixes = [].concat(prefixes || []).filter(Boolean);

        const botId = this.client && this.client.user && this.client.user.id;
        if (this.options.mentionPrefix && botId) prefixes.push(`<@${botId}>`, `<@!${botId}>`);

        // Longest first, so "!!" wins over "!"
        prefixes.sort((a, b) => b.length - a.length);
        const content = message.content;
        for (const p of prefixes) {
            if (content.toLowerCase().startsWith(p.toLowerCase())) return content.slice(0, p.length);
        }
        return null;
    }

    /** @private */
    async _handleAutocomplete(interaction, info) {
        const def = this._handlers.slash.get(info.name);
        if (!def) return { handled: false, status: 'not_found', kind: 'autocomplete', name: info.name };
        const sub = resolveSubcommand(def, interaction);
        const fn = (sub && sub.autocomplete) || def.autocomplete;
        if (typeof fn !== 'function') return { handled: false, status: 'not_found', kind: 'autocomplete', name: info.name };

        const ctx = await this._createContext(interaction, info, def, { subcommand: sub ? sub.subcommand : null });
        try {
            await fn(interaction, ctx);
            return { handled: true, status: 'ok', kind: 'autocomplete', name: info.name };
        } catch (error) {
            await this._reportError(error, ctx, false);
            return { handled: true, status: 'error', kind: 'autocomplete', name: info.name, error };
        }
    }

    /** @private Runs checks, cooldown, middlewares and the handler. */
    async _run(ctx, def, handler, invoke) {
        const result = (status, extra) => ({ handled: true, status, kind: ctx.kind, name: ctx.name, ...extra });
        try {
            const opts = { ...def, ...(handler === def ? {} : handler) };

            if (opts.guildOnly && !ctx.guildId) {
                await this.reply(ctx.target, await this.messages.guildOnly(ctx));
                return result('guild_only');
            }
            if (opts.ownerOnly && !this.ownerIds.has(ctx.userId)) {
                await this.reply(ctx.target, await this.messages.ownerOnly(ctx));
                return result('owner_only');
            }
            // Permissions can only be checked when the payload carries them (not in DMs)
            if (opts.userPermissions) {
                const have = getMemberPermissions(ctx.target);
                const missing = have === null ? [] : missingPermissions(have, opts.userPermissions);
                if (missing.length) {
                    await this.reply(ctx.target, await this.messages.userPermissions(ctx, missing));
                    return result('user_missing_permissions', { missing });
                }
            }
            if (opts.botPermissions) {
                const have = getBotPermissions(ctx.target);
                const missing = have === null ? [] : missingPermissions(have, opts.botPermissions);
                if (missing.length) {
                    await this.reply(ctx.target, await this.messages.botPermissions(ctx, missing));
                    return result('bot_missing_permissions', { missing });
                }
            }
            if (typeof opts.check === 'function') {
                const verdict = await opts.check(ctx.target, ctx);
                if (verdict !== true && verdict !== undefined) {
                    await this.reply(ctx.target, typeof verdict === 'string' ? verdict : await this.messages.denied(ctx));
                    return result('denied');
                }
            }
            if (opts.cooldown && !this.ownerIds.has(ctx.userId)) {
                // Components share one bucket per handler, whatever the params in their customId
                const handlerName = COMPONENT_KINDS.includes(ctx.kind) ? String(def.id) : ctx.name;
                const bucket = `${ctx.kind}:${handlerName}${ctx.subcommand ? ' ' + ctx.subcommand : ''}`;
                const res = await this.cooldowns.hit(bucket, cooldownScope(opts.cooldown, ctx), opts.cooldown);
                if (!res.ok) {
                    await this.reply(ctx.target, await this.messages.cooldown(ctx, res));
                    return result('cooldown', { cooldown: res });
                }
            }

            const deferConfig = normalizeAutoDefer(opts.autoDefer !== undefined ? opts.autoDefer : this.options.autoDefer, ctx.kind);
            const stopAutoDefer = deferConfig ? armAutoDefer(ctx, deferConfig) : () => {};
            let reached = false;
            try {
                await compose(this._middlewares, ctx, async () => { reached = true; await invoke(); });
            } finally {
                stopAutoDefer();
            }
            return result(reached ? 'ok' : 'stopped');
        } catch (error) {
            await this._reportError(error, ctx, true);
            return result('error', { error });
        }
    }

    /** @private */
    async _reportError(error, ctx, replyToUser) {
        try {
            if (typeof this.options.onError === 'function') await this.options.onError(error, ctx);
            else console.error(`[CommandRegistry] ${ctx.kind} "${ctx.name}" failed:`, error);
        } catch (handlerError) {
            console.error('[CommandRegistry] onError threw:', handlerError);
        }
        if (replyToUser) await this.reply(ctx.target, await this.messages.error(ctx, error));
    }

    /** @private */
    async _createContext(target, info, def, extra) {
        const ctx = {
            kind: info.kind,
            name: info.name,
            def,
            target,
            client: this.client,
            registry: this,
            userId: getUserId(target),
            guildId: target.guildId || target.guild_id || (target.guild && target.guild.id) || null,
            channelId: target.channelId || target.channel_id || (target.channel && target.channel.id) || null,
            params: {},
            args: [],
            subcommand: null,
            state: {},
            ...extra,
        };
        ctx.reply = (content) => this.reply(target, content);
        if (this.options.settings) ctx.settings = this.options.settings.for(ctx.guildId);

        const lang = this.options.lang;
        if (lang) {
            const locale = typeof this.options.locale === 'function'
                ? await this.options.locale(target, ctx)
                : target.locale || target.guildLocale || target.guild_locale || (target.guild && target.guild.preferredLocale) || null;
            ctx.locale = locale;
            ctx.t = lang.for(locale);
        }
        return ctx;
    }

    /**
     * Replies to an interaction or a message, whatever its state:
     * - not answered yet → ephemeral reply;
     * - command/modal deferred ("is thinking...") → fills the deferred reply (editReply);
     * - already answered, or component deferred with deferUpdate → ephemeral followUp.
     * Errors while replying are swallowed (expired interaction, missing permissions...).
     * @param {any} target
     * @param {string|object} content
     */
    async reply(target, content) {
        if (content === undefined || content === null || content === '') return;
        const payload = typeof content === 'string' ? { content } : content;
        // Messages have an author; interactions have user/member instead
        const info = target.author ? null : describeInteraction(target);
        try {
            if (!info) {
                if (typeof target.reply === 'function') await target.reply(payload);
            } else if (target.deferred && !target.replied && !MESSAGE_COMPONENT_KINDS.includes(info.kind)
                && typeof target.editReply === 'function') {
                await target.editReply(withoutEphemeral(payload));
            } else if ((target.replied || target.deferred) && typeof target.followUp === 'function') {
                await target.followUp({ flags: EPHEMERAL, ...payload });
            } else if (typeof target.reply === 'function') {
                await target.reply({ flags: EPHEMERAL, ...payload });
            }
        } catch (_) { /* expired interaction, missing permissions... nothing more we can do */ }
    }

    // ─── Client binding ──────────────────────────────────────────────────────

    /**
     * Binds the registry to a client (discord.js or any EventEmitter-like client):
     * registers events, routes `interactionCreate` and, if prefix commands exist, `messageCreate`.
     * @param {any} client
     * @returns {this}
     */
    attach(client) {
        if (!client || typeof client.on !== 'function') throw new TypeError('Client must expose on()');
        this.client = client;
        for (const def of this._events) this._bindEvent(client, def);
        client.on('interactionCreate', (interaction) => { this.handleInteraction(interaction); });
        if (this._handlers.prefix.size > 0) client.on('messageCreate', (message) => { this.handleMessage(message); });
        return this;
    }

    /** @private */
    _bindEvent(client, def) {
        const listener = async (...args) => {
            const ctx = { kind: 'event', name: def.name, def, client, registry: this, target: args[0] };
            try {
                await def.execute(...args, ctx);
            } catch (error) {
                await this._reportError(error, ctx, false);
            }
        };
        if (def.once && typeof client.once === 'function') client.once(def.name, listener);
        else client.on(def.name, listener);
    }

    // ─── Deployment ──────────────────────────────────────────────────────────

    /**
     * Builds the application command payloads (slash + context menus) for the Discord API.
     * Accepts builders (anything with toJSON(), e.g. SlashCommandBuilder) in `def.data`.
     * When a LangManager is configured and `def.i18n` is set, `<i18n>.name` and
     * `<i18n>.description` fill the localizations.
     * @returns {object[]}
     */
    toJSON() {
        const out = [];
        const typeOf = { slash: COMMAND_TYPE.CHAT_INPUT, userContext: COMMAND_TYPE.USER, messageContext: COMMAND_TYPE.MESSAGE };
        for (const kind of COMMAND_KINDS) {
            for (const def of this._handlers[kind].values()) {
                const data = def.data && typeof def.data.toJSON === 'function' ? def.data.toJSON() : { ...(def.data || {}) };
                const json = { ...data, type: typeOf[kind], name: getName(def) };
                if (kind === 'slash') {
                    json.description = data.description || def.description || '';
                    if (!json.description) throw new TypeError(`Slash command "${json.name}" needs a description`);
                    if (def.options && !data.options) json.options = def.options;
                }
                if (def.defaultMemberPermissions !== undefined) {
                    // null = everyone, '0' = admins only, names or bits otherwise
                    json.default_member_permissions = def.defaultMemberPermissions === null
                        ? null
                        : String(resolvePermissions(def.defaultMemberPermissions));
                }
                if (def.contexts !== undefined) json.contexts = def.contexts;
                if (def.integrationTypes !== undefined) json.integration_types = def.integrationTypes;
                if (def.nsfw !== undefined) json.nsfw = def.nsfw;

                const lang = this.options.lang;
                if (lang && def.i18n) {
                    const names = lang.all(`${def.i18n}.name`);
                    if (Object.keys(names).length) json.name_localizations = names;
                    if (kind === 'slash') {
                        const descriptions = lang.all(`${def.i18n}.description`);
                        if (Object.keys(descriptions).length) json.description_localizations = descriptions;
                    }
                }
                out.push(json);
            }
        }
        return out;
    }

    /**
     * Overwrites the application commands on Discord (global, or one guild for instant updates).
     * @param {object} options
     * @param {string} options.token         - Bot token.
     * @param {string} options.applicationId - Application (client) id.
     * @param {string} [options.guildId]     - Deploy to one guild only.
     * @param {boolean} [options.onlyIfChanged=false] - Skip the API call when the commands did not change
     *        since the last successful deploy (hash kept in `cacheFile`). Avoids rate limits on every restart.
     * @param {string} [options.cacheFile='.yoyolib/commands-hash.json'] - Where hashes are kept (relative to cwd).
     * @returns {Promise<object[]|null>} The commands returned by Discord, or null when skipped.
     */
    async deploy({ token, applicationId, guildId, onlyIfChanged = false, cacheFile = '.yoyolib/commands-hash.json' } = {}) {
        if (!token || !applicationId) throw new TypeError('token and applicationId are required');
        const base = `https://discord.com/api/v10/applications/${applicationId}`;
        const url = guildId ? `${base}/guilds/${guildId}/commands` : `${base}/commands`;

        const commands = this.toJSON();
        const cachePath = path.resolve(process.cwd(), cacheFile);
        const cacheKey = `${applicationId}:${guildId || 'global'}`;
        const hash = hashCommands(commands);
        let cache = {};
        if (onlyIfChanged) {
            try { cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8')); } catch (_) { cache = {}; }
            if (cache[cacheKey] === hash) return null;
        }

        const result = await httpClient.put(url, {
            headers: { Authorization: `Bot ${token}` },
            json: commands,
            retries: 2,
        });

        if (onlyIfChanged) {
            cache[cacheKey] = hash;
            fs.mkdirSync(path.dirname(cachePath), { recursive: true });
            fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
        }
        return result;
    }

    /**
     * Stable hash of the application commands (see toJSON()), e.g. to build your own deploy cache.
     * @returns {string}
     */
    commandsHash() {
        return hashCommands(this.toJSON());
    }

    /**
     * Builds a customId from a pattern: `buildCustomId('ticket:close:{id}', { id: 42 })` → 'ticket:close:42'.
     * @param {string} pattern
     * @param {Record<string, string|number>} [params]
     * @returns {string}
     */
    static buildCustomId(pattern, params = {}) {
        const id = pattern.replace(/\{(\w+)\}/g, (_, k) => {
            if (!Object.prototype.hasOwnProperty.call(params, k)) throw new TypeError(`Missing customId param "${k}"`);
            return String(params[k]);
        });
        if (id.length > 100) throw new RangeError(`customId is ${id.length} characters long (Discord max: 100)`);
        return id;
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getName(def) {
    if (def.name) return def.name;
    if (!def.data) return null;
    if (def.data.name) return def.data.name;
    return typeof def.data.toJSON === 'function' ? def.data.toJSON().name || null : null;
}

function getUserId(target) {
    if (target.user && target.user.id) return target.user.id;
    if (target.member && target.member.user && target.member.user.id) return target.member.user.id;
    if (target.author && target.author.id) return target.author.id;
    return null;
}

/**
 * Normalizes a discord.js Interaction or a raw payload into { kind, name }.
 * @returns {{ kind: string, name: string }|null}
 */
function describeInteraction(i) {
    if (!i || typeof i !== 'object') return null;
    const data = i.data || {};
    switch (i.type) {
        case INTERACTION.COMMAND: {
            const commandType = i.commandType !== undefined ? i.commandType : data.type;
            const kind = commandType === COMMAND_TYPE.USER ? 'userContext'
                : commandType === COMMAND_TYPE.MESSAGE ? 'messageContext' : 'slash';
            return { kind, name: i.commandName || data.name };
        }
        case INTERACTION.AUTOCOMPLETE:
            return { kind: 'autocomplete', name: i.commandName || data.name };
        case INTERACTION.COMPONENT: {
            const componentType = i.componentType !== undefined ? i.componentType : data.component_type;
            return { kind: componentType === COMPONENT_TYPE.BUTTON ? 'button' : 'select', name: i.customId || data.custom_id };
        }
        case INTERACTION.MODAL:
            return { kind: 'modal', name: i.customId || data.custom_id };
        default:
            return null;
    }
}

/** Reads "group sub" from a discord.js interaction or a raw payload. */
function readSubcommand(interaction) {
    const opts = interaction.options;
    if (opts && typeof opts.getSubcommand === 'function') {
        const group = typeof opts.getSubcommandGroup === 'function' ? opts.getSubcommandGroup(false) : null;
        const sub = opts.getSubcommand(false);
        return [group, sub].filter(Boolean).join(' ') || null;
    }
    const first = interaction.data && interaction.data.options && interaction.data.options[0];
    if (!first) return null;
    if (first.type === OPTION_TYPE.SUB_COMMAND_GROUP) {
        const sub = first.options && first.options[0];
        return sub ? `${first.name} ${sub.name}` : first.name;
    }
    if (first.type === OPTION_TYPE.SUB_COMMAND) return first.name;
    return null;
}

/**
 * Picks the handler for a slash command, following `subcommands` when defined.
 * @returns {object|null} `{ execute, autocomplete?, subcommand, ...options }` or the command itself.
 */
function resolveSubcommand(def, interaction) {
    if (!def.subcommands) return def;
    const sub = readSubcommand(interaction);
    const entry = sub ? def.subcommands[sub] : undefined;
    if (!entry) return typeof def.execute === 'function' ? def : null;
    const handler = typeof entry === 'function' ? { execute: entry } : { ...entry };
    handler.subcommand = sub;
    return handler;
}

function cooldownScope(rule, ctx) {
    const scope = (rule && typeof rule === 'object' && rule.scope) || 'user';
    switch (scope) {
        case 'global':  return 'global';
        case 'guild':   return ctx.guildId || `dm:${ctx.userId}`;
        case 'channel': return ctx.channelId || `dm:${ctx.userId}`;
        case 'member':  return `${ctx.guildId || 'dm'}:${ctx.userId}`;
        default:        return ctx.userId || 'unknown';
    }
}

/** sha256 of the commands with object keys sorted, so key order never triggers a redeploy. */
function hashCommands(commands) {
    const stable = JSON.stringify(commands, (_, value) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return Object.keys(value).sort().reduce((acc, k) => { acc[k] = value[k]; return acc; }, {});
        }
        return value;
    });
    return crypto.createHash('sha256').update(stable).digest('hex');
}

/** Throws early on typos such as botPermissions: ['ManageRole']. */
function validatePermissionNames(def) {
    for (const key of ['botPermissions', 'userPermissions', 'defaultMemberPermissions']) {
        if (def[key] !== undefined && def[key] !== null) resolvePermissions(def[key]);
    }
}

const ACK_METHODS = ['reply', 'deferReply', 'update', 'deferUpdate', 'showModal'];

/** @returns {{ after: number, ephemeral: boolean, update: boolean }|null} */
function normalizeAutoDefer(value, kind) {
    if (!value || kind === 'prefix') return null;
    const config = {
        after: 2000,
        ephemeral: false,
        // Buttons and selects usually edit their message: acknowledge them with deferUpdate()
        update: MESSAGE_COMPONENT_KINDS.includes(kind),
        ...(typeof value === 'object' ? value : {}),
    };
    if (typeof config.after !== 'number' || config.after < 0) throw new TypeError('autoDefer.after must be a positive number of ms');
    return config;
}

/**
 * Defers the interaction if the handler has not acknowledged it after `after` ms.
 * Once deferred, the usual first-response methods are rerouted so handler code keeps working:
 * reply() → editReply() (or followUp() after deferUpdate), update() → editReply().
 * @returns {() => void} Stops the timer.
 */
function armAutoDefer(ctx, { after, ephemeral, update }) {
    const interaction = ctx.target;
    const original = {};
    for (const m of ACK_METHODS) if (typeof interaction[m] === 'function') original[m] = interaction[m];

    // Track acknowledgements made by the handler itself (flags are only set once the API call resolves)
    let acked = Boolean(interaction.replied || interaction.deferred);
    for (const m of Object.keys(original)) {
        interaction[m] = (...args) => { acked = true; return original[m].apply(interaction, args); };
    }

    const timer = setTimeout(() => {
        if (acked || interaction.replied || interaction.deferred) return;
        const useUpdate = Boolean(update && original.deferUpdate);
        const deferFn = useUpdate ? original.deferUpdate : original.deferReply;
        if (!deferFn) return;
        acked = true;
        ctx.autoDeferred = useUpdate ? 'update' : 'reply';

        let ok = true;
        const deferring = Promise.resolve()
            .then(() => (useUpdate ? deferFn.call(interaction) : deferFn.call(interaction, ephemeral ? { flags: EPHEMERAL } : {})))
            .catch(() => { ok = false; });
        const reroute = (fallback, afterDefer) => async (...args) => {
            await deferring;
            return ok ? afterDefer(...args) : fallback.apply(interaction, args);
        };

        if (original.reply) {
            interaction.reply = reroute(original.reply, (p) => (useUpdate
                ? interaction.followUp(p)
                : interaction.editReply(withoutEphemeral(p))));
        }
        if (original.update) interaction.update = reroute(original.update, (p) => interaction.editReply(p));
        if (original.deferReply) interaction.deferReply = reroute(original.deferReply, async () => {});
        if (original.deferUpdate) interaction.deferUpdate = reroute(original.deferUpdate, async () => {});
    }, after);

    return () => clearTimeout(timer);
}

/** editReply cannot change ephemerality: drop the ephemeral flag from a reply payload. */
function withoutEphemeral(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const copy = { ...payload };
    delete copy.ephemeral;
    if (typeof copy.flags === 'number') {
        copy.flags &= ~EPHEMERAL;
        if (copy.flags === 0) delete copy.flags;
    }
    return copy;
}

/** Permissions of the user who triggered the interaction/message, or null when unknown (DMs). */
function getMemberPermissions(target) {
    if (target.author) {
        const member = target.member;
        if (!member) return null;
        if (typeof member.permissionsIn === 'function' && target.channel) {
            try { return toBitfield(member.permissionsIn(target.channel)); } catch (_) { /* fall back to guild permissions */ }
        }
        return toBitfield(member.permissions);
    }
    const fromResolver = toBitfield(target.memberPermissions);
    if (fromResolver !== null) return fromResolver;
    return toBitfield(target.member && target.member.permissions);
}

/** Permissions of the bot in the current channel, or null when unknown. */
function getBotPermissions(target) {
    if (target.author) {
        const me = target.guild && target.guild.members && target.guild.members.me;
        if (!me || !target.channel || typeof target.channel.permissionsFor !== 'function') return null;
        try { return toBitfield(target.channel.permissionsFor(me)); } catch (_) { return null; }
    }
    const fromResolver = toBitfield(target.appPermissions);
    if (fromResolver !== null) return fromResolver;
    return toBitfield(target.app_permissions);
}

async function compose(middlewares, ctx, final) {
    let index = -1;
    const dispatch = async (i) => {
        if (i <= index) throw new Error('next() called multiple times');
        index = i;
        if (i === middlewares.length) return final();
        return middlewares[i](ctx, () => dispatch(i + 1));
    };
    return dispatch(0);
}

/** Splits "a \"b c\" d" into ['a', 'b c', 'd']. */
function splitArgs(input) {
    const args = [];
    const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let m;
    while ((m = re.exec(input)) !== null) args.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
    return args;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = CommandRegistry;
module.exports.splitArgs = splitArgs;
module.exports.describeInteraction = describeInteraction;
