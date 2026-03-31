const assert = require('node:assert');
const test = require('node:test');
const { ObjectFlatten } = require('../lib/YoyoLib');

test('ObjectFlatten - flatten nested objects', (t) => {
    const input = {
        a: {
            b: {
                c: 42
            }
        },
        d: 1,
        e: [1, 2]
    };

    const output = ObjectFlatten.flatten(input);

    assert.strictEqual(output['a.b.c'], 42);
    assert.strictEqual(output['d'], 1);
    assert.deepStrictEqual(output['e'], [1, 2]);
});

test('ObjectFlatten - unflatten dot-notation objects', (t) => {
    const input = {
        'user.profile.name': 'Alice',
        'user.id': 1
    };

    const output = ObjectFlatten.unflatten(input);

    assert.deepStrictEqual(output, {
        user: {
            profile: { name: 'Alice' },
            id: 1
        }
    });
});
