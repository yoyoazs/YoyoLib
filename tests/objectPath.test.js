const assert = require('node:assert');
const test = require('node:test');
const { objectPath } = require('../lib/YoyoLib');

test('objectPath - get with dot notation', (t) => {
    const data = { a: { b: { c: 42 } }, arr: [1, 2, { x: 3 }] };
    
    assert.strictEqual(objectPath.get(data, 'a.b.c'), 42);
    assert.strictEqual(objectPath.get(data, 'arr.2.x'), 3);
    assert.strictEqual(objectPath.get(data, 'non.existent', 'default'), 'default');
});

test('objectPath - set with dot notation', (t) => {
    const data = {};
    objectPath.set(data, 'user.profile.name', 'Alice');
    
    assert.strictEqual(data.user.profile.name, 'Alice');
    assert.strictEqual(typeof data.user.profile, 'object');
});

test('objectPath - has check', (t) => {
    const data = { a: { b: 0 } };
    assert.strictEqual(objectPath.has(data, 'a.b'), true);
    assert.strictEqual(objectPath.has(data, 'a.z'), false);
});
