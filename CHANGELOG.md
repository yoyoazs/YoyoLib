# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed
- **JWT (security)**: `sign()` now accepts `'1h'` / `{ expiresIn: '1h' }` as documented. Previously these produced a string `exp` claim that `verify()` never treated as expired. `verify()` now rejects non-numeric `exp` claims and non-HS256 headers.
- **ErrorReporter**: Discord webhooks now receive an embed payload (they rejected the previous body with HTTP 400). Slack webhooks receive a `text` payload. New `format` option (`'auto'`, `'discord'`, `'slack'`, `'raw'` or a function).
- **httpClient**: `retries` only retries transient failures (network errors, timeouts, 408, 429, 5xx) and honors `Retry-After` (capped by `maxRetryAfter`). `HttpError` is exposed as `httpClient.HttpError` and carries `retryAfter`.
- **Scheduler**: task errors (sync or async) go to an `onError` handler instead of crashing the process; a run is skipped while the previous one is still pending. New `{ immediate: true }` option.
- **Logger**: `Error` objects are logged with their stack (and a `stack` field in JSON mode); plain objects are inspected instead of printing `[object Object]`. `child()` accepts `{ module: 'auth' }`, inherits the current level and shares the parent's file stream. Rotation no longer calls `statSync` on every line.
- **objectPath (security)**: `set()` / `get()` / `has()` refuse `__proto__`, `constructor` and `prototype` segments (prototype pollution) and only follow own properties.
- **README**: fixed wrong examples (JWT, cryptoUtils, httpClient `attempts`, logger child).

### Changed
- **LangManager** rewritten for bots and multi-tenant apps (legacy `add` / `set` / `use` API kept):
  - translations are loaded once in memory instead of being read from disk on every `use()`; `reload()` now actually re-reads files;
  - per-call locale with `t(locale, key, vars)` and `for(locale)`, resolving `en-US` / `fr_CA` to base languages;
  - pluralization via `Intl.PluralRules` (`one` / `other` / ..., optional `zero`) driven by `vars.count`;
  - `all(key)` for Discord `name_localizations`, `addResource()`, `has()`, `locales()`;
  - options `dir`, `autoLoad`, `fallback`, `defaultLocale`, `onMissing`;
  - the first registered language becomes active; the constructor only requires the directory when `autoLoad` is set;
  - `fallback` / `defaultLocale` options may name languages registered later (e.g. with `addResource()`).

### Removed
- `lib/multiLang/multiLang.js`: unused duplicate of LangManager (it was never exported).

### Added
- **CommandRegistry** (Discord bots): one router for slash commands (with subcommands and groups), user/message context menus, autocomplete, buttons, select menus, modals, prefix commands and gateway events. customId patterns (`ticket:close:{id}`) and RegExp, cooldowns (user/member/guild/channel/global scopes), `guildOnly` / `ownerOnly` / `check()`, middlewares, error handling with ephemeral replies, `ctx.t` from LangManager, `loadDir()` with type inference from folder names, `toJSON()` / `deploy()` to register commands through the Discord API. Works with discord.js v14+ objects and raw API payloads, without dependencies.
  - `autoDefer`: defers interactions not answered after 2 s (Discord's limit is 3 s) and reroutes `reply()` / `update()` so handlers need no change.
  - `botPermissions` / `userPermissions` checks with readable messages; permission names validated at registration; `defaultMemberPermissions` accepts names.
  - `deploy({ onlyIfChanged: true })` skips unchanged commands (hash kept in `.yoyolib/commands-hash.json`); `commandsHash()`.
- **Typed prefix arguments**: `args: [{ name, type, required, default, min, max, choices, regex }]` with types `string`, `number`, `integer`, `boolean`, `user`, `member`, `channel`, `role`, `snowflake`, `duration`, `rest`; skipping of non-matching optional arguments, automatic usage replies (`messages.usage`), `argResolvers`, `ArgumentError`. Parsing happens before the cooldown.
- **GuildSettings**: per-guild settings with defaults (only overrides are stored), schema validation (`type` incl. `snowflake`, `min`/`max`, `regex`, `choices`, `nullable`, custom `validate`), local cache with deduplicated reads, `reset()`, `for(guildId)`, and `ctx.settings` in CommandRegistry.
- **JsonFileStore**: MemoryStore persisted to a JSON file with batched, atomic writes.
- **discordPermissions**: permission flags, `resolvePermissions`, `missingPermissions`, `formatPermission`, `toBitfield`.
- **CooldownManager**: per-key cooldowns with several uses per window, `check()` without consuming, `reset()`, automatic cleanup.
- **Stores**: `MemoryStore` and `RedisStore` (bring your own ioredis or node-redis v4+ client) behind a small async `Store` interface. `RateLimiter`, `CooldownManager` and `CommandRegistry` accept `store` to share limits and cooldowns between processes or shards; their methods then return Promises.
- **RateLimiter**: `middleware()` for Express / Connect / node:http (RateLimit-* headers, 429 + Retry-After), `reset(key)`, `name` option.
- **webhookUtils**: `verifyStripe`, `verifyGithub`, `verifyDiscord` (Ed25519, HTTP interactions), `verifyHmac`, `signTimestamped` / `verifyTimestamped` for your own outgoing webhooks.
- **passwordUtils**: scrypt `hash` / `verify` / `needsRehash` with self-describing hashes.
- **cryptoUtils**: `generateApiKey`, `hashApiKey`, `safeEqual`.
- `parseDuration('1h30m')` and `formatDuration(ms)` utilities.

## [5.0.0] - Upcoming

### Added (Major Refactoring & New Features - "God Mode")
- **DataMasker**: Advanced recursive sensitive data masking for security & GDPR compliance. Supports circular references and custom blacklists.
- **HealthChecker**: Aggregated status monitoring for all your SaaS services (DB, Redis, APIs) with a single JSON report.
- **ObjectFlatten**: Universal dot-notation flattening and unflattening for complex data pipelines.
- **ShutdownManager**: Orchestrate graceful application exits by listening to `SIGINT`/`SIGTERM` and running registered cleanup tasks (DB close, Queue drain, etc.).
- **AnsiColors**: Lightweight terminal styling tool (colors, bold, underline) with zero dependencies.
- **ObjectPath**: Universal dot-notation getter, setter, and checker for any JavaScript object.
- **ErrorReporter**: New module to report uncaught exceptions and async errors to remote Webhooks (Discord/Slack support). Includes `wrap()`, `capture()`, and `initGlobalHandler()`.
- **ContextTracker**: New module using `AsyncLocalStorage` to track request contexts (like requestId) without prop-drilling (`ContextTracker.js`).
- **CryptoUtils**: Added safe symmetric encryption/decryption using `aes-256-gcm`.
- **JWT**: Built-in JSON Web Token `sign` and `verify` using native Node `crypto` (`jwtUtils.js`). Includes custom Payload `decode` logic and automatic `iat` claims.
- **HTTP Client**: Wrap over native `fetch` with structured JSON, query params parsing, and built-in error handling (`httpClient.js`). Included standard `timeout` via `AbortController` and `bearer` automatic auth injection.
- **Circuit Breaker**: Microservices resilience pattern to protect calls to failing external APIs.
- **Job Queue**: Async memory worker queue with concurrency limits (`JobQueue.js`). `push()` now returns awaitable Promises !
- **API Utils**: Included standard JSON pagination logic (`apiUtils.paginate`).
- **Object Utils**: Include `deepMerge`, `deepClone`, `pick`, and `omit` for complex json data manipulations.
- **CI/CD**: Added GitHub Actions workflow (`test.yml`) to automatically run test suites on Node 18, 20 & 22.
- **CryptoUtils**: Added zero-dependency encryption helpers (`uuid()`, `hash()`, `randomString()`).
- **RateLimiter**: Built-in memory-based API rate limiting using the new Cache system, with independent `limit` and `window` options.
- **Testing**: Added full unit test suite using `node:test` (Requires Node.js v18+).
- **ConfigManager**: Manage JSON configs via dot-notation, deep defaults merging, auto-save.
- **EventBus**: Pub/sub system with `on()`, `once()`, `emit()`, and `emitAsync()`.
- **Cache**: In-memory TTL cache with LRU eviction and persistence to disk (`persist` option, `save()`, `restore()`).
- **EnvLoader**: Typed `.env` file loader with variables expansion (`getNumber`, `getBool`, `require`).
- **Scheduler**: New module to run repeated tasks (`every(name, seconds, callback)`).
- **Validator**: New module for object validation (`validate(data, schema)`).
- **Helpers**: Added zero-dependency `retry`, `throttle`, and `debounce`.
- **String Utils**: Added `slugify`, `truncate`, `capitalize`, and `camelCase`.
- **Logger**: Added `logger.child(name)` to create derived loggers with inherited settings.
- **Logger**: Added JSON mode for structured log output via `{ json: true }`.
- **Logger**: Added `logger.progress()` for in-place terminal progress bars.
- **Logger**: Added automatic log file rotation via `maxSize` (in MB).
- **Logger**: Added log levels (`setLevel()`) and specific log methods (`debug`, `log`, `info`, `warn`, `error`).
- **TypeScript**: Provided comprehensive `index.d.ts` definitions.
- **ESM**: Added `exports` object to `package.json` for ESM support.

### Changed
- Node.js engine requirement updated to `>=18.0.0` for Native Test Support.
- **Logger**: Switched from `fs.appendFile` to `fs.createWriteStream` for async safety.
- **LangManager**: Bypassed Node's `require()` cache using `fs.readFileSync` for hot-reloads. Added `getActive()`, `setFallback()`, and `reload()`.
- **Profiler**: Re-implemented accurate CPU percentage Delta. Added `isEnabled()` and Server Uptime.

### Fixed
- Fixed typo `createLangManger` -> `createLangManager` and language typings.
- Fixed multiple cache and spelling typos in `LangManager.js` and `multiLang.js`.
- Fixed missing `ansiEscapes` in `Profiler.js` (swapped to native `readline`).
- Deleted unused and broken `bus.js` (replaced by `EventBus.js`).
- Removed native `fs` and `path` modules from NPM dependencies.

---

## [4.0.0] - Previous release
*(Historique non documenté pour les versions précédentes)*
