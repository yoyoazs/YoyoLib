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
const { parseDuration, formatDuration } = require("./utils/duration.js");
const CooldownManager = require("./bot/CooldownManager.js");
const CommandRegistry = require("./bot/CommandRegistry.js");
const discordPermissions = require("./bot/permissions.js");
const GuildSettings = require("./bot/GuildSettings.js");
const { ArgumentError } = require("./bot/arguments.js");
const discordFormat = require("./bot/discordFormat.js");
const MemoryStore   = require("./store/MemoryStore.js");
const JsonFileStore = require("./store/JsonFileStore.js");
const RedisStore    = require("./store/RedisStore.js");
const webhookUtils  = require("./security/webhookUtils.js");
const passwordUtils = require("./security/passwordUtils.js");

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
 * Translations live in JSON files of a `langs/` directory (configurable) and/or are
 * registered in memory with `addResource()`.
 * @param {object}  [options]
 * @param {string}  [options.dir='langs']    - Directory holding the JSON files.
 * @param {boolean} [options.autoLoad=false] - Register every JSON file of `dir` automatically.
 * @param {string}  [options.fallback]       - Language used when a key is missing.
 * @param {string}  [options.defaultLocale]  - Active language for `use()`.
 * @param {'throw'|'key'|Function} [options.onMissing='throw'] - Missing key strategy.
 * @returns {LangManager}
 */
function createLangManager(options = {}) {
    return new LangManager(options);
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

// ─── Scheduler ────────────────────────────────────────────────────────────────

/**
 * Creates a Scheduler to run repeated tasks easily.
 * @param {object} [options]
 * @param {(error: Error, taskName: string) => void} [options.onError] - Task failure handler.
 * @returns {Scheduler}
 */
function createScheduler(options = {}) {
    return new Scheduler(options);
}

// ─── SaaS Modules ────────────────────────────────────────────────────────────────

/**
 * Creates an in-memory RateLimiter logic based on the Cache module.
 * Perfect for throttling IPs or users on SaaS APIs.
 * @param {object} [options]
 * @param {number} [options.limit=100]  - Max requests allowed per window.
 * @param {number} [options.window=60]  - Time window in seconds.
 * @param {object} [options.store]       - Shared store (e.g. RedisStore); consume() then returns a Promise.
 * @param {string} [options.name]        - Key namespace inside a shared store.
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

// ─── Bot Modules ──────────────────────────────────────────────────────────────

/**
 * Creates a CooldownManager (per user / guild / command cooldowns).
 * @param {object} [options]
 * @param {number} [options.sweepInterval=60000] - Purge interval for expired entries (ms).
 * @param {object} [options.store] - Shared store (e.g. RedisStore); methods then return Promises.
 * @returns {CooldownManager}
 */
function createCooldownManager(options = {}) {
    return new CooldownManager(options);
}

/**
 * Creates a CommandRegistry routing slash commands, context menus, autocomplete,
 * buttons, selects, modals, prefix commands and events.
 * @param {object} [options] - See CommandRegistry constructor.
 * @returns {CommandRegistry}
 */
function createCommandRegistry(options = {}) {
    return new CommandRegistry(options);
}

/**
 * Creates per-guild settings with defaults, validation and caching.
 * @param {object} [options] - See GuildSettings constructor.
 * @returns {GuildSettings}
 */
function createGuildSettings(options = {}) {
    return new GuildSettings(options);
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
    createCooldownManager,
    createCommandRegistry,
    createGuildSettings,

    // Standalone / Static utilities
    validate: Validator.validate,
    retry,
    throttle,
    debounce,
    parseDuration,
    formatDuration,

    CircuitBreaker,
    JobQueue,
    CooldownManager,
    CommandRegistry,
    discordPermissions,
    GuildSettings,
    ArgumentError,
    discordFormat,
    MemoryStore,
    JsonFileStore,
    RedisStore,
    webhookUtils,
    passwordUtils,
    
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