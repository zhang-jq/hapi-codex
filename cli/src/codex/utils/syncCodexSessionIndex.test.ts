import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { syncCodexSessionIndex } from './syncCodexSessionIndex';

describe('syncCodexSessionIndex', () => {
    it('appends a refreshed updated_at entry while preserving the latest thread name', async () => {
        const codexHomeDir = await mkdtemp(join(tmpdir(), 'hapi-codex-index-'));
        const sessionIndexPath = join(codexHomeDir, 'session_index.jsonl');
        await writeFile(
            sessionIndexPath,
            [
                JSON.stringify({
                    id: 'session-1',
                    thread_name: 'Hapi',
                    updated_at: '2026-03-18T09:00:00.000Z'
                })
            ].join('\n') + '\n',
            'utf8'
        );

        await syncCodexSessionIndex({
            sessionId: 'session-1',
            codexHomeDir
        });

        const lines = (await readFile(sessionIndexPath, 'utf8')).trim().split('\n');
        expect(lines).toHaveLength(2);
        const appended = JSON.parse(lines[1]);
        expect(appended.id).toBe('session-1');
        expect(appended.thread_name).toBe('Hapi');
        expect(Date.parse(appended.updated_at)).not.toBeNaN();
    });

    it('writes a new session entry even when session_index does not exist yet', async () => {
        const codexHomeDir = await mkdtemp(join(tmpdir(), 'hapi-codex-index-'));
        await mkdir(codexHomeDir, { recursive: true });

        await syncCodexSessionIndex({
            sessionId: 'session-2',
            codexHomeDir,
            threadName: 'Imported Session'
        });

        const lines = (await readFile(join(codexHomeDir, 'session_index.jsonl'), 'utf8')).trim().split('\n');
        expect(lines).toHaveLength(1);
        const written = JSON.parse(lines[0]);
        expect(written).toMatchObject({
            id: 'session-2',
            thread_name: 'Imported Session'
        });
    });
});
