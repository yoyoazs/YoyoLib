const assert = require('node:assert');
const test = require('node:test');
const { stringUtils } = require('../lib/YoyoLib');

test('stringUtils - slugify', (t) => {
    assert.strictEqual(stringUtils.slugify("Hello World!"), "hello-world");
    assert.strictEqual(stringUtils.slugify("Élégant & Simple"), "elegant-simple");
});

test('stringUtils - truncate', (t) => {
    assert.strictEqual(stringUtils.truncate("Long text goes here", 9), "Long text...");
    assert.strictEqual(stringUtils.truncate("Short", 10), "Short");
});

test('stringUtils - capitalize', (t) => {
    assert.strictEqual(stringUtils.capitalize("hello"), "Hello");
});

test('stringUtils - camelCase', (t) => {
    assert.strictEqual(stringUtils.camelCase("Hello World"), "helloWorld");
    assert.strictEqual(stringUtils.camelCase("my_variable_name"), "myVariableName");
});
