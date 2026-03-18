import { beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { loadCodexSessionHistory, replayCodexSessionHistory } from './importCodexSessionHistory';

describe('importCodexSessionHistory', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await mkdtemp(join(tmpdir(), 'hapi-codex-history-'));
    });

    it('imports user and assistant final answers while skipping commentary', async () => {
        const sessionId = 'session-1';
        const sessionsDir = join(testDir, 'sessions', '2026', '03', '17');
        await mkdir(sessionsDir, { recursive: true });
        await writeFile(
            join(sessionsDir, `rollout-${sessionId}.jsonl`),
            [
                JSON.stringify({
                    type: 'response_item',
                    payload: {
                        type: 'message',
                        role: 'user',
                        content: [{ type: 'input_text', text: '你好' }]
                    }
                }),
                JSON.stringify({
                    type: 'response_item',
                    payload: {
                        type: 'message',
                        role: 'assistant',
                        phase: 'commentary',
                        content: [{ type: 'output_text', text: '我先看看' }]
                    }
                }),
                JSON.stringify({
                    type: 'response_item',
                    payload: {
                        type: 'message',
                        role: 'assistant',
                        phase: 'final_answer',
                        content: [{ type: 'output_text', text: '你好，我在。' }]
                    }
                })
            ].join('\n'),
            'utf8'
        );

        await expect(loadCodexSessionHistory({ sessionId, codexHomeDir: testDir })).resolves.toEqual([
            { role: 'user', text: '你好' },
            { role: 'assistant', text: '你好，我在。' }
        ]);
    });

    it('imports image attachments for historical user prompts', async () => {
        const sessionId = 'session-2';
        const sessionsDir = join(testDir, 'sessions', '2026', '03', '17');
        await mkdir(sessionsDir, { recursive: true });
        await writeFile(
            join(sessionsDir, `rollout-${sessionId}.jsonl`),
            [
                JSON.stringify({
                    type: 'response_item',
                    payload: {
                        type: 'message',
                        role: 'user',
                        content: [
                            { type: 'input_text', text: '分析一下这张图' },
                            { type: 'input_text', text: '<image>' },
                            { type: 'input_image', image_url: 'data:image/png;base64,QUJD' },
                            { type: 'input_text', text: '</image>' }
                        ]
                    }
                }),
                JSON.stringify({
                    type: 'response_item',
                    payload: {
                        type: 'message',
                        role: 'user',
                        content: [
                            { type: 'input_image', image_url: 'data:image/jpeg;base64,REVG' },
                            { type: 'input_image', image_url: 'data:image/png;base64,R0hJ' }
                        ]
                    }
                })
            ].join('\n'),
            'utf8'
        );

        const messages = await loadCodexSessionHistory({ sessionId, codexHomeDir: testDir });
        expect(messages).toHaveLength(2);
        expect(messages[0]).toMatchObject({
            role: 'user',
            text: '分析一下这张图'
        });
        expect(messages[0].attachments).toHaveLength(1);
        expect(messages[0].attachments?.[0]).toMatchObject({
            filename: 'codex-image-1.png',
            mimeType: 'image/png',
            size: 3,
            previewUrl: 'data:image/png;base64,QUJD'
        });

        expect(messages[1]).toMatchObject({
            role: 'user',
            text: ''
        });
        expect(messages[1].attachments).toHaveLength(2);
        expect(messages[1].attachments?.map((attachment) => attachment.mimeType)).toEqual([
            'image/jpeg',
            'image/png'
        ]);
    });

    it('replays only the most recent imported messages', async () => {
        const sessionId = 'session-3';
        const sessionsDir = join(testDir, 'sessions', '2026', '03', '17');
        await mkdir(sessionsDir, { recursive: true });
        await writeFile(
            join(sessionsDir, `rollout-${sessionId}.jsonl`),
            [
                JSON.stringify({
                    type: 'response_item',
                    payload: {
                        type: 'message',
                        role: 'user',
                        content: [{ type: 'input_text', text: 'one' }]
                    }
                }),
                JSON.stringify({
                    type: 'response_item',
                    payload: {
                        type: 'message',
                        role: 'assistant',
                        phase: 'final_answer',
                        content: [{ type: 'output_text', text: 'two' }]
                    }
                }),
                JSON.stringify({
                    type: 'response_item',
                    payload: {
                        type: 'message',
                        role: 'user',
                        content: [{ type: 'input_text', text: 'three' }]
                    }
                })
            ].join('\n'),
            'utf8'
        );

        const replayed: Array<{ role: string; text: string; attachments?: number }> = [];
        const count = await replayCodexSessionHistory(
            {
                sendUserMessage(text: string, _meta, attachments) {
                    replayed.push({ role: 'user', text, attachments: attachments?.length });
                },
                sendCodexMessage(body: { message: string }) {
                    replayed.push({ role: 'assistant', text: body.message });
                }
            },
            { sessionId, codexHomeDir: testDir, maxMessages: 2 }
        );

        expect(count).toBe(2);
        expect(replayed).toEqual([
            { role: 'assistant', text: 'two' },
            { role: 'user', text: 'three', attachments: undefined }
        ]);
    });
});
