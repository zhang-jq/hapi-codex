import { beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { normalizeCodexSessionImages } from './normalizeCodexSessionImages';

describe('normalizeCodexSessionImages', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await mkdtemp(join(tmpdir(), 'hapi-codex-normalize-'));
    });

    it('materializes legacy data-url images into local_images', async () => {
        const sessionId = 'session-legacy';
        const sessionsDir = join(testDir, 'sessions', '2026', '03', '18');
        await mkdir(sessionsDir, { recursive: true });
        const sessionFile = join(sessionsDir, `rollout-${sessionId}.jsonl`);
        await writeFile(
            sessionFile,
            [
                JSON.stringify({
                    type: 'event_msg',
                    payload: {
                        type: 'user_message',
                        message: '测试查看图片',
                        images: ['data:image/png;base64,QUJD'],
                        local_images: [],
                        text_elements: []
                    }
                })
            ].join('\n'),
            'utf8'
        );

        const imageStoreDir = join(testDir, 'image-store');
        const updated = await normalizeCodexSessionImages({
            sessionId,
            codexHomeDir: testDir,
            imageStoreDir
        });

        expect(updated).toBe(1);

        const normalized = JSON.parse(await readFile(sessionFile, 'utf8'));
        expect(normalized.payload.images).toEqual([]);
        expect(normalized.payload.local_images).toHaveLength(1);

        const imagePath = normalized.payload.local_images[0];
        await expect(readFile(imagePath, 'utf8')).resolves.toBe('ABC');
    });

    it('keeps already-normalized user messages untouched', async () => {
        const sessionId = 'session-local-images';
        const sessionsDir = join(testDir, 'sessions', '2026', '03', '18');
        await mkdir(sessionsDir, { recursive: true });
        const sessionFile = join(sessionsDir, `rollout-${sessionId}.jsonl`);
        await writeFile(
            sessionFile,
            [
                JSON.stringify({
                    type: 'event_msg',
                    payload: {
                        type: 'user_message',
                        message: '',
                        images: [],
                        local_images: ['/tmp/already-ok.png'],
                        text_elements: []
                    }
                })
            ].join('\n'),
            'utf8'
        );

        const updated = await normalizeCodexSessionImages({
            sessionId,
            codexHomeDir: testDir,
            imageStoreDir: join(testDir, 'image-store')
        });

        expect(updated).toBe(0);
        await expect(readFile(sessionFile, 'utf8')).resolves.toContain('/tmp/already-ok.png');
    });

    it('moves transient local_images into a persistent store', async () => {
        const sessionId = 'session-transient-local-image';
        const sessionsDir = join(testDir, 'sessions', '2026', '03', '18');
        const transientDir = await mkdtemp(join(tmpdir(), 'hapi-codex-transient-'));
        const transientImage = join(transientDir, 'legacy.jpg');

        await mkdir(sessionsDir, { recursive: true });
        await writeFile(transientImage, 'legacy-image', 'utf8');

        const sessionFile = join(sessionsDir, `rollout-${sessionId}.jsonl`);
        await writeFile(
            sessionFile,
            [
                JSON.stringify({
                    type: 'event_msg',
                    payload: {
                        type: 'user_message',
                        message: '看图',
                        images: [],
                        local_images: [transientImage],
                        text_elements: []
                    }
                })
            ].join('\n'),
            'utf8'
        );

        const imageStoreDir = join(testDir, 'image-store');
        const updated = await normalizeCodexSessionImages({
            sessionId,
            codexHomeDir: testDir,
            imageStoreDir
        });

        expect(updated).toBe(1);

        const normalized = JSON.parse(await readFile(sessionFile, 'utf8'));
        const [persistentPath] = normalized.payload.local_images;
        expect(persistentPath).toContain(imageStoreDir);
        await expect(readFile(persistentPath, 'utf8')).resolves.toBe('legacy-image');
    });
});
