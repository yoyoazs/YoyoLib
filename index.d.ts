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
    content:   string;
    name?:     string;
    /** If false, skips console output. Default: true. */
    console?:  boolean;
    /** If false, skips file output. Default: true. */
    log?:      boolean;
}

export declare class Logger {
    constructor(file: string, logDateAndHours: boolean, args?: LoggerOptions);

    debug(args: string | LogArgs): void;
    log(args:   string | LogArgs): void;
    info(args:  string | LogArgs): void;
    warn(args:  string | LogArgs): void;
    error(args: string | LogArgs): void;

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

    /** Returns a new Logger instance, inheriting options but with a fixed name prefix */
    child(name: string): Logger;

    close(): void;
}

// ─── LangManager ─────────────────────────────────────────────────────────────

export declare class LangManager {
    constructor();
    add(lang: string, langFile: string): string;
    show(): string[];
    set(lang: string): void;
    getActive(): string | null;
    setFallback(lang: string): void;
    reload(): string;
    use(message: string, args?: Record<string, string | number>): string;
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
export declare function createLangManager(): LangManager;
export declare function createProfiler(): Profiler;
export declare function createConfigManager(filePath: string, defaults?: Record<string, any>): ConfigManager;
export declare function createEventBus(): EventBus;
export declare function createCache(options?: CacheOptions): Cache;
export declare function createEnvLoader(filePath?: string): EnvLoader;


// ─── Scheduler ────────────────────────────────────────────────────────────────

export declare class Scheduler {
    constructor();
    every(name: string, seconds: number, callback: (...args: any[]) => any): this;
    stop(name: string): boolean;
    list(): string[];
    clear(): this;
}

export declare function createScheduler(): Scheduler;

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
    limit?: number;
    window?: number;
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
    consume(key: string): RateLimitStatus;
    resetAll(): void;
}

export declare function createRateLimiter(options?: RateLimiterOptions): RateLimiter;

export declare const cryptoUtils: {
    uuid(): string;
    hash(text: string, algorithm?: string): string;
    randomString(length?: number): string;
    encrypt(text: string, secret: string): string;
    decrypt(encryptedData: string, secret: string): string;
};

export declare const jwtUtils: {
    sign(payload: Record<string, any>, secret: string, expiresIn?: number): string;
    verify(token: string, secret: string): Record<string, any>;
    decode(token: string): Record<string, any>;
};

export declare const httpClient: {
    request(url: string, options?: Record<string, any>): Promise<any>;
    get(url: string, options?: Record<string, any>): Promise<any>;
    post(url: string, options?: Record<string, any>): Promise<any>;
    put(url: string, options?: Record<string, any>): Promise<any>;
    delete(url: string, options?: Record<string, any>): Promise<any>;
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

export declare class ErrorReporter {
    constructor(webhookUrl: string, options?: { appName?: string, contextTracker?: ContextTracker });
    report(error: Error | string, extraContext?: Record<string, any>): Promise<void>;
    wrap<T extends (...args: any[]) => Promise<any>>(asyncFn: T): T;
    capture<T extends (...args: any[]) => any>(fn: T, ...args: Parameters<T>): ReturnType<T>;
    initGlobalHandler(): void;
}

export declare function createErrorReporter(webhookUrl: string, options?: { appName?: string, contextTracker?: ContextTracker }): ErrorReporter;

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




