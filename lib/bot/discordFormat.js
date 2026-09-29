'use strict';

/** Discord API limits (characters, unless stated otherwise). */
const LIMITS = Object.freeze({
    message: 2000,
    embedTitle: 256,
    embedDescription: 4096,
    embedFields: 25,          // fields per embed
    embedFieldName: 256,
    embedFieldValue: 1024,
    embedFooter: 2048,
    embedAuthor: 256,
    embedTotal: 6000,         // all text of all embeds of a message
    embedsPerMessage: 10,
    customId: 100,
    buttonLabel: 80,
    selectOptions: 25,
    componentsPerRow: 5,
    rowsPerMessage: 5,
    choices: 25,              // slash command choices / autocomplete results
});

const TIMESTAMP_STYLES = new Set(['t', 'T', 'd', 'D', 'f', 'F', 'R']);

/**
 * Discord timestamp that every user sees in their own timezone and language.
 * @param {Date|number|string} date - Date, epoch ms or date string.
 * @param {'t'|'T'|'d'|'D'|'f'|'F'|'R'} [style='f'] - R = relative ("in 5 minutes").
 * @returns {string} e.g. "<t:1700000000:R>"
 */
function timestamp(date, style = 'f') {
    const ms = date instanceof Date ? date.getTime() : typeof date === 'number' ? date : Date.parse(date);
    if (!Number.isFinite(ms)) throw new TypeError('Invalid date');
    if (!TIMESTAMP_STYLES.has(style)) throw new TypeError(`Invalid timestamp style "${style}"`);
    return `<t:${Math.floor(ms / 1000)}:${style}>`;
}

const userMention = (id) => `<@${id}>`;
const channelMention = (id) => `<#${id}>`;
const roleMention = (id) => `<@&${id}>`;
/** Clickable slash command: </name:id> (name may include subcommands: "config set"). */
const commandMention = (name, id) => `</${name}:${id}>`;
const emoji = (name, id, animated = false) => `<${animated ? 'a' : ''}:${name}:${id}>`;
const hyperlink = (text, url) => `[${text}](${url})`;
/** Wraps a URL in <> so Discord does not show a preview. */
const hideLinkEmbed = (url) => `<${url}>`;

/**
 * Escapes markdown so user input is displayed as typed (names, reasons...).
 * @param {string} text
 * @returns {string}
 */
function escapeMarkdown(text) {
    return String(text)
        .replace(/([\\*_~`|[\]])/g, '\\$1')
        // Line-start syntax: quotes, headings, subtext and lists
        .replace(/^(\s*)(>|#|-)/gm, '$1\\$2');
}

/**
 * @param {string} content
 * @param {string} [language='']
 * @returns {string}
 */
function codeBlock(content, language = '') {
    // A zero-width space breaks any ``` inside the content so it cannot close the block early
    return `\`\`\`${language}\n${String(content).replace(/```/g, '`​``')}\n\`\`\``;
}

/** Inline code that stays valid when the content contains backticks. */
function inlineCode(content) {
    const s = String(content);
    return s.includes('`') ? `\`\` ${s.replace(/``/g, '`​`')} \`\`` : `\`${s}\``;
}

/**
 * Cuts a string to `max` characters, suffix included.
 * @param {string} text
 * @param {number} max
 * @param {string} [suffix='…']
 * @returns {string}
 */
function truncate(text, max, suffix = '…') {
    const s = String(text);
    if (s.length <= max) return s;
    if (max <= suffix.length) return s.slice(0, max);
    return s.slice(0, max - suffix.length) + suffix;
}

/**
 * Splits a long text into chunks that fit in a message, cutting at line breaks, then spaces,
 * then anywhere as a last resort.
 * @param {string} text
 * @param {object} [options]
 * @param {number} [options.maxLength=2000]
 * @param {string[]} [options.separators=['\n', ' ']]
 * @param {string} [options.prepend=''] - Added at the start of every chunk (e.g. '```js\n').
 * @param {string} [options.append='']  - Added at the end of every chunk (e.g. '\n```').
 * @returns {string[]}
 */
function splitMessage(text, { maxLength = LIMITS.message, separators = ['\n', ' '], prepend = '', append = '' } = {}) {
    const room = maxLength - prepend.length - append.length;
    if (room <= 0) throw new RangeError('prepend and append leave no room for content');

    const chunks = [];
    let rest = String(text);
    while (rest.length > room) {
        let cut = -1;
        for (const sep of separators) {
            const idx = rest.lastIndexOf(sep, room);
            if (idx > 0) { cut = idx; break; }
        }
        if (cut === -1) {
            chunks.push(rest.slice(0, room));
            rest = rest.slice(room);
        } else {
            chunks.push(rest.slice(0, cut));
            rest = rest.slice(cut + 1); // drop the separator itself
        }
    }
    if (rest.length > 0 || chunks.length === 0) chunks.push(rest);
    return chunks.map(c => prepend + c + append);
}

module.exports = {
    LIMITS,
    timestamp,
    userMention,
    channelMention,
    roleMention,
    commandMention,
    emoji,
    hyperlink,
    hideLinkEmbed,
    escapeMarkdown,
    codeBlock,
    inlineCode,
    truncate,
    splitMessage,
};
