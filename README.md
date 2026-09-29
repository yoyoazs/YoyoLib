# YoyoLib v5.0.0

A lightweight, **zero-dependency** Node.js toolkit for production-grade applications. Built for performance and reliability without the bloat of external `node_modules`.

---

## Navigation
- [Core Utilities](#core-utilities) (Logger, Lang, Config, Cache, EventBus, Env)
- [Discord Bots](#discord-bots) (CommandRegistry, CooldownManager)
- [Security & Privacy](#security--privacy) (JWT, AES, DataMasker, RateLimiter, Stores, Webhooks, Passwords, API keys)
- [Network & Resilience](#network--resilience) (HTTP Client, Circuit Breaker, API Utils)
- [Monitoring & Lifecycle](#monitoring--lifecycle) (Health, Shutdown, ErrorReporter, Profiler)
- [Advanced Data & Tasks](#advanced-data--tasks) (Flatten, Path, Validator, JobQueue, Scheduler)
- [Aesthetics & Helpers](#aesthetics--helpers) (AnsiColors, stringUtils, objectUtils, retry)

---

## Core Utilities

### Logger V3
Leveled console/file logging with child loggers, JSON output, and automatic rotation.
```javascript
const { createLogger } = require('yoyolib');
const logger = createLogger(false, true, { level: 'info', maxSize: 10 }); // rotate at 10MB

logger.info('Server started');
logger.error(new Error('DB down')); // stack trace included

const authLogger = logger.child('auth'); // or logger.child({ module: 'auth' })
authLogger.warn('Invalid login');
```

### LangManager
JSON-based i18n with per-call locales, fallback, pluralization and dot-notation keys.
Translations are loaded once in memory, so each user / guild / tenant can have its own language.
```javascript
const { createLangManager } = require('yoyolib');
const lang = createLangManager({ autoLoad: true, fallback: 'en' }); // loads ./langs/*.json

// langs/fr.json: { "welcome": "Bienvenue {user} !", "items": { "one": "{count} objet", "other": "{count} objets" } }
lang.t('fr', 'welcome', { user: 'Alice' });  // "Bienvenue Alice !"
lang.t('fr', 'items', { count: 3 });         // "3 objets" (Intl.PluralRules, optional "zero" form)
lang.t('en-US', 'welcome', { user: 'Bob' }); // 'en-US' resolves to 'en'; unknown locales use the fallback

// Discord bot: one translator per interaction
const t = lang.for(interaction.locale);
await interaction.reply(t('welcome', { user: interaction.user.username }));

// Slash command localizations (name your files with Discord locale codes: fr.json, en-US.json...)
const description_localizations = lang.all('commands.ping.description');
```
Other options: `dir` (default `'langs'`), `onMissing: 'throw' | 'key' | fn`, `addResource(lang, object)` for in-memory
translations, `reload()` to re-read files. The legacy `add()` / `set()` / `use()` API still works.

### ConfigManager
Key/Value configuration store with deep-path support (get/set) and file persistence.
```javascript
const { createConfigManager } = require('yoyolib');
const config = createConfigManager('settings.json', { debug: false });
config.set('database.port', 5432); // auto-saves
```

### EnvLoader
Typed environment variables loader (.env + process.env).
```javascript
const { createEnvLoader } = require('yoyolib');
const env = createEnvLoader();
const port = env.getNumber('PORT', 3000);
const debug = env.getBool('DEBUG', false);
```

---

## Discord Bots

### CommandRegistry
One router for **everything** a Discord bot handles: slash commands (with subcommands and groups), user and message
context menus, autocomplete, buttons, select menus, modals, prefix commands and gateway events.
It ships with cooldowns, permission checks, middlewares, error handling and deployment.
It has no dependencies and works with discord.js v14+ objects as well as raw API payloads.

```javascript
const { Client, GatewayIntentBits } = require('discord.js');
const { createCommandRegistry, createLangManager, CommandRegistry } = require('yoyolib');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const registry = createCommandRegistry({
    ownerIds: ['123456789'],               // pass ownerOnly handlers, bypass cooldowns
    lang: createLangManager({ autoLoad: true, fallback: 'en' }), // enables ctx.t
    onError: (err, ctx) => logger.error(err),
    autoDefer: true,                       // no more "The application did not respond" (see below)
});

// Slash command with subcommands ("sub" or "group sub")
registry.slash({
    name: 'ticket',
    description: 'Manage tickets',
    options: [/* raw API options, or pass a SlashCommandBuilder as `data` */],
    cooldown: '10s',                       // or { duration: '1m', uses: 3, scope: 'guild' }
    guildOnly: true,
    subcommands: {
        open: async (interaction, ctx) => {
            const id = CommandRegistry.buildCustomId('ticket:close:{id}', { id: 42 });
            await interaction.reply({ content: ctx.t('ticket.opened'), components: [/* button with customId: id */] });
        },
        'config set': { ownerOnly: true, execute: async (interaction) => { /* ... */ } },
    },
});

// Components: exact id, pattern with params, or RegExp (named groups)
registry.button({ id: 'ticket:close:{id}', execute: (interaction, ctx) => closeTicket(ctx.params.id) });
registry.select({ id: 'role-picker', execute: (interaction) => interaction.values });
registry.modal({ id: /^feedback:(?<userId>\d+)$/, execute: (interaction, ctx) => ctx.params.userId });

// Context menus, autocomplete, events
registry.userContext({ name: 'Profile', execute: (interaction) => { /* ... */ } });
registry.messageContext({ name: 'Report', execute: (interaction) => { /* ... */ } });
registry.slash({ name: 'search', description: 'Search', execute: runSearch, autocomplete: (i) => i.respond([]) });
registry.event({ name: 'ready', once: true, execute: (client, ctx) => console.log('Ready!') });

// Middlewares (logging, DB loading, blacklist...): skip next() to stop
registry.use(async (ctx, next) => { const t = Date.now(); await next(); console.log(ctx.name, Date.now() - t, 'ms'); });

registry.attach(client);                   // routes interactionCreate, messageCreate and events
// Registers slash + context menus (omit guildId for global). onlyIfChanged skips the call when nothing changed
// (hash kept in .yoyolib/commands-hash.json: add .yoyolib/ to your .gitignore).
await registry.deploy({ token, applicationId, guildId, onlyIfChanged: true });
client.login(token);
```

**Prefix commands**: `createCommandRegistry({ prefix: '!' })` accepts a string, an array or a function (for a per-guild prefix). Add `mentionPrefix: true` to also accept "@Bot command".
```javascript
registry.prefix({ name: 'say', aliases: ['echo'], execute: (message, args, ctx) => message.reply(args.join(' ')) });
// !say hello "big world"  →  args = ['hello', 'big world']
```

**Loading from folders**: `registry.loadDir('./handlers')` loads files recursively. When a file does not set a
`type`, it is taken from the folder name (`commands/`, `events/`, `buttons/`, `selects/`, `modals/`, `prefix/`,
`user/`, `message/`). Files starting with `_` are ignored.
```javascript
// handlers/commands/ping.js
module.exports = { name: 'ping', description: 'Pong!', cooldown: '3s', execute: (i) => i.reply('Pong!') };
```

**Localized commands**: with `lang` configured and `i18n: 'commands.ping'`, the keys `commands.ping.name` and
`commands.ping.description` fill `name_localizations` / `description_localizations` in `toJSON()` and `deploy()`.
Name your language files with Discord locale codes (`fr.json`, `en-US.json`...).

**Auto-defer**: Discord drops interactions that get no answer within 3 seconds. With `autoDefer: true` (globally or per
handler), the registry calls `deferReply()` (`deferUpdate()` for buttons and selects) if the handler has not answered after
2 s. Your code does not change: `interaction.reply()` and `interaction.update()` are rerouted to `editReply()` / `followUp()`.
Options: `{ after: 2000, ephemeral: false, update: true }`. Disable it (`autoDefer: false`) on handlers that open a modal after
a slow operation, since a modal must be the first response.

**Permissions**: `botPermissions` and `userPermissions` are checked before running the handler. The user gets a clear message
instead of a 403 from the API. `defaultMemberPermissions` also accepts names.
```javascript
registry.slash({
    name: 'ban', description: 'Ban a member',
    defaultMemberPermissions: ['BanMembers'],   // hides the command from members without it
    botPermissions: ['BanMembers'],             // "❌ I need these permissions: Ban Members."
    execute: async (interaction) => { /* ... */ },
});
```

Default replies (cooldown, guildOnly, ownerOnly, denied, error, botPermissions, userPermissions) are ephemeral and can be
overridden through `messages: { cooldown: (ctx, res) => ctx.t('cooldown', { time: res.remainingText }) }`.

### CooldownManager
Standalone cooldowns (used internally by CommandRegistry).
```javascript
const { createCooldownManager } = require('yoyolib');
const cooldowns = createCooldownManager();

const res = cooldowns.hit('daily', userId, '24h');          // or { duration: '1m', uses: 3 }
if (!res.ok) return reply(`Come back in ${res.remainingText}`); // "3 hours 12 minutes"
cooldowns.reset('daily', userId);
```

### GuildSettings
Per-guild settings (prefix, language, log channel, modules...) with defaults, validation and a local cache.
Only the values a guild changed are stored, so a new default applies to every guild that did not override it.
```javascript
const { createGuildSettings, createCommandRegistry, JsonFileStore } = require('yoyolib');

const settings = createGuildSettings({
    store: new JsonFileStore({ file: 'data/settings.json' }), // or RedisStore, or your own Store
    defaults: { prefix: '!', locale: 'en', logChannel: null, modules: { music: true } },
    schema: {
        prefix: { type: 'string', min: 1, max: 5 },
        locale: { choices: ['en', 'fr'] },
        logChannel: { type: 'snowflake' },          // Discord ID; null allowed because the default is null
        'modules.music': { type: 'boolean' },
    },
});

await settings.set(guildId, 'prefix', '?');         // throws ValidationError with a user-facing message
await settings.set(guildId, { locale: 'fr', modules: { music: false } });
await settings.get(guildId, 'prefix');              // '?'
await settings.get(guildId);                        // full object, defaults merged
await settings.reset(guildId, 'prefix');            // back to '!'

// Wire it into the registry: per-guild prefix, per-guild language, ctx.settings in handlers
const registry = createCommandRegistry({
    settings,
    prefix: (message) => settings.get(message.guildId, 'prefix'),
    locale: (target) => settings.get(target.guildId, 'locale'),
    lang,
});
registry.slash({
    name: 'setlog', description: 'Set the log channel', defaultMemberPermissions: ['ManageGuild'],
    options: [{ type: 7, name: 'channel', description: 'Channel', required: true }],
    execute: async (interaction, ctx) => {
        await ctx.settings.set('logChannel', interaction.options.getChannel('channel').id);
        await ctx.reply('✅ Saved');
    },
});
registry.event({ name: 'guildDelete', execute: (guild) => settings.delete(guild.id) });
```
Keys containing `__proto__`, `constructor` or `prototype` are always refused. With a schema, unknown keys are refused too.
With several processes sharing a store, a change reaches the other processes after at most `cacheTtl` (default 1 minute).

---

## Security & Privacy

### Security (JWT & AES-256-GCM)
Native cryptographic utilities using authenticated encryption.
```javascript
const { jwtUtils, cryptoUtils } = require('yoyolib');

// JWT (HS256, native crypto). expiresIn: seconds, '15m', '7d' or { expiresIn: '1h' }
const token = jwtUtils.sign({ id: 42 }, 'secret', '1h');
const decoded = jwtUtils.verify(token, 'secret'); // throws if invalid or expired

// AES-256-GCM (Authenticated Encryption) — secret must be at least 32 chars
const KEY = '32-byte-key-placeholder-here-!!!';
const encrypted = cryptoUtils.encrypt('sensitive-data', KEY); // "iv:content:tag"
const plain = cryptoUtils.decrypt(encrypted, KEY);
```

### DataMasker (GDPR)
Recursive object masker with circular reference protection and Whitelist/Blacklist modes.
```javascript
const { createDataMasker } = require('yoyolib');
const masker = createDataMasker({
    fields: ['password', 'token'],
    customMaskers: {
        email: (val) => `${val[0]}***@${val.split('@')[1]}`
    }
});
const masked = masker.mask({ email: 'user@test.com', password: '123' });
```

### RateLimiter
Fixed-window throttling for API protection, with a ready-made HTTP middleware.
```javascript
const { createRateLimiter } = require('yoyolib');
const limiter = createRateLimiter({ limit: 100, window: 60 }); // 100 req/min

const status = limiter.consume('user-ip-address');
if (!status.allowed) console.log(`Retry in ${status.resetIn}ms`);

// Express / Connect / node:http: RateLimit-* headers, 429 + Retry-After
app.use(limiter.middleware());
app.use('/api', limiter.middleware({ key: (req) => req.user?.id })); // falsy key = not limited
```

### Shared stores (Redis, multi-instance, sharding)
By default, state lives in process memory. Pass a `store` to share it between several servers, workers or Discord
shards. With a store, `consume()` / `hit()` / `check()` / `reset()` return Promises.
```javascript
const Redis = require('ioredis'); // or node-redis v4+: createClient().connect()
const { RedisStore, createRateLimiter, createCooldownManager, createCommandRegistry } = require('yoyolib');

const store = new RedisStore({ client: new Redis(process.env.REDIS_URL), prefix: 'myapp:' });

const limiter = createRateLimiter({ limit: 100, window: 60, store, name: 'api' });
await limiter.consume(ip);

const cooldowns = createCooldownManager({ store });
const registry = createCommandRegistry({ store }); // cooldowns shared by every shard
```
YoyoLib does not depend on Redis: you pass your own client. To use another backend, implement the async
`Store` interface: `get`, `set`, `delete`, `increment`, `ttl`, `deleteByPrefix` (`MemoryStore` is the reference).

For a single process without a database, `JsonFileStore` keeps the data in a JSON file (batched, atomic writes):
```javascript
const store = new JsonFileStore({ file: 'data/store.json' });
shutdown.register('store', () => store.close()); // flush pending writes on exit (ShutdownManager)
```

### Webhook verification
Verify incoming webhooks and sign the ones your SaaS sends. Always pass the **raw** body, not a re-serialized
object. With Express, use `express.raw({ type: 'application/json' })`.
```javascript
const { webhookUtils } = require('yoyolib');

webhookUtils.verifyStripe(req.body, req.headers['stripe-signature'], process.env.STRIPE_WHSEC); // 5 min tolerance
webhookUtils.verifyGithub(req.body, req.headers['x-hub-signature-256'], process.env.GITHUB_SECRET);

// Discord HTTP interactions (answer 401 when false: Discord tests it on purpose)
webhookUtils.verifyDiscord(req.body, req.headers['x-signature-ed25519'], req.headers['x-signature-timestamp'], PUBLIC_KEY);

// Your own outgoing webhooks, Stripe-style "t=...,v1=..." header
const header = webhookUtils.signTimestamped(JSON.stringify(event), customer.webhookSecret);
```

### Passwords & API keys
```javascript
const { passwordUtils, cryptoUtils } = require('yoyolib');

// scrypt (built into Node), salted, self-describing hash: "$scrypt$n=32768,r=8,p=1$salt$hash"
const stored = await passwordUtils.hash(password);
if (await passwordUtils.verify(attempt, stored)) {
    if (passwordUtils.needsRehash(stored)) await saveHash(await passwordUtils.hash(attempt));
}

// API keys: show `key` once, store only `hash`
const { key, hash, last4 } = cryptoUtils.generateApiKey({ prefix: 'sk_live' });
const row = await db.apiKeys.findOne({ hash: cryptoUtils.hashApiKey(req.headers['x-api-key']) });
```

---

## Network & Resilience

### Structured HTTP Client
Wrapper over native `fetch` with structured JSON handling, timeouts, bearer auth and smart retries.
Only transient failures are retried (network errors, timeouts, 408, 429, 5xx) and `Retry-After` is honored.
```javascript
const { httpClient } = require('yoyolib');
const data = await httpClient.get('https://api.com/data', {
    timeout: 3000,
    retries: 2,        // up to 3 attempts in total
    query: { page: 1 },
});
```

### Circuit Breaker
Protects services from cascading failures by monitoring error rates.
```javascript
const { CircuitBreaker } = require('yoyolib');
const breaker = new CircuitBreaker(myNetworkFn, { failureThreshold: 3 });
const result = await breaker.fire('param');
```

### API Utils (Pagination)
Standard envelope for paginated API responses.
```javascript
const { apiUtils } = require('yoyolib');
const response = apiUtils.paginate(items, totalCount, page, limit);
// Returns: { data: [...], metadata: { totalPages, currentPage, hasNext, ... } }
```

---

## Monitoring & Lifecycle

### HealthChecker
Aggregated status reporting for internal and external services.
```javascript
const { createHealthChecker } = require('yoyolib');
const health = createHealthChecker();
health.register('db', async () => true);
const report = await health.getStatus(); // { status: "UP", services: { ... } }
```

### ErrorReporter (Webhooks)
Automated crash notifications to Discord, Slack, or any custom webhook.
The payload format is detected from the URL (Discord embed, Slack text, raw JSON otherwise).
```javascript
const { createErrorReporter } = require('yoyolib');
const reporter = createErrorReporter('https://discord.com/api/webhooks/...', { appName: 'MyBot' });

reporter.initGlobalHandler(); // Catch all uncaught exceptions
reporter.report(new Error('Manual report'), { severity: 'high' });
```

### Profiler
Real-time system unit monitoring (CPU/RAM/Uptime) in the console.
```javascript
const { createProfiler } = require('yoyolib');
const profiler = createProfiler();
profiler.enableProfiler(); // Stats display every 2s
```

### ContextTracker (AsyncLocalStorage)
Propagate request context across the entire async call stack.
```javascript
const { createContextTracker } = require('yoyolib');
const tracker = createContextTracker();
tracker.run({ reqId: 'uuid' }, () => {
    const { reqId } = tracker.get();
});
```

---

## Advanced Data & Tasks

### Validator
Schema-based object validation with built-in rules.
```javascript
const { validate } = require('yoyolib');
const schema = {
    username: { type: 'string', required: true, min: 3 },
    age: { type: 'number', min: 18 }
};
validate({ username: 'admin', age: 25 }, schema); // throws ValidationError if fails
```

### JobQueue
Async task queue with concurrency control.
```javascript
const { JobQueue } = require('yoyolib');
const queue = new JobQueue({ concurrency: 2 });
queue.push(async () => { ... });
```

### Scheduler
Recurring task management. Failing tasks never crash the process, and a slow run is never overlapped.
```javascript
const { createScheduler } = require('yoyolib');
const scheduler = createScheduler({ onError: (err, task) => logger.error(err) });
scheduler.every('cleanup', 3600, async () => runCleanup(), { immediate: true }); // now, then every hour
```

### Durations
Human-friendly durations, handy for bot commands (`/mute @user 1h30m`) and cooldowns.
```javascript
const { parseDuration, formatDuration } = require('yoyolib');
parseDuration('1h30m');                    // 5400000
formatDuration(5400000);                   // "1h 30m"
formatDuration(5400000, { long: true });   // "1 hour 30 minutes"
```

### Data Manipulation (Flatten & Path)
```javascript
const { ObjectFlatten, objectPath } = require('yoyolib');

// Flatten/Unflatten
const flat = ObjectFlatten.flatten({ a: { b: 1 } }); // { "a.b": 1 }
// Deep access
objectPath.get({ user: { id: 1 } }, 'user.id'); // 1
```

---

## Aesthetics & Helpers

### AnsiColors
Zero-dependency terminal styling.
```javascript
const { ansiColors } = require('yoyolib');
console.log(ansiColors.bold(ansiColors.red('Critical Error!')));
```

### objectUtils
Deep merge, clone, and object filtering.
```javascript
const { objectUtils } = require('yoyolib');

const merged = objectUtils.deepMerge({ a: 1 }, { b: 2 });
const picked = objectUtils.pick({ a: 1, b: 2 }, ['a']); // { a: 1 }
const stripped = objectUtils.omit({ a: 1, b: 2 }, ['b']); // { a: 1 }
```

### stringUtils
```javascript
const { stringUtils } = require('yoyolib');
stringUtils.slugify('Hello World!'); // "hello-world"
stringUtils.camelCase('hello_world'); // "helloWorld"
```

---

## Security & Permissions

This library requires **Network Access** for the following legitimate purposes:
- **`httpClient`**: Making outgoing requests to external APIs.
- **`ErrorReporter`**: Sending automated error notifications to your configured webhooks (Discord/Slack).

No data is sent anywhere else, and we collect zero analytics.

---

## Stability & Requirements

- **Registry**: 0 external dependencies.
- **Node.js**: Requires version 18.0.0 or higher.
- **TypeScript**: Included `index.d.ts` for full intellisense.
- **CI/CD**: Fully tested suite (130 unit tests) on Node 18, 20, 22.

---

## License
[YoyoLib Custom License](LICENSE)
