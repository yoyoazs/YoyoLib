# Changelog

All notable changes to this project will be documented in this file.

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
