const assert = require('node:assert');
const test = require('node:test');
const { apiUtils } = require('../lib/YoyoLib');

test('apiUtils - paginate standard case', (t) => {
    const items = [{ id: 1 }, { id: 2 }];
    const totalCount = 10;
    // Page 1, Limit 2
    const result = apiUtils.paginate(items, totalCount, 1, 2);

    assert.deepStrictEqual(result.data, items);
    assert.strictEqual(result.metadata.totalElements, 10);
    assert.strictEqual(result.metadata.totalPages, 5); // 10 / 2
    assert.strictEqual(result.metadata.currentPage, 1);
    assert.strictEqual(result.metadata.hasNext, true);  // page 1 < 5
    assert.strictEqual(result.metadata.hasPrev, false); // page 1
});

test('apiUtils - paginate middle and edge', (t) => {
    const items = [];
    const resultEdge = apiUtils.paginate(items, 100, 10, 10);
    
    assert.strictEqual(resultEdge.metadata.totalPages, 10);
    assert.strictEqual(resultEdge.metadata.hasNext, false); // At max page
    assert.strictEqual(resultEdge.metadata.hasPrev, true);
});
