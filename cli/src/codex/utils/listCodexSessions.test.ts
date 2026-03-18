import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { listCodexSessions, listCodexSessionsPage } from './listCodexSessions';

describe('listCodexSessions', () => {
    let testDir: string;
    let originalCodexHome: string | undefined;

    beforeEach(async () => {
        testDir = join(tmpdir(), `codex-session-list-${Date.now()}`);
        await mkdir(join(testDir, 'sessions', '2026', '03', '17'), { recursive: true });
        originalCodexHome = process.env.CODEX_HOME;
        process.env.CODEX_HOME = testDir;
    });

    afterEach(async () => {
        if (originalCodexHome === undefined) {
            delete process.env.CODEX_HOME;
        } else {
            process.env.CODEX_HOME = originalCodexHome;
        }

        if (existsSync(testDir)) {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    it('merges session titles from session_index and cwd from session files', async () => {
        await writeFile(
            join(testDir, 'session_index.jsonl'),
            [
                JSON.stringify({
                    id: 'session-1',
                    thread_name: '小龙虾维保',
                    updated_at: '2026-03-17T08:00:00.000Z'
                }),
                JSON.stringify({
                    id: 'session-2',
                    thread_name: 'Enable mobile chat',
                    updated_at: '2026-03-17T07:00:00.000Z'
                })
            ].join('\n') + '\n'
        );

        await writeFile(
            join(testDir, 'sessions', '2026', '03', '17', 'first.jsonl'),
            JSON.stringify({
                type: 'session_meta',
                payload: {
                    id: 'session-1',
                    cwd: '/Volumes/DATA/Temp/codex',
                    timestamp: '2026-03-17T07:59:00.000Z',
                    originator: 'Codex Desktop'
                }
            }) + '\n'
        );
        await writeFile(
            join(testDir, 'sessions', '2026', '03', '17', 'second.jsonl'),
            JSON.stringify({
                type: 'session_meta',
                payload: {
                    id: 'session-2',
                    cwd: '/tmp/project',
                    timestamp: '2026-03-17T06:59:00.000Z'
                }
            }) + '\n'
        );

        const sessions = await listCodexSessions();

        expect(sessions).toHaveLength(2);
        expect(sessions[0]).toMatchObject({
            id: 'session-1',
            title: '小龙虾维保',
            cwd: '/Volumes/DATA/Temp/codex',
            originator: 'Codex Desktop'
        });
        expect(sessions[1]).toMatchObject({
            id: 'session-2',
            title: 'Enable mobile chat',
            cwd: '/tmp/project'
        });
        expect(sessions[0].updatedAt).toBe(Date.parse('2026-03-17T08:00:00.000Z'));
    });

    it('keeps the newest index title for duplicate session ids', async () => {
        await writeFile(
            join(testDir, 'session_index.jsonl'),
            [
                JSON.stringify({
                    id: 'session-1',
                    thread_name: '旧标题',
                    updated_at: '2026-03-17T08:00:00.000Z'
                }),
                JSON.stringify({
                    id: 'session-1',
                    thread_name: '新标题',
                    updated_at: '2026-03-17T09:00:00.000Z'
                })
            ].join('\n') + '\n'
        );

        await writeFile(
            join(testDir, 'sessions', '2026', '03', '17', 'single.jsonl'),
            JSON.stringify({
                type: 'session_meta',
                payload: {
                    id: 'session-1',
                    cwd: '/tmp/project',
                    timestamp: '2026-03-17T08:30:00.000Z'
                }
            }) + '\n'
        );

        const sessions = await listCodexSessions();

        expect(sessions).toHaveLength(1);
        expect(sessions[0].title).toBe('新标题');
        expect(sessions[0].updatedAt).toBe(Date.parse('2026-03-17T09:00:00.000Z'));
    });

    it('falls back to cwd basename when session index is missing', async () => {
        await writeFile(
            join(testDir, 'sessions', '2026', '03', '17', 'single.jsonl'),
            JSON.stringify({
                type: 'session_meta',
                payload: {
                    id: 'session-1',
                    cwd: '/tmp/my-project',
                    timestamp: '2026-03-17T08:30:00.000Z'
                }
            }) + '\n'
        );

        const sessions = await listCodexSessions();

        expect(sessions).toHaveLength(1);
        expect(sessions[0]).toMatchObject({
            id: 'session-1',
            title: 'my-project',
            cwd: '/tmp/my-project'
        });
    });

    it('filters sessions by title and cwd before applying the limit', async () => {
        await writeFile(
            join(testDir, 'session_index.jsonl'),
            [
                JSON.stringify({
                    id: 'session-1',
                    thread_name: '小龙虾维保',
                    updated_at: '2026-03-17T09:00:00.000Z'
                }),
                JSON.stringify({
                    id: 'session-2',
                    thread_name: '另一个项目',
                    updated_at: '2026-03-17T08:00:00.000Z'
                }),
                JSON.stringify({
                    id: 'session-3',
                    thread_name: '小龙虾日报',
                    updated_at: '2026-03-17T07:00:00.000Z'
                })
            ].join('\n') + '\n'
        );

        await writeFile(
            join(testDir, 'sessions', '2026', '03', '17', 'first.jsonl'),
            JSON.stringify({
                type: 'session_meta',
                payload: {
                    id: 'session-1',
                    cwd: '/Volumes/DATA/Temp/codex/ops',
                    timestamp: '2026-03-17T08:59:00.000Z'
                }
            }) + '\n'
        );
        await writeFile(
            join(testDir, 'sessions', '2026', '03', '17', 'second.jsonl'),
            JSON.stringify({
                type: 'session_meta',
                payload: {
                    id: 'session-2',
                    cwd: '/Volumes/DATA/Develop/Project/zengzhi',
                    timestamp: '2026-03-17T07:59:00.000Z'
                }
            }) + '\n'
        );
        await writeFile(
            join(testDir, 'sessions', '2026', '03', '17', 'third.jsonl'),
            JSON.stringify({
                type: 'session_meta',
                payload: {
                    id: 'session-3',
                    cwd: '/Volumes/DATA/Temp/codex/reports',
                    timestamp: '2026-03-17T06:59:00.000Z'
                }
            }) + '\n'
        );

        const titleMatches = await listCodexSessions({
            titleQuery: '小龙虾',
            limit: 10
        });
        expect(titleMatches.map((session) => session.id)).toEqual(['session-1', 'session-3']);

        const cwdMatches = await listCodexSessions({
            cwdQuery: '/Volumes/DATA/Temp/codex',
            limit: 10
        });
        expect(cwdMatches.map((session) => session.id)).toEqual(['session-1', 'session-3']);

        const limitedMatches = await listCodexSessions({
            titleQuery: '小龙虾',
            cwdQuery: '/reports',
            limit: 1
        });
        expect(limitedMatches).toHaveLength(1);
        expect(limitedMatches[0]?.id).toBe('session-3');
    });

    it('supports pagination metadata and directory options', async () => {
        await writeFile(
            join(testDir, 'session_index.jsonl'),
            [
                JSON.stringify({
                    id: 'session-1',
                    thread_name: 'Alpha',
                    updated_at: '2026-03-17T09:00:00.000Z'
                }),
                JSON.stringify({
                    id: 'session-2',
                    thread_name: 'Beta',
                    updated_at: '2026-03-17T08:00:00.000Z'
                }),
                JSON.stringify({
                    id: 'session-3',
                    thread_name: 'Gamma',
                    updated_at: '2026-03-17T07:00:00.000Z'
                })
            ].join('\n') + '\n'
        );

        await writeFile(
            join(testDir, 'sessions', '2026', '03', '17', 'first.jsonl'),
            JSON.stringify({
                type: 'session_meta',
                payload: {
                    id: 'session-1',
                    cwd: '/Volumes/DATA/Temp/codex',
                    timestamp: '2026-03-17T08:59:00.000Z'
                }
            }) + '\n'
        );
        await writeFile(
            join(testDir, 'sessions', '2026', '03', '17', 'second.jsonl'),
            JSON.stringify({
                type: 'session_meta',
                payload: {
                    id: 'session-2',
                    cwd: '/Volumes/DATA/Temp/codex',
                    timestamp: '2026-03-17T07:59:00.000Z'
                }
            }) + '\n'
        );
        await writeFile(
            join(testDir, 'sessions', '2026', '03', '17', 'third.jsonl'),
            JSON.stringify({
                type: 'session_meta',
                payload: {
                    id: 'session-3',
                    cwd: '/Volumes/DATA/Develop/Project/zengzhi',
                    timestamp: '2026-03-17T06:59:00.000Z'
                }
            }) + '\n'
        );

        const result = await listCodexSessionsPage({
            limit: 1,
            offset: 1
        });

        expect(result.total).toBe(3);
        expect(result.page).toEqual({
            limit: 1,
            offset: 1,
            hasMore: true
        });
        expect(result.sessions.map((session) => session.id)).toEqual(['session-2']);
        expect(result.directories.slice(0, 2)).toEqual([
            '/Volumes/DATA/Temp/codex',
            '/Volumes/DATA'
        ]);
        expect(result.directories).toContain('/Volumes/DATA/Develop/Project/zengzhi');
    });

    it('omits ancestor directories that only cover one unique leaf directory', async () => {
        await writeFile(
            join(testDir, 'session_index.jsonl'),
            JSON.stringify({
                id: 'session-1',
                thread_name: 'dosc',
                updated_at: '2026-03-17T09:00:00.000Z'
            }) + '\n'
        );

        await writeFile(
            join(testDir, 'sessions', '2026', '03', '17', 'single.jsonl'),
            JSON.stringify({
                type: 'session_meta',
                payload: {
                    id: 'session-1',
                    cwd: '/Volumes/DATA/Document/zhangjiaqiang/dosc',
                    timestamp: '2026-03-17T08:59:00.000Z'
                }
            }) + '\n'
        );

        const result = await listCodexSessionsPage({ limit: 10 });

        expect(result.directories).toEqual([
            '/Volumes/DATA/Document/zhangjiaqiang/dosc'
        ]);
    });
});
