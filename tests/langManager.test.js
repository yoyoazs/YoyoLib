const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLangManager } = require('../lib/YoyoLib');

function makeLangDir(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yoyolib-langs-'));
    for (const [name, data] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(data));
    }
    return dir;
}

const EN = {
    welcome: 'Welcome {user}!',
    items: { one: '{count} item', other: '{count} items', zero: 'No items' },
    only: { en: 'English only' },
    cmd: { ping: { description: 'Check latency' } },
};
const FR = {
    welcome: 'Bienvenue {user} !',
    items: { one: '{count} objet', other: '{count} objets' },
    cmd: { ping: { description: 'Vérifie la latence' } },
};

test('LangManager - autoLoad, per-call locale and interpolation', () => {
    const dir = makeLangDir({ en: EN, fr: FR });
    const lang = createLangManager({ dir, autoLoad: true, fallback: 'en' });

    assert.deepStrictEqual(lang.locales().sort(), ['en', 'fr']);
    assert.strictEqual(lang.t('fr', 'welcome', { user: 'Alice' }), 'Bienvenue Alice !');
    assert.strictEqual(lang.t('en', 'welcome', { user: 'Bob' }), 'Welcome Bob!');
    // Unknown placeholders stay untouched
    assert.strictEqual(lang.t('en', 'welcome'), 'Welcome {user}!');
});

test('LangManager - Discord-style locales resolve to base languages', () => {
    const dir = makeLangDir({ en: EN, fr: FR });
    const lang = createLangManager({ dir, autoLoad: true, fallback: 'en' });

    assert.strictEqual(lang.resolveLocale('en-US'), 'en');
    assert.strictEqual(lang.resolveLocale('fr_CA'), 'fr');
    assert.strictEqual(lang.resolveLocale('ja'), null);
    assert.strictEqual(lang.t('ja', 'welcome', { user: 'Kenji' }), 'Welcome Kenji!'); // fallback
    assert.strictEqual(lang.t('fr', 'only.en'), 'English only'); // missing key → fallback
});

test('LangManager - pluralization with Intl.PluralRules', () => {
    const dir = makeLangDir({ en: EN, fr: FR });
    const lang = createLangManager({ dir, autoLoad: true });

    assert.strictEqual(lang.t('en', 'items', { count: 0 }), 'No items');
    assert.strictEqual(lang.t('en', 'items', { count: 1 }), '1 item');
    assert.strictEqual(lang.t('en', 'items', { count: 5 }), '5 items');
    // French: 0 and 1 are both "one"
    assert.strictEqual(lang.t('fr', 'items', { count: 0 }), '0 objet');
    assert.strictEqual(lang.t('fr', 'items', { count: 2 }), '2 objets');
});

test('LangManager - for() binds a locale', () => {
    const dir = makeLangDir({ en: EN, fr: FR });
    const lang = createLangManager({ dir, autoLoad: true, fallback: 'en' });

    const t = lang.for('fr-FR');
    assert.strictEqual(t.locale, 'fr');
    assert.strictEqual(t('items', { count: 3 }), '3 objets');
    assert.strictEqual(t.has('only.en'), false);
});

test('LangManager - all() builds Discord localizations', () => {
    const dir = makeLangDir({ en: EN, fr: FR });
    const lang = createLangManager({ dir, autoLoad: true });

    assert.deepStrictEqual(lang.all('cmd.ping.description'), {
        en: 'Check latency',
        fr: 'Vérifie la latence',
    });
});

test('LangManager - missing key strategies', () => {
    const dir = makeLangDir({ en: EN });
    const strict = createLangManager({ dir, autoLoad: true });
    assert.throws(() => strict.t('en', 'nope'), { message: 'Key "nope" not found' });

    const lenient = createLangManager({ dir, autoLoad: true, onMissing: 'key' });
    assert.strictEqual(lenient.t('en', 'nope'), 'nope');

    const custom = createLangManager({ dir, autoLoad: true, onMissing: (key, locale) => `[${locale}:${key}]` });
    assert.strictEqual(custom.t('de', 'nope'), '[de:nope]');
});

test('LangManager - legacy API (add/set/use) still works', () => {
    const dir = makeLangDir({ en_EN: EN, fr_FR: FR });
    const lang = createLangManager({ dir });

    assert.strictEqual(lang.add('en', 'en_EN'), 'Language added');
    lang.add('fr', 'fr_FR');
    assert.throws(() => lang.add('en', 'en_EN'), { name: 'LangNameError' });
    assert.strictEqual(lang.getActive(), 'en'); // first added becomes active

    lang.set('fr');
    lang.setFallback('en');
    assert.strictEqual(lang.use('welcome', { user: 'Alice' }), 'Bienvenue Alice !');
    assert.strictEqual(lang.use('only.en'), 'English only');
    assert.deepStrictEqual(lang.show(), ['en', 'fr']);
    assert.deepStrictEqual(lang.languageFile, ['en_EN', 'fr_FR']);
});

test('LangManager - translations are cached and reload() re-reads files', () => {
    const dir = makeLangDir({ en: { hello: 'Hello' } });
    const lang = createLangManager({ dir, autoLoad: true });

    fs.writeFileSync(path.join(dir, 'en.json'), JSON.stringify({ hello: 'Hi' }));
    assert.strictEqual(lang.t('en', 'hello'), 'Hello'); // still cached
    lang.reload();
    assert.strictEqual(lang.t('en', 'hello'), 'Hi');
});

test('LangManager - addResource merges in-memory translations', () => {
    const lang = createLangManager();
    lang.addResource('en', { a: { b: 'B' } }).addResource('en', { a: { c: 'C' } });

    assert.strictEqual(lang.t('en', 'a.b'), 'B');
    assert.strictEqual(lang.t('en', 'a.c'), 'C');
    assert.throws(() => lang.addResource('en', null), TypeError);
});

test('LangManager - autoLoad on a missing directory throws', () => {
    assert.throws(
        () => createLangManager({ dir: path.join(os.tmpdir(), 'does-not-exist-yoyolib'), autoLoad: true }),
        { name: 'DirNotFoundError' }
    );
});
