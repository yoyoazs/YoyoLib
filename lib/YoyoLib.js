"use strict";

const utils       = require("./utils/index.js");
const Logger      = require("./logger/LoggerV3.js");
const LangManager = require("./LangManager/LangManager.js");
const Profiler    = require("./profiler/Profiler.js");
const ConfigManager = require("./config/ConfigManager.js");
const EventBus    = require("./eventBus/EventBus.js");
const Cache       = require("./cache/Cache.js");
const EnvLoader   = require("./env/EnvLoader.js");
const Scheduler   = require("./scheduler/Scheduler.js");
const Validator   = require("./validator/Validator.js");
const RateLimiter = require("./security/RateLimiter.js");
const jwtUtils    = require("./security/jwtUtils.js");
const httpClient  = require("./network/httpClient.js");
const CircuitBreaker = require("./network/CircuitBreaker.js");
const JobQueue    = require("./concurrency/JobQueue.js");
const stringUtils = require("./utils/stringUtils.js");
const cryptoUtils = require("./utils/cryptoUtils.js");
const objectUtils = require("./utils/objectUtils.js");
const apiUtils    = require("./utils/apiUtils.js");
const objectPath   = require("./utils/objectPath.js");
const ansiColors   = require("./utils/ansiColors.js");
const ObjectFlatten = require("./utils/ObjectFlatten.js");
const DataMasker    = require("./utils/DataMasker.js");
const ContextTracker = require("./context/ContextTracker.js");
const ShutdownManager = require("./process/ShutdownManager.js");
const ErrorReporter = require("./error/ErrorReporter.js");
const HealthChecker = require("./monitoring/HealthChecker.js");
const { retry, throttle, debounce } = require("./utils/helpers.js");

// ─── Logger ───────────────────────────────────────────────────────────────────

/**
 * Creates a Logger instance.
 * @param {boolean} [logday=false] - One shared log file per day (true) or a new file per run (false).
 * @param {boolean} [date=false]   - Include the date in timestamps.
 * @param {object}  [args]         - Color overrides, level ('debug'|'log'|'info'|'warn'|'error'),
 *                                   and maxSize (MB) for file rotation.
 * @returns {Logger}
 */
function createLogger(logday = false, date = false, args = undefined) {
    if (logday) return new Logger(utils.createFileForDay(), date, args);
    return new Logger(utils.createFile(), date, args);
}

// ─── LangManager ──────────────────────────────────────────────────────────────

/**
 * Creates a LangManager for multi-language support.
 * Requires a `langs/` directory in your project root containing JSON files.
 * @returns {LangManager}
 */
function createLangManager() {
    return new LangManager();
}

// ─── Profiler ─────────────────────────────────────────────────────────────────

/**
 * Creates a Profiler for real-time CPU/RAM monitoring.
 * @returns {Profiler}
 */
function createProfiler() {
    return new Profiler();
}

// ─── ConfigManager ────────────────────────────────────────────────────────────

/**
 * Creates a ConfigManager backed by a JSON file.
 * The file is created automatically if it doesn't exist.
 * @param {string} filePath    - Path to the JSON config file.
 * @param {object} [defaults]  - Default values merged in when keys are missing.
 * @returns {ConfigManager}
 */
function createConfigManager(filePath, defaults = {}) {
    return new ConfigManager(filePath, defaults);
}

// ─── EventBus ──────────────────────────────────────────────────────────────────

/**
 * Creates a lightweight pub/sub EventBus.
 * @returns {EventBus}
 */
function createEventBus() {
    return new EventBus();
}

// ─── Cache ────────────────────────────────────────────────────────────────────

/**
 * Creates an in-memory TTL cache with optional LRU eviction.
 * @param {object} [options]
 * @param {number} [options.ttl=0]     - Default TTL in seconds (0 = no expiry).
 * @param {number} [options.maxSize=0] - Max entries before LRU eviction (0 = unlimited).
 * @returns {Cache}
 */
function createCache(options = {}) {
    return new Cache(options);
}

// ─── EnvLoader ────────────────────────────────────────────────────────────────

/**
 * Creates an EnvLoader that merges process.env with an optional .env file.
 * @param {string} [filePath='.env'] - Path to the .env file.
 * @returns {EnvLoader}
 */
function createEnvLoader(filePath = '.env') {
    return new EnvLoader(filePath);
}

// ─── Exports ──────────────────────────────────────────────────────────────────
// ─── Scheduler ────────────────────────────────────────────────────────────────

/**
 * Creates a Scheduler to run repeated tasks easily.
 * @returns {Scheduler}
 */
function createScheduler() {
    return new Scheduler();
}

// ─── SaaS Modules ────────────────────────────────────────────────────────────────

/**
 * Creates an in-memory RateLimiter logic based on the Cache module.
 * Perfect for throttling IPs or users on SaaS APIs.
 * @param {object} [options]
 * @param {number} [options.limit=100]  - Max requests allowed per window.
 * @param {number} [options.window=60]  - Time window in seconds.
 * @returns {RateLimiter}
 */
function createRateLimiter(options = {}) {
    return new RateLimiter(options);
}

/**
 * Creates a new Context Tracker using AsyncLocalStorage.
 * @returns {ContextTracker}
 */
function createContextTracker() {
    return new ContextTracker();
}

/**
 * Creates a new Shutdown Manager for graceful exit handling.
 * @param {object} [options]
 * @returns {ShutdownManager}
 */
function createShutdownManager(options = {}) {
    return new ShutdownManager(options);
}

/**
 * Creates a new Health Checker.
 * @returns {HealthChecker}
 */
function createHealthChecker() {
    return new HealthChecker();
}

/**
 * Creates a new Data Masker.
 * @param {object} [options]
 * @returns {DataMasker}
 */
function createDataMasker(options = {}) {
    return new DataMasker(options);
}

/**
 * Creates a new Error Reporter configured with a webhook URL.
 * @param {string} webhookUrl 
 * @param {object} [options]
 * @returns {ErrorReporter}
 */
function createErrorReporter(webhookUrl, options = {}) {
    return new ErrorReporter(webhookUrl, options);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    // Factories
    createLogger,
    createLangManager,
    createProfiler,
    createConfigManager,
    createEventBus,
    createCache,
    createEnvLoader,
    createScheduler,
    createRateLimiter,
    createContextTracker,
    createErrorReporter,
    createShutdownManager,
    createHealthChecker,
    createDataMasker,

    // Standalone / Static utilities
    validate: Validator.validate,
    retry,
    throttle,
    debounce,
    
    CircuitBreaker,
    JobQueue,
    
    httpClient,
    jwtUtils,
    stringUtils,
    cryptoUtils,
    objectUtils,
    apiUtils,
    objectPath,
    ansiColors,
    ObjectFlatten
};