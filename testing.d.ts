// Type definitions for yoyolib/testing

import type { PermissionResolvable } from './index';

export type MockInteractionType = 'slash' | 'userContext' | 'messageContext' | 'autocomplete' | 'button' | 'select' | 'modal';

export interface MockInteractionOptions {
    /** Default: 'slash'. */
    type?: MockInteractionType;
    /** Command name. */
    name?: string;
    /** Component or modal custom id. */
    customId?: string;
    /** "sub" or "group sub". */
    subcommand?: string | null;
    /** Option values; users, channels and roles as objects with an id. */
    options?: Record<string, any>;
    /** Focused option name (autocomplete). */
    focused?: string;
    /** Select menu values. */
    values?: string[];
    /** Modal text inputs. */
    fields?: Record<string, string>;
    user?: { id: string; username?: string; bot?: boolean };
    /** null simulates a DM. */
    guildId?: string | null;
    channelId?: string;
    locale?: string;
    guildLocale?: string | null;
    /** Default: every permission except Administrator. */
    appPermissions?: PermissionResolvable;
    /** Default: SendMessages | UseApplicationCommands. */
    memberPermissions?: PermissionResolvable;
    /** Simulated API latency in ms. Default: 0. */
    latency?: number;
}

export interface MockCall {
    method: 'reply' | 'deferReply' | 'update' | 'deferUpdate' | 'showModal' | 'editReply' | 'followUp' | 'deleteReply' | 'respond';
    payload: any;
}

export interface MockSentMessage {
    id: string;
    channelId: string;
    content?: string;
    edits: Record<string, any>[];
    deleted: boolean;
    edit(payload: string | Record<string, any>): Promise<MockSentMessage>;
    delete(): Promise<void>;
    [key: string]: any;
}

export interface MockInteraction {
    id: string;
    type: number;
    commandType?: number;
    componentType?: number;
    commandName?: string;
    customId?: string;
    user: { id: string; username?: string; bot: boolean };
    guildId: string | null;
    channelId: string;
    locale: string;
    values: string[];
    replied: boolean;
    deferred: boolean;
    ephemeral: boolean | null;
    /** Every API call, in order. */
    calls: MockCall[];
    /** Choices sent with respond() (autocomplete). */
    responded: any[] | null;
    /** Modal shown with showModal(). */
    modal: any;
    options: {
        get(name: string): { name: string; value: any; focused: boolean } | null;
        getString(name: string): any; getInteger(name: string): any; getNumber(name: string): any;
        getBoolean(name: string): any; getUser(name: string): any; getMember(name: string): any;
        getChannel(name: string): any; getRole(name: string): any; getMentionable(name: string): any;
        getAttachment(name: string): any;
        getSubcommand(required?: boolean): string | null;
        getSubcommandGroup(required?: boolean): string | null;
        getFocused(full?: boolean): any;
    };
    fields: { getTextInputValue(name: string): string };
    reply(payload: string | Record<string, any>): Promise<void>;
    deferReply(payload?: Record<string, any>): Promise<void>;
    update(payload: string | Record<string, any>): Promise<void>;
    deferUpdate(): Promise<void>;
    showModal(modal: any): Promise<void>;
    editReply(payload: string | Record<string, any>): Promise<MockSentMessage>;
    followUp(payload: string | Record<string, any>): Promise<MockSentMessage>;
    deleteReply(): Promise<void>;
    fetchReply(): Promise<MockSentMessage>;
    respond(choices: any[]): Promise<void>;
    /** Payloads of every visible answer (reply, editReply, followUp, update). */
    replies(): Record<string, any>[];
    lastReply(): Record<string, any> | undefined;
    /** Names of the methods called, in order. */
    methods(): string[];
    [key: string]: any;
}

export interface MockMessageOptions {
    content?: string;
    author?: { id: string; username?: string; bot?: boolean };
    /** null simulates a DM. */
    guildId?: string | null;
    channelId?: string;
    /** Bot permissions in the channel. Default: everything except Administrator. */
    botPermissions?: PermissionResolvable;
    /** Author permissions in the channel. Default: SendMessages. */
    memberPermissions?: PermissionResolvable;
    botId?: string;
}

export interface MockMessage {
    id: string;
    content: string;
    author: { id: string; username?: string; bot: boolean };
    guildId: string | null;
    channelId: string;
    channel: { id: string; sent: MockSentMessage[]; send(payload: any): Promise<MockSentMessage>; permissionsFor(member: any): any };
    replies: MockSentMessage[];
    reply(payload: string | Record<string, any>): Promise<MockSentMessage>;
    lastReply(): MockSentMessage | undefined;
    [key: string]: any;
}

/** A Node EventEmitter with a bot user. */
export interface MockClient {
    user: { id: string; bot: true; username: string };
    on(event: string, listener: (...args: any[]) => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
    [key: string]: any;
}

export declare class DiscordAPIError extends Error {
    readonly code: number;
}

export declare function mockInteraction(options?: MockInteractionOptions): MockInteraction;
export declare function mockMessage(options?: MockMessageOptions): MockMessage;
export declare function mockClient(options?: { id?: string }): MockClient;
