const assert = require('node:assert');
const test = require('node:test');
const { createEventBus } = require('../lib/YoyoLib');

test('EventBus - sync events', (t) => {
    const bus = createEventBus();
    let count = 0;
    
    bus.on('ping', () => count++);
    bus.emit('ping');
    assert.strictEqual(count, 1);
});

test('EventBus - emitAsync', async (t) => {
    const bus = createEventBus();
    
    bus.on('async-ping', async () => {
        return new Promise(resolve => setTimeout(() => resolve('pong1'), 10));
    });
    
    bus.on('async-ping', async () => {
        return 'pong2';
    });

    const results = await bus.emitAsync('async-ping');
    assert.deepStrictEqual(results, ['pong1', 'pong2']);
});
