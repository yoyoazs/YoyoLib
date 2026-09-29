const assert = require('node:assert');
const test = require('node:test');
const { MemoryStore, RedisStore, createRateLimiter, createCooldownManager, createCommandRegistry } = require('../lib/YoyoLib');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Minimal Redis emulation, enough for the commands RedisStore sends.
 * EVAL only understands RedisStore's increment script (checked by its content).
 */
function fakeRedisServer() {
    const data = new Map(); // key -> { value: string, expiresAt: number|null }
    const log = [];
    const live = (k) => {
        const e = data.get(k);
        if (e && e.expiresAt !== null && e.expiresAt <= Date.now()) { data.delete(k); return null; }
        return e || null;
    };
    const pttl = (k) => { const e = live(k); if (!e) return -2; return e.expiresAt === null ? -1 : e.expiresAt - Date.now(); };
    const run = (args) => {
        log.push(args.map(String));
        const [cmd, ...rest] = args.map(String);
        switch (cmd) {
            case 'GET': { const e = live(rest[0]); return e ? e.value : null; }
            case 'SET': {
                const px = rest[2] === 'PX' ? Number(rest[3]) : 0;
                data.set(rest[0], { value: rest[1], expiresAt: px ? Date.now() + px : null });
                return 'OK';
            }
            case 'DEL': return rest.filter(k => data.delete(k)).length;
            case 'PTTL': return pttl(rest[0]);
            case 'EVAL': {
                assert.ok(rest[0].includes("redis.call('INCRBY'"), 'unexpected script');
                const [, , key, by, ttl] = rest;
                const e = live(key) || { value: '0', expiresAt: null };
                e.value = String(Number(e.value) + Number(by));
                data.set(key, e);
                let t = pttl(key);
                if (t < 0 && Number(ttl) > 0) { e.expiresAt = Date.now() + Number(ttl); t = Number(ttl); }
                return [Number(e.value), t];
            }
            case 'SCAN': {
                const pattern = rest[2];
                const prefix = pattern.slice(0, -1).replace(/\\(.)/g, '$1');
                return ['0', [...data.keys()].filter(k => k.startsWith(prefix) && live(k))];
            }
            default: throw new Error(`Unsupported command ${cmd}`);
        }
    };
    return { data, log, run };
}

const ioredisClient = (server) => ({ call: async (...args) => server.run(args) });
const nodeRedisClient = (server) => ({ sendCommand: async (args) => {
    assert.ok(args.every(a => typeof a === 'string'), 'node-redis needs string arguments');
    return server.run(args);
} });

async function exerciseStore(store) {
    await store.set('user', { id: 1 }, 50);
    assert.deepStrictEqual(await store.get('user'), { id: 1 });
    assert.ok((await store.ttl('user')) > 0);

    assert.deepStrictEqual((await store.increment('hits', 1000)).value, 1);
    const second = await store.increment('hits', 1000, 2);
    assert.strictEqual(second.value, 3);
    assert.ok(second.ttl > 0 && second.ttl <= 1000);

    await store.set('forever', 'x');
    assert.strictEqual(await store.ttl('forever'), null);
    assert.strictEqual(await store.ttl('missing'), -1);
    assert.strictEqual(await store.get('missing'), null);

    await store.set('p:1', 1);
    await store.set('p:2', 2);
    await store.set('q:1', 3);
    assert.strictEqual(await store.deleteByPrefix('p:'), 2);
    assert.strictEqual(await store.get('q:1'), 3);
    assert.strictEqual(await store.delete('q:1'), true);
    assert.strictEqual(await store.delete('q:1'), false);

    await sleep(70);
    assert.strictEqual(await store.get('user'), null); // expired
}

test('MemoryStore - store interface', async () => {
    const store = new MemoryStore({ sweepInterval: 0 });
    await exerciseStore(store);
    store.close();
});

test('RedisStore - works with an ioredis-style client', async () => {
    const server = fakeRedisServer();
    await exerciseStore(new RedisStore({ client: ioredisClient(server), prefix: 'app:' }));
    assert.ok([...server.data.keys()].every(k => k.startsWith('app:')));
    assert.ok(server.log.some(args => args[0] === 'SET' && args[3] === 'PX'));
});

test('RedisStore - works with a node-redis v4 client', async () => {
    await exerciseStore(new RedisStore({ client: nodeRedisClient(fakeRedisServer()) }));
});

test('RedisStore - rejects unknown clients', () => {
    assert.throws(() => new RedisStore({}), TypeError);
    assert.throws(() => new RedisStore({ client: { get() {} } }), /Unsupported Redis client/);
});

test('RateLimiter - shared store limits across instances', async () => {
    const store = new MemoryStore({ sweepInterval: 0 });
    const shardA = createRateLimiter({ limit: 2, window: 60, store, name: 'api' });
    const shardB = createRateLimiter({ limit: 2, window: 60, store, name: 'api' });

    assert.strictEqual((await shardA.consume('ip')).allowed, true);
    assert.strictEqual((await shardB.consume('ip')).allowed, true);
    const third = await shardA.consume('ip');
    assert.strictEqual(third.allowed, false);
    assert.ok(third.resetIn > 0 && third.resetIn <= 60000);

    await shardB.reset('ip');
    assert.strictEqual((await shardA.consume('ip')).allowed, true);
    assert.strictEqual(await shardA.resetAll(), 1);
});

function fakeRes() {
    return {
        statusCode: 200, headers: {}, body: null,
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
        end(body) { this.body = body; },
    };
}

test('RateLimiter - HTTP middleware sets headers and answers 429', async () => {
    const limiter = createRateLimiter({ limit: 1, window: 30 });
    const mw = limiter.middleware();
    let nextCalls = 0;

    const res1 = fakeRes();
    await mw({ ip: '1.1.1.1' }, res1, () => nextCalls++);
    assert.strictEqual(nextCalls, 1);
    assert.strictEqual(res1.headers['ratelimit-remaining'], '0');

    const res2 = fakeRes();
    await mw({ ip: '1.1.1.1' }, res2, () => nextCalls++);
    assert.strictEqual(nextCalls, 1);
    assert.strictEqual(res2.statusCode, 429);
    assert.strictEqual(res2.headers['retry-after'], '30');
    assert.deepStrictEqual(JSON.parse(res2.body), { error: 'Too Many Requests' });

    // custom key; falsy key skips limiting
    const byUser = limiter.middleware({ key: (req) => req.user && req.user.id });
    await byUser({}, fakeRes(), () => nextCalls++);
    assert.strictEqual(nextCalls, 2);
});

test('RateLimiter - middleware forwards store errors to next()', async () => {
    const broken = { increment: async () => { throw new Error('redis down'); } };
    const mw = createRateLimiter({ limit: 1, window: 1, store: broken }).middleware();
    let received;
    await mw({ ip: 'x' }, fakeRes(), (err) => { received = err; });
    assert.strictEqual(received.message, 'redis down');
});

test('CooldownManager - shared store (e.g. between shards)', async () => {
    const store = new MemoryStore({ sweepInterval: 0 });
    const shard0 = createCooldownManager({ store });
    const shard1 = createCooldownManager({ store });

    const first = await shard0.hit('daily', 'u1', '1h');
    assert.strictEqual(first.ok, true);
    const blocked = await shard1.hit('daily', 'u1', '1h');
    assert.strictEqual(blocked.ok, false);
    assert.ok(blocked.remaining > 0);
    assert.strictEqual((await shard1.check('daily', 'u1', '1h')).ok, false);
    assert.strictEqual((await shard1.check('daily', 'u2', '1h')).ok, true);

    // blocked attempts do not inflate the counter
    assert.strictEqual(await store.get('cooldown:daily|u1'), 1);

    assert.strictEqual(await shard1.reset('daily', 'u1'), 1);
    assert.strictEqual((await shard0.hit('daily', 'u1', '1h')).ok, true);
    await shard0.hit('daily', 'u2', '1h');
    assert.strictEqual(await shard0.reset('daily'), 2);
});

test('CommandRegistry - cooldowns through a shared store', async () => {
    const store = new MemoryStore({ sweepInterval: 0 });
    const registry = createCommandRegistry({ store, onError: () => {} });
    registry.slash({ name: 'daily', description: 'x', cooldown: '1h', execute() {} });

    const interaction = () => ({
        type: 2, commandType: 1, commandName: 'daily', user: { id: 'u' },
        async reply() {}, options: { getSubcommand: () => null, getSubcommandGroup: () => null },
    });
    assert.strictEqual((await registry.handleInteraction(interaction())).status, 'ok');
    assert.strictEqual((await registry.handleInteraction(interaction())).status, 'cooldown');
});
