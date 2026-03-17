import { describe, expect, it } from 'vitest';
import { buildThreadStartParams, buildTurnStartParams } from './appServerConfig';
import { codexSystemPrompt } from './systemPrompt';

describe('appServerConfig', () => {
    const mcpServers = { hapi: { command: 'node', args: ['mcp'] } };

    it('applies CLI overrides when permission mode is default', () => {
        const params = buildThreadStartParams({
            mode: { permissionMode: 'default' },
            mcpServers,
            cliOverrides: { sandbox: 'danger-full-access', approvalPolicy: 'never' }
        });

        expect(params.sandbox).toBe('danger-full-access');
        expect(params.approvalPolicy).toBe('never');
        expect(params.baseInstructions).toBe(codexSystemPrompt);
        expect(params.developerInstructions).toBe(codexSystemPrompt);
        expect(params.config).toEqual({
            'mcp_servers.hapi': {
                command: 'node',
                args: ['mcp']
            },
            developer_instructions: codexSystemPrompt
        });
    });

    it('ignores CLI overrides when permission mode is not default', () => {
        const params = buildThreadStartParams({
            mode: { permissionMode: 'yolo' },
            mcpServers,
            cliOverrides: { sandbox: 'read-only', approvalPolicy: 'never' }
        });

        expect(params.sandbox).toBe('danger-full-access');
        expect(params.approvalPolicy).toBe('on-failure');
    });

    it('concatenates custom developer instructions after base instructions', () => {
        const params = buildThreadStartParams({
            mode: { permissionMode: 'default' },
            mcpServers,
            developerInstructions: 'Only respond in Chinese.'
        });

        expect(params.baseInstructions).toBe(codexSystemPrompt);
        expect(params.developerInstructions).toBe(`${codexSystemPrompt}\n\nOnly respond in Chinese.`);
        expect(params.config).toEqual({
            'mcp_servers.hapi': {
                command: 'node',
                args: ['mcp']
            },
            developer_instructions: `${codexSystemPrompt}\n\nOnly respond in Chinese.`
        });
    });

    it('builds turn params with mode defaults', () => {
        const params = buildTurnStartParams({
            threadId: 'thread-1',
            message: 'hello',
            mode: { permissionMode: 'read-only', model: 'o3' }
        });

        expect(params.threadId).toBe('thread-1');
        expect(params.input).toEqual([{ type: 'text', text: 'hello' }]);
        expect(params.approvalPolicy).toBe('never');
        expect(params.sandboxPolicy).toEqual({ type: 'readOnly' });
        expect(params.model).toBe('o3');
    });

    it('puts collaboration mode in turn params with model settings', () => {
        const params = buildTurnStartParams({
            threadId: 'thread-1',
            message: 'hello',
            mode: { permissionMode: 'default', model: 'o3', collaborationMode: 'plan' }
        });

        expect(params.collaborationMode).toEqual({ mode: 'plan', settings: { model: 'o3' } });
        expect(params.model).toBeUndefined();
    });

    it('applies CLI overrides for turns when permission mode is default', () => {
        const params = buildTurnStartParams({
            threadId: 'thread-1',
            message: 'hello',
            mode: { permissionMode: 'default' },
            cliOverrides: { sandbox: 'danger-full-access', approvalPolicy: 'never' }
        });

        expect(params.approvalPolicy).toBe('never');
        expect(params.sandboxPolicy).toEqual({ type: 'dangerFullAccess' });
    });

    it('ignores CLI overrides for turns when permission mode is not default', () => {
        const params = buildTurnStartParams({
            threadId: 'thread-1',
            message: 'hello',
            mode: { permissionMode: 'safe-yolo' },
            cliOverrides: { sandbox: 'read-only', approvalPolicy: 'never' }
        });

        expect(params.approvalPolicy).toBe('on-failure');
        expect(params.sandboxPolicy).toEqual({ type: 'workspaceWrite' });
    });

    it('prefers turn overrides', () => {
        const params = buildTurnStartParams({
            threadId: 'thread-1',
            message: 'hello',
            mode: { permissionMode: 'default' },
            overrides: { approvalPolicy: 'on-request', model: 'gpt-5' }
        });

        expect(params.approvalPolicy).toBe('on-request');
        expect(params.model).toBe('gpt-5');
    });

    it('sends image attachments as localImage inputs and keeps files as path references', () => {
        const params = buildTurnStartParams({
            threadId: 'thread-1',
            message: 'look at these',
            attachments: [
                {
                    id: 'img-1',
                    filename: 'photo.png',
                    mimeType: 'image/png',
                    size: 128,
                    path: '/tmp/photo.png'
                },
                {
                    id: 'file-1',
                    filename: 'notes.txt',
                    mimeType: 'text/plain',
                    size: 64,
                    path: '/tmp/notes.txt'
                }
            ],
            mode: { permissionMode: 'default' }
        });

        expect(params.input).toEqual([
            { type: 'text', text: '@/tmp/notes.txt\n\nlook at these' },
            { type: 'localImage', path: '/tmp/photo.png' }
        ]);
    });

    it('allows image-only turns without an empty text part', () => {
        const params = buildTurnStartParams({
            threadId: 'thread-1',
            message: '',
            attachments: [
                {
                    id: 'img-1',
                    filename: 'photo.png',
                    mimeType: 'image/png',
                    size: 128,
                    path: '/tmp/photo.png'
                }
            ],
            mode: { permissionMode: 'default' }
        });

        expect(params.input).toEqual([
            { type: 'localImage', path: '/tmp/photo.png' }
        ]);
    });
});
