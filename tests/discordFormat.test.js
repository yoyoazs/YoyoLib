const assert = require('node:assert');
const test = require('node:test');
const { discordFormat: f } = require('../lib/YoyoLib');

test('discordFormat - timestamps and mentions', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    assert.strictEqual(f.timestamp(date), '<t:1704067200:f>');
    assert.strictEqual(f.timestamp(date.getTime() + 999, 'R'), '<t:1704067200:R>');
    assert.strictEqual(f.timestamp('2024-01-01T00:00:00Z', 'D'), '<t:1704067200:D>');
    assert.throws(() => f.timestamp('nope'), /Invalid date/);
    assert.throws(() => f.timestamp(date, 'x'), /Invalid timestamp style/);

    assert.strictEqual(f.userMention('1'), '<@1>');
    assert.strictEqual(f.channelMention('1'), '<#1>');
    assert.strictEqual(f.roleMention('1'), '<@&1>');
    assert.strictEqual(f.commandMention('config set', '9'), '</config set:9>');
    assert.strictEqual(f.emoji('party', '5', true), '<a:party:5>');
    assert.strictEqual(f.hyperlink('docs', 'https://x.y'), '[docs](https://x.y)');
    assert.strictEqual(f.hideLinkEmbed('https://x.y'), '<https://x.y>');
});

test('discordFormat - escaping and code', () => {
    assert.strictEqual(f.escapeMarkdown('**bold** _it_ ~~s~~ `c` ||sp|| [l](u)'), '\\*\\*bold\\*\\* \\_it\\_ \\~\\~s\\~\\~ \\`c\\` \\|\\|sp\\|\\| \\[l\\](u)');
    assert.strictEqual(f.escapeMarkdown('> quote\n# title\n-# small'), '\\> quote\n\\# title\n\\-# small');
    assert.strictEqual(f.codeBlock('a```b', 'js'), '```js\na`​``b\n```');
    assert.strictEqual(f.inlineCode('x'), '`x`');
    assert.strictEqual(f.inlineCode('a`b'), '`` a`b ``');
});

test('discordFormat - truncate and splitMessage', () => {
    assert.strictEqual(f.truncate('hello world', 8), 'hello w…');
    assert.strictEqual(f.truncate('short', 10), 'short');

    const lines = Array.from({ length: 30 }, (_, i) => `line ${i} ${'x'.repeat(90)}`).join('\n');
    const chunks = f.splitMessage(lines);
    assert.ok(chunks.length > 1);
    assert.ok(chunks.every(c => c.length <= 2000));
    assert.strictEqual(chunks.join('\n'), lines); // cut exactly at line breaks

    const code = f.splitMessage('y'.repeat(4500), { prepend: '```\n', append: '\n```' });
    assert.ok(code.every(c => c.length <= 2000 && c.startsWith('```\n') && c.endsWith('\n```')));
    assert.strictEqual(code.map(c => c.slice(4, -4)).join(''), 'y'.repeat(4500));

    assert.deepStrictEqual(f.splitMessage(''), ['']);
    assert.strictEqual(f.LIMITS.embedDescription, 4096);
});
