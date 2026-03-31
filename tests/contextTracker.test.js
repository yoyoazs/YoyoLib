const assert = require('node:assert');
const test = require('node:test');
const { createContextTracker } = require('../lib/YoyoLib');

test('ContextTracker - isolates async contexts', async (t) => {
    const context = createContextTracker();
    
    const task = async (id) => {
        return context.run({ requestId: id }, async () => {
            // Simulate async work
            await new Promise(r => setTimeout(r, Math.random() * 50));
            
            // Check if context is still correct
            const currentId = context.get('requestId');
            return currentId === id;
        });
    };

    // Run 10 parallel tasks with different IDs
    const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) => task(`req-${i}`))
    );

    // All should be true
    assert.ok(results.every(r => r === true));
});

test('ContextTracker - set and get', (t) => {
    const context = createContextTracker();
    
    context.run({ user: 'alice' }, () => {
        assert.strictEqual(context.get('user'), 'alice');
        
        context.set('role', 'admin');
        assert.strictEqual(context.get('role'), 'admin');
        
        const full = context.get();
        assert.deepStrictEqual(full, { user: 'alice', role: 'admin' });
    });
    
    // Outside run, should be undefined
    assert.strictEqual(context.get('user'), undefined);
});
