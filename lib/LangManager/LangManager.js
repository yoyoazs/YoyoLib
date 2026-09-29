'use strict';

const path = require('path');
const fs   = require('fs');
const { LangNameError, LangFileError, EmptyArrayError, MessageEmptyError, FileNotFoundError, DirNotFoundError } = require('../error/indexError');

const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];

/**
 * JSON-based i18n manager.
 *
 * Translations are loaded once into memory. Each call can target its own locale,
 * which is what bots and multi-tenant apps need (one language per user/guild/tenant).
 *
 * @example
 * const lang = new LangManager({ autoLoad: true, fallback: 'en' }); // loads ./langs/*.json
 * lang.t('fr', 'welcome', { user: 'Alice' });
 * lang.t(interaction.locale, 'items', { count: 3 }); // 'en-US' resolves to 'en'
 * const t = lang.for(guild.locale); t('ping.reply');
 */
class LangManager {
    /**
     * @param {object}  [options]
     * @param {string}  [options.dir='langs']     - Directory holding the JSON files (relative to cwd).
     * @param {boolean} [options.autoLoad=false]  - Register every `<name>.json` of `dir` as language `<name>`.
     * @param {string}  [options.fallback]        - Language used when a key is missing.
     * @param {string}  [options.defaultLocale]   - Active language for `use()`. Defaults to the first one added.
     * @param {'throw'|'key'|((key: string, locale: string) => string)} [options.onMissing='throw']
     *        What to do when a key is missing everywhere: throw, return the key, or call a function.
     */
    constructor({ dir = 'langs', autoLoad = false, fallback, defaultLocale, onMissing = 'throw' } = {}) {
        this._dir = path.resolve(process.cwd(), dir);
        this._onMissing = onMissing;

        /** @type {Map<string, { file: string|null, data: object }>} language name → entry */
        this._langs = new Map();
        /** @type {Map<string, string>} normalized locale → language name */
        this._aliases = new Map();

        this.languageActive = null;
        this._fallbackLang  = null;

        if (autoLoad) {
            if (!fs.existsSync(this._dir)) throw new DirNotFoundError(`Directory "${dir}" not found in ${process.cwd()}`);
            for (const file of fs.readdirSync(this._dir).sort()) {
                if (file.endsWith('.json')) this.add(path.basename(file, '.json'), path.basename(file, '.json'));
            }
        }

        // May reference languages registered later (e.g. with addResource); unregistered ones are skipped at lookup
        if (defaultLocale) this.languageActive = defaultLocale;
        if (fallback) this._fallbackLang = fallback;
    }

    /** @deprecated Use locales(). Kept for backward compatibility. */
    get language() {
        return this.locales();
    }

    /** @deprecated Kept for backward compatibility. */
    get languageFile() {
        return [...this._langs.values()].map(entry => entry.file);
    }

    // ─── Registration ────────────────────────────────────────────────────────

    /**
     * Registers a language backed by a JSON file of the langs directory.
     * @param {string} lang     - Language name (e.g. 'en').
     * @param {string} langFile - JSON file name without extension (e.g. 'en_EN').
     * @returns {string}
     * @throws {LangNameError}
     * @throws {LangFileError}
     * @throws {FileNotFoundError}
     */
    add(lang, langFile) {
        if (!lang)     throw new LangNameError('No language name provided');
        if (!langFile) throw new LangFileError('No language file name provided');
        const filePath = path.resolve(this._dir, `${langFile}.json`);
        if (!fs.existsSync(filePath))
            throw new FileNotFoundError(`${langFile}.json not found in ${this._dir}`);
        if (this._langs.has(lang)) throw new LangNameError(`Language "${lang}" is already registered`);
        for (const entry of this._langs.values()) {
            if (entry.file === langFile) throw new LangFileError(`File "${langFile}" is already registered`);
        }

        this._register(lang, langFile, this._parse(filePath));
        return 'Language added';
    }

    /**
     * Registers (or merges into) a language from an in-memory object. No file needed.
     * @param {string} lang
     * @param {object} translations
     * @returns {LangManager} this
     */
    addResource(lang, translations) {
        if (!lang) throw new LangNameError('No language name provided');
        if (!translations || typeof translations !== 'object') throw new TypeError('Translations must be an object');

        const existing = this._langs.get(lang);
        if (existing) deepMerge(existing.data, translations);
        else this._register(lang, null, deepMerge({}, translations));
        return this;
    }

    /** @private */
    _register(lang, file, data) {
        this._langs.set(lang, { file, data });
        this._aliases.set(normalize(lang), lang);
        if (this.languageActive === null) this.languageActive = lang;
    }

    /** @private */
    _parse(filePath) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (err) {
            throw new LangFileError(`Cannot parse ${path.basename(filePath)}: ${err.message}`);
        }
    }

    /**
     * Re-reads every file-backed language from disk (e.g. after editing translations).
     * @returns {string}
     * @throws {EmptyArrayError}
     * @throws {FileNotFoundError}
     */
    reload() {
        if (this._langs.size === 0) throw new EmptyArrayError('No languages to reload');
        for (const entry of this._langs.values()) {
            if (!entry.file) continue;
            const filePath = path.resolve(this._dir, `${entry.file}.json`);
            if (!fs.existsSync(filePath))
                throw new FileNotFoundError(`${entry.file}.json not found during reload`);
            entry.data = this._parse(filePath);
        }
        return 'Languages reloaded';
    }

    // ─── Active / fallback language ──────────────────────────────────────────

    /**
     * Returns the list of registered languages.
     * @returns {string[]}
     * @throws {EmptyArrayError}
     */
    show() {
        if (this._langs.size === 0) throw new EmptyArrayError('No languages have been registered');
        return this.locales();
    }

    /**
     * Returns the list of registered languages (empty array if none).
     * @returns {string[]}
     */
    locales() {
        return [...this._langs.keys()];
    }

    /**
     * Sets the active language used by `use()`.
     * @param {string} lang
     * @throws {LangNameError}
     */
    set(lang) {
        if (!this._langs.has(lang)) throw new LangNameError(`Language "${lang}" is not registered`);
        this.languageActive = lang;
    }

    /**
     * Returns the currently active language name.
     * @returns {string|null}
     */
    getActive() {
        return this.languageActive;
    }

    /**
     * Sets a fallback language used when a key is missing in the requested language.
     * @param {string} lang
     * @throws {LangNameError}
     */
    setFallback(lang) {
        if (!this._langs.has(lang)) throw new LangNameError(`Language "${lang}" is not registered`);
        this._fallbackLang = lang;
    }

    /**
     * Maps a requested locale to a registered language.
     * Tries the exact name, then a case/separator-insensitive match ('en_us' ~ 'en-US'),
     * then the base language ('fr-CA' → 'fr').
     * @param {string} locale
     * @returns {string|null}
     */
    resolveLocale(locale) {
        if (!locale) return null;
        if (this._langs.has(locale)) return locale;
        const norm = normalize(locale);
        if (this._aliases.has(norm)) return this._aliases.get(norm);
        const base = norm.split('-')[0];
        if (this._aliases.has(base)) return this._aliases.get(base);
        // 'fr' requested but only 'fr-FR' registered
        for (const [alias, lang] of this._aliases) {
            if (alias.split('-')[0] === base) return lang;
        }
        return null;
    }

    // ─── Translation ─────────────────────────────────────────────────────────

    /**
     * Translates a key for a given locale.
     *
     * - `{name}` placeholders are replaced from `vars` (unknown ones are left untouched).
     * - If the value is an object with plural categories (`one`, `other`, ... plus optional `zero`)
     *   and `vars.count` is a number, the right form is chosen with `Intl.PluralRules`.
     *
     * @param {string} locale - Requested locale (e.g. 'fr', 'en-US'). Falls back if unknown.
     * @param {string} key    - Dot-notation key (e.g. 'errors.notFound').
     * @param {Object} [vars] - Interpolation variables.
     * @returns {string}
     * @throws {MessageEmptyError} When the key is missing and onMissing is 'throw'.
     */
    t(locale, key, vars) {
        if (!key || typeof key !== 'string') throw new MessageEmptyError('Message key must not be empty');

        const candidates = [this.resolveLocale(locale), this.resolveLocale(this._fallbackLang)].filter(Boolean);
        for (const lang of new Set(candidates)) {
            const raw = getPath(this._langs.get(lang).data, key);
            const text = this._select(raw, lang, vars);
            if (text !== undefined) return interpolate(text, vars);
        }
        return this._missing(key, locale);
    }

    /**
     * Returns a translator bound to one locale.
     * @param {string} locale
     * @returns {((key: string, vars?: object) => string) & { locale: string|null, has: (key: string) => boolean }}
     *
     * @example
     * const t = lang.for(interaction.locale);
     * await interaction.reply(t('ping.reply', { ms: 42 }));
     */
    for(locale) {
        const resolved = this.resolveLocale(locale) || this.resolveLocale(this._fallbackLang);
        const translate = (key, vars) => this.t(resolved, key, vars);
        translate.locale = resolved;
        translate.has = (key) => this.has(key, resolved);
        return translate;
    }

    /**
     * Translates a key with the active language (see `set()`).
     * @param {string} message - Dot-notation key.
     * @param {Object} [args]  - Interpolation variables.
     * @returns {string}
     * @throws {MessageEmptyError}
     */
    use(message, args) {
        return this.t(this.languageActive, message, args);
    }

    /**
     * Returns true if the key exists for the locale (fallback not included).
     * @param {string} key
     * @param {string} [locale] - Defaults to the active language.
     * @returns {boolean}
     */
    has(key, locale = this.languageActive) {
        const lang = this.resolveLocale(locale);
        if (!lang) return false;
        const raw = getPath(this._langs.get(lang).data, key);
        return typeof raw === 'string' || isPluralObject(raw);
    }

    /**
     * Returns the translation of a key in every registered language.
     * Handy for Discord slash command `name_localizations` / `description_localizations`.
     * @param {string} key
     * @param {Object} [vars]
     * @returns {Record<string, string>} language → text (languages missing the key are skipped)
     */
    all(key, vars) {
        const out = {};
        for (const lang of this._langs.keys()) {
            const text = this._select(getPath(this._langs.get(lang).data, key), lang, vars);
            if (text !== undefined) out[lang] = interpolate(text, vars);
        }
        return out;
    }

    /** @private */
    _select(raw, lang, vars) {
        if (typeof raw === 'string') return raw.length > 0 ? raw : undefined;
        if (!isPluralObject(raw)) return undefined;

        const count = vars && typeof vars.count === 'number' ? vars.count : undefined;
        if (count === undefined) return raw.other;
        if (count === 0 && raw.zero !== undefined) return raw.zero;

        let category = 'other';
        try {
            category = new Intl.PluralRules(lang.replace('_', '-')).select(count);
        } catch (_) {
            category = new Intl.PluralRules('en').select(count);
        }
        return raw[category] !== undefined ? raw[category] : raw.other;
    }

    /** @private */
    _missing(key, locale) {
        if (typeof this._onMissing === 'function') return this._onMissing(key, locale);
        if (this._onMissing === 'key') return key;
        throw new MessageEmptyError(`Key "${key}" not found`);
    }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function normalize(locale) {
    return String(locale).toLowerCase().replace(/_/g, '-');
}

function getPath(obj, key) {
    let result = obj;
    for (const part of key.split('.')) {
        if (result === undefined || result === null || typeof result !== 'object') return undefined;
        result = result[part];
    }
    return result;
}

function isPluralObject(value) {
    return value !== null && typeof value === 'object' && typeof value.other === 'string'
        && Object.keys(value).every(k => PLURAL_CATEGORIES.includes(k));
}

function interpolate(text, vars) {
    if (!vars) return text;
    return text.replace(/\{([\w-]+)\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match);
}

function deepMerge(target, source) {
    for (const [k, v] of Object.entries(source)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            if (!target[k] || typeof target[k] !== 'object') target[k] = {};
            deepMerge(target[k], v);
        } else {
            target[k] = v;
        }
    }
    return target;
}

module.exports = LangManager;
