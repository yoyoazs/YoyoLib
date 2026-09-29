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

test('objectPath - refuses prototype pollution paths', () => {
    const data = {};
    assert.strictEqual(objectPath.set(data, '__proto__.polluted', true), false);
    assert.strictEqual(objectPath.set(data, 'a.constructor.prototype.polluted', true), false);
    assert.strictEqual({}.polluted, undefined);
    assert.strictEqual(objectPath.get({}, 'constructor'), undefined);
    assert.strictEqual(objectPath.has({}, 'toString'), false); // inherited keys are not "own" paths
});

test('objectPath - has check', (t) => {
    const data = { a: { b: 0 } };
    assert.strictEqual(objectPath.has(data, 'a.b'), true);
    assert.strictEqual(objectPath.has(data, 'a.z'), false);
});
