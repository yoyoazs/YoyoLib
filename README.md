# YoyoLib v5.0.0

A lightweight, **zero-dependency** Node.js toolkit for production-grade applications. Built for performance and reliability without the bloat of external `node_modules`.

---

## Navigation
- [Core Utilities](#core-utilities) (Logger, Lang, Config, Cache, EventBus, Env)
- [Security & Privacy](#security--privacy) (JWT, AES, DataMasker, RateLimiter)
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
const authLogger = logger.child({ module: 'auth' });
authLogger.warn('Invalid login'); 
```

### LangManager
JSON-based i18n support with fallback, pluralization, and dot-notation keys.
```javascript
const { createLangManager } = require('yoyolib');
const lang = createLangManager(); // scan ./langs/*.json
lang.set('fr');
lang.use('welcome.message', { user: 'Alice' });
```

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

## Security & Privacy

### Security (JWT & AES-256-GCM)
Native cryptographic utilities using authenticated encryption.
```javascript
const { jwtUtils, cryptoUtils } = require('yoyolib');

// JWT (Native crypto implementation)
const token = jwtUtils.sign({ id: 42 }, 'secret', { expiresIn: '1h' });
const decoded = jwtUtils.verify(token, 'secret');

// AES-256-GCM (Authenticated Encryption)
const { encrypted, iv, tag } = cryptoUtils.encrypt('sensitive-data', '32-byte-key-placeholder-here-!!!');
const plain = cryptoUtils.decrypt(encrypted, '32-byte-key-placeholder-here-!!!', iv, tag);
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
Window-based throttling for API protection.
```javascript
const { createRateLimiter } = require('yoyolib');
const limiter = createRateLimiter({ limit: 100, window: 60 }); // 100 req/min

const status = limiter.consume('user-ip-address');
if (!status.allowed) console.log(`Retry in ${status.resetIn}ms`);
```

---

## Network & Resilience

### Structured HTTP Client
Wrapper over native `fetch` with structured JSON handling, timeouts, and bearer auth.
```javascript
const { httpClient } = require('yoyolib');
const data = await httpClient.get('https://api.com/data', { 
    timeout: 3000, 
    attempts: 3 
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
```javascript
const { createErrorReporter } = require('yoyolib');
const reporter = createErrorReporter('https://webhook.url');

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
Recurring task management.
```javascript
const { createScheduler } = require('yoyolib');
const scheduler = createScheduler();
scheduler.every('cleanup', 3600, () => runCleanup()); // every hour
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
- **CI/CD**: Fully tested suite (70+ unit tests) on Node 18, 20, 22.

---

## License
[YoyoLib Custom License](LICENSE)
