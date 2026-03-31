const assert = require('node:assert');
const test = require('node:test');
const { CircuitBreaker } = require('../lib/YoyoLib');

const testSleep = (ms) => new Promise(r => setTimeout(r, ms));

test('CircuitBreaker - trips after threshold and restores', async (t) => {
    let failMode = true;
    
    // The dummy external API
    const apiCall = async () => {
        if (failMode) throw new Error('API down');
        return 'success';
    };

    const breaker = new CircuitBreaker(apiCall, { failureThreshold: 2, resetTimeout: 50 }); // Reset after 50ms!
    
    // 1st failure
    try { await breaker.fire(); assert.fail() } catch (err) { assert.strictEqual(err.message, 'API down'); }
    assert.strictEqual(breaker.state, 'CLOSED');
    assert.strictEqual(breaker.failures, 1);
    
    // 2nd failure -> Trips
    try { await breaker.fire(); assert.fail() } catch (err) { assert.strictEqual(err.message, 'API down'); }
    assert.strictEqual(breaker.state, 'OPEN'); // Circuit Tripped!
    
    // 3rd call -> Fast fail without hitting API
    try { await breaker.fire(); assert.fail() } catch (err) { 
        assert.ok(err.message.includes('CircuitBreaker is OPEN')); 
    }

    // Wait 60ms for cooldown
    await testSleep(60);
    
    // API comes back up
    failMode = false;
    
    // Next call should succeed (state goes to HALF_OPEN internally, then CLOSED)
    const result = await breaker.fire();
    assert.strictEqual(result, 'success');
    assert.strictEqual(breaker.state, 'CLOSED');
    assert.strictEqual(breaker.failures, 0);
});
