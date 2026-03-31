const assert = require('node:assert');
const test = require('node:test');
const { objectUtils } = require('../lib/YoyoLib');

test('objectUtils - deepMerge', (t) => {
    const target = { a: 1, c: { d: 4, e: 5 } };
    const source = { b: 2, c: { d: 9, f: 6 } }; // Merges `c`, overrides `d`, adds `f`

    objectUtils.deepMerge(target, source);

    assert.deepStrictEqual(target, { a: 1, b: 2, c: { d: 9, e: 5, f: 6 } });
});

test('objectUtils - pick and omit', (t) => {
    const user = { id: 1, name: 'John', password: '123' };

    assert.deepStrictEqual(objectUtils.pick(user, ['name']), { name: 'John' });
    assert.deepStrictEqual(objectUtils.omit(user, ['password', 'id']), { name: 'John' });
});

test('objectUtils - deepClone', (t) => {
    const a = { b: 1, arr: [1, 2] };
    const b = objectUtils.deepClone(a);

    b.b = 9;
    b.arr.push(3);

    // Deep copy, original is untouched
    assert.strictEqual(a.b, 1);
    assert.strictEqual(a.arr.length, 2);
    
    assert.strictEqual(b.b, 9);
    assert.strictEqual(b.arr.length, 3);
});
