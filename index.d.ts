// Type definitions for yoyolib v5
// Project: https://github.com/yoyoazs/YoyoLib

// ─── Shared types ─────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';

export type StyleKey =
    | '%FRS' | '%FBold' | '%FUnderline' | '%FInverse' | '%FHidden' | '%FStrikethrough'
    | '%FK'  | '%FR'  | '%FG'  | '%FY'  | '%FB'  | '%FM'  | '%FC'  | '%FW'
    | '%FKL' | '%FRL' | '%FGL' | '%FYL' | '%FBL' | '%FML' | '%FCL' | '%FWL'
    | '%BK'  | '%BR'  | '%BG'  | '%BY'  | '%BB'  | '%BM'  | '%BC'  | '%BW'
    | '%BKL' | '%BRL' | '%BGL' | '%BYL' | '%BBL' | '%BML' | '%BCL' | '%BWL';

export type LogColorType = 'debug' | 'log' | 'info' | 'warn' | 'error' | 'time' | 'name';

// ─── Logger ───────────────────────────────────────────────────────────────────

export interface LoggerOptions {
    debug_color?: StyleKey;
    log_color?:   StyleKey;
    info_color?:  StyleKey;
    warn_color?:  StyleKey;
    error_color?: StyleKey;
    time_color?:  StyleKey;
    name_color?:  StyleKey;
    level?:       LogLevel;
    /** Max log file size in MB before rotation. Default: 0 (disabled). */
    maxSize?:     number;
    /** If true, logs are output as structured JSON objects instead of plain strings. Default: false. */
    json?:        boolean;
}

export interface LogArgs {
    content:   unknown;
    name?:     string;
    /** If false, skips console output. Default: true. */
    console?:  boolean;
    /** If false, skips file output. Default: true. */
    log?:      boolean;
}

export declare class Logger {
    constructor(file: string, logDateAndHours: boolean, args?: LoggerOptions);

    debug(args: string | Error | LogArgs | Record<string, unknown>): void;
    log(args:   string | Error | LogArgs | Record<string, unknown>): void;
    info(args:  string | Error | LogArgs | Record<string, unknown>): void;
    warn(args:  string | Error | LogArgs | Record<string, unknown>): void;
    error(args: string | Error | LogArgs | Record<string, unknown>): void;

    dir(message: any): void;
    table(table: any[]): void;
    timerStart(label: string): void;
    timerEnd(label: string): void;

    /**
     * Renders an in-place progress bar to stdout.
     * @param label   Label shown after the bar.
     * @param percent Progress value (0–100).
     * @param width   Bar width in characters. Default: 30.
     */
    progress(label: string, percent: number, width?: number): void;

    setLevel(level: LogLevel): void;
    getLevel(): LogLevel;

    setColor(type: LogColorType, color: StyleKey): void;
    getColor(type: LogColorType): StyleKey;

    /** Returns a child Logger sharing the parent's stream, with a fixed name prefix. */
    child(name: string | { name?: string; module?: string; [key: string]: unknown }): Logger;

    close(): void;
}

// ─── LangManager ─────────────────────────────────────────────────────────────

export type TranslationVars = Record<string, string | number>;

export interface LangManagerOptions {
    /** Directory holding the JSON files, relative to cwd. Default: 'langs'. */
    dir?: string;
    /** Register every `<name>.json` of `dir` as language `<name>`. Default: false. */
    autoLoad?: boolean;
    /** Language used when a key is missing. */
    fallback?: string;
    /** Active language for `use()`. Default: the first language added. */
    defaultLocale?: string;
    /** Missing key strategy. Default: 'throw'. */
    onMissing?: 'throw' | 'key' | ((key: string, locale: string) => string);
}

export interface BoundTranslator {
    (key: string, vars?: TranslationVars): string;
    /** The registered language this translator resolved to (or null). */
    readonly locale: string | null;
    has(key: string): boolean;
}

export declare class LangManager {
    constructor(options?: LangManagerOptions);
    add(lang: string, langFile: string): string;
    /** Registers (or merges into) a language from an in-memory object. */
    addResource(lang: string, translations: Record<string, any>): this;
    show(): string[];
    locales(): string[];
    set(lang: string): void;
    getActive(): string | null;
    setFallback(lang: string): void;
    /** Re-reads file-backed languages from disk. */
    reload(): string;
    /** Maps 'en-US' / 'fr_CA' / 'EN' to a registered language, or null. */
    resolveLocale(locale: string): string | null;
    /** Translates a key for a given locale, with fallback, interpolation and pluralization (vars.count). */
    t(locale: string | null | undefined, key: string, vars?: TranslationVars): string;
    /** Returns a translator bound to one locale. */
    for(locale: string | null | undefined): BoundTranslator;
    /** Translates with the active language. */
    use(message: string, args?: TranslationVars): string;
    has(key: string, locale?: string): boolean;
    /** Translation of a key in every registered language (e.g. Discord name_localizations). */
    all(key: string, vars?: TranslationVars): Record<string, string>;
    /** @deprecated Use locales(). */
    readonly language: string[];
    /** @deprecated */
    readonly languageFile: (string | null)[];
}

// ─── Profiler ────────────────────────────────────────────────────────────────

export declare class Profiler {
    constructor();
    enableProfiler(): void;
    disableProfiler(): void;
    isEnabled(): boolean;
}

// ─── ConfigManager ────────────────────────────────────────────────────────────

export declare class ConfigManager {
    constructor(filePath: string, defaults?: Record<string, any>);

    get<T = any>(key: string, def?: T): T;
    set(key: string, value: any): this;
    has(key: string): boolean;
    delete(key: string): boolean;
    all(): Record<string, any>;
    reset(): this;
    save(): this;
    reload(): this;
}

// ─── EventBus ─────────────────────────────────────────────────────────────────

export declare class EventBus {
    constructor();
    on(event: string, handler: (...args: any[]) => void): this;
    once(event: string, handler: (...args: any[]) => void): this;
    off(event: string, handler: (...args: any[]) => void): boolean;
    emit(event: string, ...args: any[]): number;
    /** Awaits and resolves all active async handler promises for this event */
    emitAsync(event: string, ...args: any[]): Promise<any[]>;
    clear(event?: string): this;
    listenerCount(event: string): number;
    eventNames(): string[];
}

// ─── Cache ────────────────────────────────────────────────────────────────────

export interface CacheOptions {
    /** Default TTL in seconds. 0 = no expiry. */
    ttl?: number;
    /** Max number of entries. 0 = unlimited. LRU eviction when full. */
    maxSize?: number;
    /** File path for writing/restoring the cache to from disk. Example : 'cache.json' */
    persist?: string;
}

export declare class Cache {
    constructor(options?: CacheOptions);

    set(key: string, value: any, ttl?: number): this;
    get<T = any>(key: string): T | null;
    has(key: string): boolean;
    delete(key: string): boolean;
    clear(): this;
    size(): number;
    keys(): string[];
    /** Returns remaining TTL in ms, null if no expiry, -1 if expired/not found. */
    ttl(key: string): number | null;
    save(): boolean;
    restore(): boolean;
}

// ─── EnvLoader ───────────────────────────────────────────────────────────────

export declare class EnvLoader {
    constructor(filePath?: string);

    get(key: string, def?: string): string | undefined;
    getNumber(key: string, def?: number): number | undefined;
    getBool(key: string, def?: boolean): boolean | undefined;
    getArray(key: string, separator?: string, def?: string[]): string[];
    require(key: string): string;
    has(key: string): boolean;
    all(): Record<string, string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export interface RetryOptions {
    /** Max number of attempts (includes the first). Default: 3. */
    attempts?: number;
    /** Delay in ms between attempts. Default: 0. */
    delay?: number;
    /** Backoff multiplier applied to delay each retry. Default: 1. */
    factor?: number;
    /** Called on each retry: (error, attempt) => void. */
    onRetry?: (error: Error, attempt: number) => void;
}

export interface DebounceOptions {
    /** If true, fires on the leading edge instead of the trailing. Default: false. */
    leading?: boolean;
}

export interface DebouncedFunction<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): void;
    cancel(): void;
    flush(): void;
}

/**
 * Retries an async function up to `attempts` times with optional delay and backoff.
 */
export declare function retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;

/**
 * Returns a throttled version of `fn`. The function fires at most once per `ms`.
 */
export declare function throttle<T extends (...args: any[]) => any>(fn: T, ms: number): T;

/**
 * Returns a debounced version of `fn` that delays invocation until after `ms` of inactivity.
 */
export declare function debounce<T extends (...args: any[]) => any>(fn: T, ms: number, options?: DebounceOptions): DebouncedFunction<T>;

// ─── Factory functions ────────────────────────────────────────────────────────

export declare function createLogger(logday?: boolean, date?: boolean, args?: LoggerOptions): Logger;
export declare function createLangManager(options?: LangManagerOptions): LangManager;
export declare function createProfiler(): Profiler;
export declare function createConfigManager(filePath: string, defaults?: Record<string, any>): ConfigManager;
export declare function createEventBus(): EventBus;
export declare function createCache(options?: CacheOptions): Cache;
export declare function createEnvLoader(filePath?: string): EnvLoader;


// ─── Scheduler ────────────────────────────────────────────────────────────────

export interface SchedulerOptions {
    /** Called when a task throws or rejects. Default: console.error. */
    onError?: (error: Error, taskName: string) => void;
}

export declare class Scheduler {
    constructor(options?: SchedulerOptions);
    every(name: string, seconds: number, callback: () => any, options?: { immediate?: boolean }): this;
    stop(name: string): boolean;
    list(): string[];
    clear(): this;
}

export declare function createScheduler(options?: SchedulerOptions): Scheduler;

// ─── Duration ─────────────────────────────────────────────────────────────────

/** Parses "1h30m", "10s", "2 days"... into milliseconds. Plain numbers are milliseconds. */
export declare function parseDuration(input: string | number): number;
/** Formats milliseconds as "1h 30m" (or "1 hour 30 minutes" with long: true). */
export declare function formatDuration(ms: number, options?: { long?: boolean; maxUnits?: number }): string;

// ─── Validator ────────────────────────────────────────────────────────────────

export interface ValidationRule {
    type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    min?: number;
    max?: number;
    regex?: RegExp;
}

export declare function validate(data: Record<string, any>, schema: Record<string, ValidationRule>): boolean;

// ─── stringUtils ──────────────────────────────────────────────────────────────

export declare const stringUtils: {
    slugify(str: string): string;
    truncate(str: string, length: number, suffix?: string): string;
    capitalize(str: string): string;
    camelCase(str: string): string;
};

// ─── SaaS Modules ─────────────────────────────────────────────────────────────

export interface RateLimiterOptions {
    /** Max hits per window. Default: 100. */
    limit?: number;
    /** Window in seconds. Default: 60. */
    window?: number;
    /** Key namespace inside a shared store. Default: 'default'. */
    name?: string;
}

export interface RateLimitStatus {
    allowed: boolean;
    remaining: number;
    resetIn: number;
    hits: number;
}

export declare class RateLimiter {
    constructor(options?: RateLimiterOptions);
    limit: number;
    window: number;
    name: string;
    consume(key: string): RateLimitStatus;
    reset(key: string): boolean;
    resetAll(): void;
    /** Express / Connect / node:http middleware (RateLimit-* headers, 429 + Retry-After). */
    middleware(options?: RateLimitMiddlewareOptions): RateLimitMiddleware;
}

export declare function createRateLimiter(options?: RateLimiterOptions): RateLimiter;

export declare const cryptoUtils: {
    uuid(): string;
    hash(text: string, algorithm?: string): string;
    randomString(length?: number): string;
    encrypt(text: string, secret: string): string;
    decrypt(encryptedData: string, secret: string): string;
    /** Returns the key to show once, and the hash to store. */
    generateApiKey(options?: { prefix?: string; bytes?: number }): { key: string; hash: string; last4: string };
    hashApiKey(key: string): string;
    safeEqual(a: string, b: string): boolean;
};

export declare const jwtUtils: {
    /** expiresIn: seconds, a duration string ('15m', '7d') or { expiresIn }. Default: 24h. */
    sign(payload: Record<string, any>, secret: string, expiresIn?: number | string | { expiresIn?: number | string }): string;
    verify(token: string, secret: string): Record<string, any>;
    decode(token: string): Record<string, any>;
};

export interface HttpRequestOptions extends Omit<RequestInit, 'headers'> {
    headers?: Record<string, string>;
    query?: Record<string, string | number | boolean>;
    json?: unknown;
    /** Extra attempts on network errors, timeouts, 408, 429 and 5xx. 4xx are never retried. Default: 0. */
    retries?: number;
    /** Delay in ms between retries when no Retry-After header is sent. Default: 500. */
    retryDelay?: number;
    /** Upper bound in ms for honoring Retry-After. Default: 30000. */
    maxRetryAfter?: number;
    timeout?: number;
    bearer?: string;
}

export declare class HttpError extends Error {
    status: number;
    url: string;
    data: any;
    /** Parsed Retry-After header in ms, or null. */
    retryAfter: number | null;
}

export declare const httpClient: {
    HttpError: typeof HttpError;
    request<T = any>(url: string, options?: HttpRequestOptions): Promise<T>;
    get<T = any>(url: string, options?: HttpRequestOptions): Promise<T>;
    post<T = any>(url: string, options?: HttpRequestOptions): Promise<T>;
    put<T = any>(url: string, options?: HttpRequestOptions): Promise<T>;
    delete<T = any>(url: string, options?: HttpRequestOptions): Promise<T>;
};

export declare class CircuitBreaker {
    constructor(action: (...args: any[]) => Promise<any>, options?: { failureThreshold?: number, resetTimeout?: number });
    fire(...args: any[]): Promise<any>;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failures: number;
}

export declare class JobQueue {
    constructor(options?: { concurrency?: number });
    push<T>(taskFn: () => Promise<T>): Promise<T>;
    clear(): void;
    readonly waiting: number;
    readonly active: number;
}

export declare const objectUtils: {
    deepClone<T>(src: T): T;
    deepMerge<T, U>(target: T, source: U): T & U;
    pick<T, K extends keyof T>(object: T, keys: K[]): Pick<T, K>;
    omit<T, K extends keyof T>(object: T, keys: K[]): Omit<T, K>;
};

export declare const apiUtils: {
    paginate<T>(items: T[], totalItems: number, page?: number, limit?: number): {
        data: T[];
        metadata: {
            totalElements: number;
            totalPages: number;
            currentPage: number;
            limit: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    };
};

export declare class ContextTracker {
    constructor();
    run<T>(context: Record<string, any>, callback: () => T): T;
    get(key?: string): any;
    set(key: string, value: any): void;
}

export declare function createContextTracker(): ContextTracker;

export interface ErrorReport {
    appName: string;
    message: string;
    stack?: string;
    context: Record<string, any>;
}

export interface ErrorReporterOptions {
    appName?: string;
    contextTracker?: ContextTracker;
    /** 'auto' (default) detects Discord/Slack from the URL. A function builds a custom body. */
    format?: 'auto' | 'discord' | 'slack' | 'raw' | ((report: ErrorReport) => unknown);
}

export declare class ErrorReporter {
    constructor(webhookUrl: string, options?: ErrorReporterOptions);
    buildPayload(report: ErrorReport): unknown;
    report(error: Error | string, extraContext?: Record<string, any>): Promise<void>;
    wrap<T extends (...args: any[]) => Promise<any>>(asyncFn: T): T;
    capture<T extends (...args: any[]) => any>(fn: T, ...args: Parameters<T>): ReturnType<T>;
    initGlobalHandler(): void;
}

export declare function createErrorReporter(webhookUrl: string, options?: ErrorReporterOptions): ErrorReporter;

export declare class ShutdownManager {
    constructor(options?: { timeout?: number, log?: boolean });
    register(name: string, taskFn: () => Promise<any> | any): void;
    listen(): void;
    shutdown(signal?: string): Promise<void>;
}

export declare function createShutdownManager(options?: { timeout?: number, log?: boolean }): ShutdownManager;

export declare const ansiColors: {
    reset(text: any): string;
    bold(text: any): string;
    dim(text: any): string;
    italic(text: any): string;
    underline(text: any): string;
    black(text: any): string;
    red(text: any): string;
    green(text: any): string;
    yellow(text: any): string;
    blue(text: any): string;
    magenta(text: any): string;
    cyan(text: any): string;
    white(text: any): string;
    gray(text: any): string;
    bgRed(text: any): string;
    bgGreen(text: any): string;
    bgYellow(text: any): string;
    bgBlue(text: any): string;
};

export declare const objectPath: {
    get(obj: Record<string, any>, path: string, defaultValue?: any): any;
    set(obj: Record<string, any>, path: string, value: any): boolean;
    has(obj: Record<string, any>, path: string): boolean;
};

export declare class HealthChecker {
    constructor();
    register(name: string, checkFn: () => Promise<boolean> | boolean): void;
    getStatus(): Promise<{
        status: 'UP' | 'DOWN';
        timestamp: string;
        uptime: number;
        latency_ms: number;
        services: Record<string, string>;
    }>;
}

export declare function createHealthChecker(): HealthChecker;

export declare class DataMasker {
    constructor(options?: { 
        fields?: string[], 
        mode?: 'blacklist' | 'whitelist',
        mask?: string,
        customMaskers?: Record<string, (val: any) => any>,
        maxDepth?: number
    });
    mask(input: any): any;
}

export declare function createDataMasker(options?: { 
    fields?: string[], 
    mode?: 'blacklist' | 'whitelist',
    mask?: string,
    customMaskers?: Record<string, (val: any) => any>,
    maxDepth?: number
}): DataMasker;

export declare const ObjectFlatten: {
    flatten(obj: Record<string, any>, prefix?: string): Record<string, any>;
    unflatten(data: Record<string, any>): Record<string, any>;
};

// ─── Bot: CooldownManager ────────────────────────────────────────────────────

export type CooldownRule = string | number | { duration: string | number; uses?: number };

export interface CooldownResult {
    /** False when the cooldown is active. */
    ok: boolean;
    /** Ms until the cooldown ends (0 when ok). */
    remaining: number;
    /** Human form of `remaining`, e.g. "4 seconds". */
    remainingText: string;
    /** Epoch ms when the window resets. */
    resetAt: number;
    usesLeft: number;
    limit: number;
}

export declare class CooldownManager {
    /** For a store-backed (async) manager, use createCooldownManager({ store }). */
    constructor(options?: { sweepInterval?: number });
    /** Consumes one use of `id` in `bucket`. */
    hit(bucket: string, id: string, rule: CooldownRule): CooldownResult;
    /** Same as hit() without consuming. */
    check(bucket: string, id: string, rule: CooldownRule): CooldownResult;
    /** Resets one id, or the whole bucket. Returns the number of entries removed. */
    reset(bucket: string, id?: string): number;
    clear(): void;
    sweep(): void;
    destroy(): void;
}

export declare function createCooldownManager(options?: { sweepInterval?: number }): CooldownManager;

// ─── Bot: CommandRegistry ────────────────────────────────────────────────────

export type HandlerKind = 'slash' | 'userContext' | 'messageContext' | 'button' | 'select' | 'modal' | 'prefix' | 'event';

export type RegistryStatus =
    | 'ok' | 'stopped' | 'not_found' | 'ignored' | 'cooldown'
    | 'denied' | 'guild_only' | 'owner_only' | 'error';

export interface HandlerResult {
    handled: boolean;
    status: RegistryStatus;
    kind?: HandlerKind | 'autocomplete';
    name?: string;
    cooldown?: CooldownResult;
    error?: Error;
}

export interface HandlerContext<T = any> {
    kind: HandlerKind | 'autocomplete';
    /** Command name, or the full customId for components. */
    name: string;
    def: HandlerDefinition;
    /** The interaction or message being handled. */
    target: T;
    client: any;
    registry: CommandRegistry;
    userId: string | null;
    guildId: string | null;
    channelId: string | null;
    /** Values captured from a customId pattern or RegExp named groups. */
    params: Record<string, string>;
    /** Prefix command arguments (quotes supported). */
    args: string[];
    /** "sub" or "group sub" for slash commands. */
    subcommand: string | null;
    /** Prefix and alias used, for prefix commands. */
    prefix?: string;
    alias?: string;
    /** Free space for middlewares. */
    state: Record<string, any>;
    /** Ephemeral reply (interaction) or reply (message). */
    reply(content: string | Record<string, any>): Promise<void>;
    /** Present when a LangManager is configured. */
    t?: BoundTranslator;
    locale?: string | null;
}

export type CooldownScope = 'user' | 'member' | 'guild' | 'channel' | 'global';

export interface HandlerChecks<T = any> {
    /** '5s', 3000, or { duration, uses, scope }. Default scope: 'user'. Owners bypass it. */
    cooldown?: string | number | { duration: string | number; uses?: number; scope?: CooldownScope };
    guildOnly?: boolean;
    ownerOnly?: boolean;
    /** Return true to allow, false to deny, or a string to deny with that message. */
    check?: (target: T, ctx: HandlerContext<T>) => boolean | string | void | Promise<boolean | string | void>;
}

export type SubcommandHandler<T = any> =
    | ((interaction: T, ctx: HandlerContext<T>) => any)
    | (HandlerChecks<T> & {
        execute: (interaction: T, ctx: HandlerContext<T>) => any;
        autocomplete?: (interaction: T, ctx: HandlerContext<T>) => any;
    });

export interface CommandDefinitionBase<T = any> extends HandlerChecks<T> {
    name?: string;
    /** A builder (anything with toJSON(), e.g. SlashCommandBuilder) or a raw API object. */
    data?: { toJSON(): any } | Record<string, any>;
    /** LangManager key prefix: `<i18n>.name` and `<i18n>.description` fill the localizations. */
    i18n?: string;
    defaultMemberPermissions?: string | number | bigint;
    contexts?: number[];
    integrationTypes?: number[];
    nsfw?: boolean;
}

export interface SlashDefinition<T = any> extends CommandDefinitionBase<T> {
    type?: 'slash';
    description?: string;
    options?: any[];
    execute?: (interaction: T, ctx: HandlerContext<T>) => any;
    autocomplete?: (interaction: T, ctx: HandlerContext<T>) => any;
    /** Keys are "sub" or "group sub". */
    subcommands?: Record<string, SubcommandHandler<T>>;
}

export interface ContextMenuDefinition<T = any> extends CommandDefinitionBase<T> {
    type?: 'userContext' | 'messageContext';
    execute: (interaction: T, ctx: HandlerContext<T>) => any;
}

export interface ComponentDefinition<T = any> extends HandlerChecks<T> {
    type?: 'button' | 'select' | 'modal';
    /** Exact customId, a pattern like 'ticket:close:{id}', or a RegExp (named groups become params). */
    id: string | RegExp;
    execute: (interaction: T, ctx: HandlerContext<T>) => any;
}

export interface PrefixDefinition<T = any> extends HandlerChecks<T> {
    type?: 'prefix';
    name: string;
    aliases?: string[];
    description?: string;
    execute: (message: T, args: string[], ctx: HandlerContext<T>) => any;
}

export interface EventDefinition {
    type?: 'event';
    name: string;
    once?: boolean;
    /** Receives the event arguments, then the context as last argument. */
    execute: (...args: any[]) => any;
}

export type HandlerDefinition = SlashDefinition | ContextMenuDefinition | ComponentDefinition | PrefixDefinition | EventDefinition;

type ReplyContent = string | Record<string, any>;

export interface RegistryMessages {
    cooldown(ctx: HandlerContext, result: CooldownResult): ReplyContent | Promise<ReplyContent>;
    guildOnly(ctx: HandlerContext): ReplyContent | Promise<ReplyContent>;
    ownerOnly(ctx: HandlerContext): ReplyContent | Promise<ReplyContent>;
    denied(ctx: HandlerContext): ReplyContent | Promise<ReplyContent>;
    error(ctx: HandlerContext, error: Error): ReplyContent | Promise<ReplyContent>;
}

export interface CommandRegistryOptions {
    /** Prefix(es) for prefix commands, or a function (e.g. per-guild prefix). */
    prefix?: string | string[] | ((message: any) => string | string[] | Promise<string | string[]>);
    /** Also accept "@Bot command". Requires attach(). */
    mentionPrefix?: boolean;
    /** Owners pass ownerOnly handlers and bypass cooldowns. */
    ownerIds?: string[];
    cooldowns?: CooldownManager | AsyncCooldownManager;
    /** Store for the internally created CooldownManager (e.g. RedisStore to share cooldowns between shards). */
    store?: Store;
    lang?: LangManager;
    /** Locale used for ctx.t. Default: interaction locale, then guild locale. */
    locale?: (target: any, ctx: HandlerContext) => string | null | Promise<string | null>;
    messages?: Partial<RegistryMessages>;
    onError?: (error: Error, ctx: HandlerContext) => any;
}

export declare class CommandRegistry {
    constructor(options?: CommandRegistryOptions);
    readonly cooldowns: CooldownManager | AsyncCooldownManager;
    client: any;

    register(def: HandlerDefinition | HandlerDefinition[]): this;
    slash(def: Omit<SlashDefinition, 'type'>): this;
    userContext(def: Omit<ContextMenuDefinition, 'type'>): this;
    messageContext(def: Omit<ContextMenuDefinition, 'type'>): this;
    button(def: Omit<ComponentDefinition, 'type'>): this;
    select(def: Omit<ComponentDefinition, 'type'>): this;
    modal(def: Omit<ComponentDefinition, 'type'>): this;
    prefix(def: Omit<PrefixDefinition, 'type'>): this;
    event(def: Omit<EventDefinition, 'type'>): this;
    /** Middleware run before every command/component handler. */
    use(fn: (ctx: HandlerContext, next: () => Promise<void>) => any): this;
    /** Recursively loads handler files; type inferred from folder names when missing. */
    loadDir(dir: string): this;

    get(kind: HandlerKind, name: string): HandlerDefinition | undefined;
    list(kind: HandlerKind): HandlerDefinition[];

    handleInteraction(interaction: any): Promise<HandlerResult>;
    handleMessage(message: any): Promise<HandlerResult>;
    reply(target: any, content: ReplyContent): Promise<void>;
    /** Registers events and routes interactionCreate / messageCreate. */
    attach(client: any): this;

    /** Application command payloads (slash + context menus). */
    toJSON(): Record<string, any>[];
    /** Overwrites the application commands (globally or in one guild). */
    deploy(options: { token: string; applicationId: string; guildId?: string }): Promise<any[]>;

    static buildCustomId(pattern: string, params?: Record<string, string | number>): string;
}

export declare function createCommandRegistry(options?: CommandRegistryOptions): CommandRegistry;

// ─── Stores ──────────────────────────────────────────────────────────────────

/** Async key/value store shared by RateLimiter, CooldownManager and CommandRegistry. Implement it to plug any backend. */
export interface Store {
    get<T = any>(key: string): Promise<T | null>;
    set(key: string, value: any, ttlMs?: number): Promise<void>;
    delete(key: string): Promise<boolean>;
    /** Increments a counter; the TTL is only applied when the key is created (fixed window). */
    increment(key: string, ttlMs: number, by?: number): Promise<{ value: number; ttl: number | null }>;
    /** Ms left, null if no expiry, -1 if missing. */
    ttl(key: string): Promise<number | null>;
    deleteByPrefix(prefix: string): Promise<number>;
}

export declare class MemoryStore implements Store {
    constructor(options?: { sweepInterval?: number });
    get<T = any>(key: string): Promise<T | null>;
    set(key: string, value: any, ttlMs?: number): Promise<void>;
    delete(key: string): Promise<boolean>;
    increment(key: string, ttlMs: number, by?: number): Promise<{ value: number; ttl: number | null }>;
    ttl(key: string): Promise<number | null>;
    deleteByPrefix(prefix: string): Promise<number>;
    close(): void;
}

export declare class RedisStore implements Store {
    /** client: a connected ioredis or node-redis (v4+) client. */
    constructor(options: { client: any; prefix?: string });
    readonly prefix: string;
    get<T = any>(key: string): Promise<T | null>;
    set(key: string, value: any, ttlMs?: number): Promise<void>;
    delete(key: string): Promise<boolean>;
    increment(key: string, ttlMs: number, by?: number): Promise<{ value: number; ttl: number | null }>;
    ttl(key: string): Promise<number | null>;
    deleteByPrefix(prefix: string): Promise<number>;
}

// ─── Async (store-backed) variants ───────────────────────────────────────────

export interface RateLimitMiddlewareOptions {
    /** Identifies the client (default: IP). Return a falsy value to skip limiting. */
    key?: (req: any) => string | null | undefined | Promise<string | null | undefined>;
    /** 429 body; objects are sent as JSON. */
    message?: string | Record<string, any>;
}

export type RateLimitMiddleware = (req: any, res: any, next?: (err?: any) => void) => Promise<void>;

export interface AsyncRateLimiter {
    limit: number;
    window: number;
    name: string;
    consume(key: string): Promise<RateLimitStatus>;
    reset(key: string): Promise<boolean>;
    resetAll(): Promise<number>;
    middleware(options?: RateLimitMiddlewareOptions): RateLimitMiddleware;
}

export declare function createRateLimiter(options: RateLimiterOptions & { store: Store }): AsyncRateLimiter;

export interface AsyncCooldownManager {
    hit(bucket: string, id: string, rule: CooldownRule): Promise<CooldownResult>;
    check(bucket: string, id: string, rule: CooldownRule): Promise<CooldownResult>;
    reset(bucket: string, id?: string): Promise<number>;
    clear(): void;
    sweep(): void;
    destroy(): void;
}

export declare function createCooldownManager(options: { store: Store; sweepInterval?: number }): AsyncCooldownManager;

// ─── webhookUtils ────────────────────────────────────────────────────────────

/** Always pass the RAW request body (string or Buffer), never a parsed object. */
export declare const webhookUtils: {
    sign(payload: string | Uint8Array, secret: string | Uint8Array, options?: { algorithm?: string; encoding?: 'hex' | 'base64' | 'base64url' }): string;
    verifyHmac(options: {
        payload: string | Uint8Array;
        signature: string | undefined | null;
        secret: string | Uint8Array;
        algorithm?: string;
        encoding?: 'hex' | 'base64' | 'base64url';
        prefix?: string;
    }): boolean;
    /** X-Hub-Signature-256 header. */
    verifyGithub(payload: string | Uint8Array, signatureHeader: string | undefined | null, secret: string): boolean;
    /** Stripe-Signature header. Default tolerance: 300 s. */
    verifyStripe(payload: string | Uint8Array, signatureHeader: string | undefined | null, secret: string, options?: { tolerance?: number }): boolean;
    /** "t=<unix>,v1=<hmac>" header for your own outgoing webhooks. */
    signTimestamped(payload: string | Uint8Array, secret: string, timestamp?: number): string;
    verifyTimestamped(payload: string | Uint8Array, header: string | undefined | null, secret: string, options?: { tolerance?: number }): boolean;
    /** X-Signature-Ed25519 / X-Signature-Timestamp headers of Discord HTTP interactions. */
    verifyDiscord(payload: string | Uint8Array, signature: string | undefined | null, timestamp: string | undefined | null, publicKey: string): boolean;
    safeEqual(a: string, b: string): boolean;
};

// ─── passwordUtils ───────────────────────────────────────────────────────────

export interface PasswordHashOptions {
    /** scrypt N, power of two. Default: 32768. */
    cost?: number;
    blockSize?: number;
    parallelization?: number;
    keyLength?: number;
    saltLength?: number;
}

export declare const passwordUtils: {
    /** Returns "$scrypt$n=...,r=...,p=...$salt$hash". */
    hash(password: string, options?: PasswordHashOptions): Promise<string>;
    /** Constant-time check; false for malformed hashes. */
    verify(password: string, stored: string | null | undefined): Promise<boolean>;
    needsRehash(stored: string, options?: PasswordHashOptions): boolean;
};
