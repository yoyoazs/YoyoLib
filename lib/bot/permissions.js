'use strict';

/**
 * Discord permission flags (API bit positions), named like discord.js's PermissionFlagsBits.
 * @type {Record<string, bigint>}
 */
const PermissionFlags = Object.freeze({
    CreateInstantInvite: 1n << 0n,
    KickMembers: 1n << 1n,
    BanMembers: 1n << 2n,
    Administrator: 1n << 3n,
    ManageChannels: 1n << 4n,
    ManageGuild: 1n << 5n,
    AddReactions: 1n << 6n,
    ViewAuditLog: 1n << 7n,
    PrioritySpeaker: 1n << 8n,
    Stream: 1n << 9n,
    ViewChannel: 1n << 10n,
    SendMessages: 1n << 11n,
    SendTTSMessages: 1n << 12n,
    ManageMessages: 1n << 13n,
    EmbedLinks: 1n << 14n,
    AttachFiles: 1n << 15n,
    ReadMessageHistory: 1n << 16n,
    MentionEveryone: 1n << 17n,
    UseExternalEmojis: 1n << 18n,
    ViewGuildInsights: 1n << 19n,
    Connect: 1n << 20n,
    Speak: 1n << 21n,
    MuteMembers: 1n << 22n,
    DeafenMembers: 1n << 23n,
    MoveMembers: 1n << 24n,
    UseVAD: 1n << 25n,
    ChangeNickname: 1n << 26n,
    ManageNicknames: 1n << 27n,
    ManageRoles: 1n << 28n,
    ManageWebhooks: 1n << 29n,
    ManageGuildExpressions: 1n << 30n,
    UseApplicationCommands: 1n << 31n,
    RequestToSpeak: 1n << 32n,
    ManageEvents: 1n << 33n,
    ManageThreads: 1n << 34n,
    CreatePublicThreads: 1n << 35n,
    CreatePrivateThreads: 1n << 36n,
    UseExternalStickers: 1n << 37n,
    SendMessagesInThreads: 1n << 38n,
    UseEmbeddedActivities: 1n << 39n,
    ModerateMembers: 1n << 40n,
    ViewCreatorMonetizationAnalytics: 1n << 41n,
    UseSoundboard: 1n << 42n,
    CreateGuildExpressions: 1n << 43n,
    CreateEvents: 1n << 44n,
    UseExternalSounds: 1n << 45n,
    SendVoiceMessages: 1n << 46n,
    SendPolls: 1n << 49n,
    UseExternalApps: 1n << 50n,
});

// Lookup tolerant to case and underscores: 'MANAGE_ROLES', 'manageRoles', 'ManageRoles'
const LOOKUP = new Map(Object.entries(PermissionFlags).map(([name, bit]) => [normalize(name), { name, bit }]));
LOOKUP.set(normalize('ManageEmojisAndStickers'), { name: 'ManageGuildExpressions', bit: PermissionFlags.ManageGuildExpressions });

function normalize(name) {
    return String(name).replace(/_/g, '').toLowerCase();
}

/**
 * Converts permission names, bits or bitfields into one bigint bitfield.
 * @param {string|bigint|number|Array<string|bigint|number>} perms - e.g. ['BanMembers', 'KICK_MEMBERS'] or 8n
 * @returns {bigint}
 * @throws {TypeError} On unknown permission names.
 */
function resolvePermissions(perms) {
    let bits = 0n;
    for (const p of [].concat(perms)) {
        if (typeof p === 'bigint') bits |= p;
        else if (typeof p === 'number') bits |= BigInt(p);
        else if (typeof p === 'string' && /^\d+$/.test(p)) bits |= BigInt(p);
        else {
            const entry = LOOKUP.get(normalize(p));
            if (!entry) throw new TypeError(`Unknown permission "${p}"`);
            bits |= entry.bit;
        }
    }
    return bits;
}

/**
 * Lists the required permissions that `have` is missing. Administrator grants everything.
 * @param {bigint} have
 * @param {string|bigint|Array<string|bigint>} required
 * @returns {string[]} Missing permission names (empty when everything is granted).
 */
function missingPermissions(have, required) {
    if ((have & PermissionFlags.Administrator) === PermissionFlags.Administrator) return [];
    const need = resolvePermissions(required);
    const missing = [];
    for (const [name, bit] of Object.entries(PermissionFlags)) {
        if ((need & bit) === bit && (have & bit) !== bit) missing.push(name);
    }
    return missing;
}

/**
 * Turns "ManageRoles" into "Manage Roles" for user-facing messages.
 * @param {string} name
 * @returns {string}
 */
function formatPermission(name) {
    return name
        .replace(/([a-z])([A-Z])/g, '$1 $2')        // ManageRoles → Manage Roles
        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')   // TTSMessages → TTS Messages
        .replace(/\bVAD\b/, 'Voice Activity');
}

/**
 * Reads a bitfield from a discord.js PermissionsBitField, a bigint, or a raw API string.
 * @returns {bigint|null}
 */
function toBitfield(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(value);
    if (typeof value === 'string') return /^\d+$/.test(value) ? BigInt(value) : null;
    if (typeof value === 'object' && 'bitfield' in value) return toBitfield(value.bitfield);
    return null;
}

module.exports = { PermissionFlags, resolvePermissions, missingPermissions, formatPermission, toBitfield };
