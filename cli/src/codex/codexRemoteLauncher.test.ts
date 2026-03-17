import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageQueue2 } from '@/utils/MessageQueue2';
import type { EnhancedMode } from './loop';

const harness = vi.hoisted(() => ({
    notifications: [] as Array<{ method: string; params: unknown }>,
    registerRequestCalls: [] as string[],
    turnStarts: [] as unknown[]
}));

vi.mock('./codexAppServerClient', () => {
    class MockCodexAppServerClient {
        private notificationHandler: ((method: string, params: unknown) => void) | null = null;

        async connect(): Promise<void> {}

        async initialize(): Promise<{ protocolVersion: number }> {
            return { protocolVersion: 1 };
        }

        setNotificationHandler(handler: ((method: string, params: unknown) => void) | null): void {
            this.notificationHandler = handler;
        }

        registerRequestHandler(method: string): void {
            harness.registerRequestCalls.push(method);
        }

        async startThread(): Promise<{ thread: { id: string } }> {
            return { thread: { id: 'thread-anonymous' } };
        }

        async resumeThread(): Promise<{ thread: { id: string } }> {
            return { thread: { id: 'thread-anonymous' } };
        }

        async startTurn(params: unknown): Promise<{ turn: Record<string, never> }> {
            harness.turnStarts.push(params);
            const started = { turn: {} };
            harness.notifications.push({ method: 'turn/started', params: started });
            this.notificationHandler?.('turn/started', started);

            const completed = { status: 'Completed', turn: {} };
            harness.notifications.push({ method: 'turn/completed', params: completed });
            this.notificationHandler?.('turn/completed', completed);

            return { turn: {} };
        }

        async interruptTurn(): Promise<Record<string, never>> {
            return {};
        }

        async disconnect(): Promise<void> {}
    }

    return { CodexAppServerClient: MockCodexAppServerClient };
});

vi.mock('./utils/buildHapiMcpBridge', () => ({
    buildHapiMcpBridge: async () => ({
        server: {
            stop: () => {}
        },
        mcpServers: {}
    })
}));

import { codexRemoteLauncher } from './codexRemoteLauncher';
import { encodeQueuedCodexUserMessage } from './utils/queuedUserMessage';

type FakeAgentState = {
    requests: Record<string, unknown>;
    completedRequests: Record<string, unknown>;
};

function createMode(): EnhancedMode {
    return {
        permissionMode: 'default'
    };
}

function createSessionStub(options?: { initialMessage?: string; isolate?: boolean }) {
    const queue = new MessageQueue2<EnhancedMode>((mode) => JSON.stringify(mode));
    const initialMessage = options?.initialMessage ?? 'hello from launcher test';
    if (options?.isolate) {
        queue.pushIsolate(initialMessage, createMode());
    } else {
        queue.push(initialMessage, createMode());
    }
    queue.close();

    const sessionEvents: Array<{ type: string; [key: string]: unknown }> = [];
    const codexMessages: unknown[] = [];
    const thinkingChanges: boolean[] = [];
    const foundSessionIds: string[] = [];
    let agentState: FakeAgentState = {
        requests: {},
        completedRequests: {}
    };

    const rpcHandlers = new Map<string, (params: unknown) => unknown>();
    const client = {
        rpcHandlerManager: {
            registerHandler(method: string, handler: (params: unknown) => unknown) {
                rpcHandlers.set(method, handler);
            }
        },
        updateAgentState(handler: (state: FakeAgentState) => FakeAgentState) {
            agentState = handler(agentState);
        },
        sendCodexMessage(message: unknown) {
            codexMessages.push(message);
        },
        sendUserMessage(_text: string) {},
        sendSessionEvent(event: { type: string; [key: string]: unknown }) {
            sessionEvents.push(event);
        }
    };

    const session = {
        path: '/tmp/hapi-update',
        logPath: '/tmp/hapi-update/test.log',
        client,
        queue,
        codexArgs: undefined,
        codexCliOverrides: undefined,
        sessionId: null as string | null,
        thinking: false,
        onThinkingChange(nextThinking: boolean) {
            session.thinking = nextThinking;
            thinkingChanges.push(nextThinking);
        },
        onSessionFound(id: string) {
            session.sessionId = id;
            foundSessionIds.push(id);
        },
        sendCodexMessage(message: unknown) {
            client.sendCodexMessage(message);
        },
        sendSessionEvent(event: { type: string; [key: string]: unknown }) {
            client.sendSessionEvent(event);
        },
        sendUserMessage(text: string) {
            client.sendUserMessage(text);
        }
    };

    return {
        session,
        sessionEvents,
        codexMessages,
        thinkingChanges,
        foundSessionIds,
        rpcHandlers,
        getAgentState: () => agentState
    };
}

describe('codexRemoteLauncher', () => {
    afterEach(() => {
        harness.notifications = [];
        harness.registerRequestCalls = [];
        harness.turnStarts = [];
        delete process.env.CODEX_USE_MCP_SERVER;
    });

    it('finishes a turn and emits ready when task lifecycle events omit turn_id', async () => {
        delete process.env.CODEX_USE_MCP_SERVER;
        const {
            session,
            sessionEvents,
            thinkingChanges,
            foundSessionIds
        } = createSessionStub();

        const exitReason = await codexRemoteLauncher(session as never);

        expect(exitReason).toBe('exit');
        expect(foundSessionIds).toContain('thread-anonymous');
        expect(harness.notifications.map((entry) => entry.method)).toEqual(['turn/started', 'turn/completed']);
        expect(sessionEvents.filter((event) => event.type === 'ready').length).toBeGreaterThanOrEqual(1);
        expect(thinkingChanges).toContain(true);
        expect(session.thinking).toBe(false);
    });

    it('passes image attachments to app-server turns as localImage inputs', async () => {
        delete process.env.CODEX_USE_MCP_SERVER;
        const encodedMessage = encodeQueuedCodexUserMessage({
            text: 'look at this',
            attachments: [
                {
                    id: 'img-1',
                    filename: 'photo.png',
                    mimeType: 'image/png',
                    size: 128,
                    path: '/tmp/photo.png'
                }
            ]
        });
        const { session } = createSessionStub({
            initialMessage: encodedMessage,
            isolate: true
        });

        await codexRemoteLauncher(session as never);

        expect(harness.turnStarts[0]).toMatchObject({
            input: [
                { type: 'text', text: 'look at this' },
                { type: 'localImage', path: '/tmp/photo.png' }
            ]
        });
    });
});
