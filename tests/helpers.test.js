const assert = require('node:assert');
const test = require('node:test');
const { retry, throttle, debounce } = require('../lib/YoyoLib');

const testSleep = (ms) => new Promise(r => setTimeout(r, ms));

test('retry - succeed on nth attempt', async (t) => {
    let calls = 0;
    const fn = async () => {
        calls++;
        if (calls < 3) throw new Error('fail');
        return 'success';
    };
    
    const result = await retry(fn, { attempts: 3, delay: 10 });
    assert.strictEqual(result, 'success');
    assert.strictEqual(calls, 3);
});

test('retry - fails if attempts exceeded', async (t) => {
    const fn = async () => { throw new Error('always fail') };
    
    try {
        await retry(fn, { attempts: 2, delay: 5 });
        assert.fail('Should have thrown');
    } catch (err) {
        assert.strictEqual(err.message, 'always fail');
    }
});

test('throttle - limits calls', async (t) => {
    let calls = 0;
    const fn = throttle(() => calls++, 100);
    
    fn(); // 1st
    fn(); // skipped
    fn(); // skipped
    
    assert.strictEqual(calls, 1);
    
    await testSleep(150);
    fn(); // 2nd
    assert.strictEqual(calls, 2);
});

test('debounce - delays call', async (t) => {
    let calls = 0;
    const fn = debounce(() => calls++, 50);
    
    fn(); 
    fn(); 
    fn(); 
    
    // Not called immediately
    assert.strictEqual(calls, 0);
    
    await testSleep(100);
    // Called once after silence
    assert.strictEqual(calls, 1);
});
