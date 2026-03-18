import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { AttachmentMetadata } from '@/api/types';
import { persistCodexImageAttachments } from './persistCodexImageAttachments';

describe('persistCodexImageAttachments', () => {
    it('copies image attachments into the persistent codex session store', async () => {
        const testDir = await mkdtemp(join(tmpdir(), 'hapi-codex-persist-'));
        const uploadsDir = join(testDir, 'uploads');
        await mkdir(uploadsDir, { recursive: true });

        const sourceImage = join(uploadsDir, 'photo.png');
        await writeFile(sourceImage, 'png-bytes', 'utf8');

        const attachments: AttachmentMetadata[] = [
            {
                id: 'img-1',
                filename: 'photo.png',
                mimeType: 'image/png',
                size: 9,
                path: sourceImage
            },
            {
                id: 'txt-1',
                filename: 'notes.txt',
                mimeType: 'text/plain',
                size: 4,
                path: join(uploadsDir, 'notes.txt')
            }
        ];

        const persisted = await persistCodexImageAttachments({
            sessionId: 'session-1',
            attachments,
            imageStoreRootDir: join(testDir, 'image-store')
        });

        expect(persisted).toHaveLength(2);
        expect(persisted?.[0].path).not.toBe(sourceImage);
        expect(persisted?.[0].path).toContain(join(testDir, 'image-store', 'session-1'));
        await expect(readFile(persisted![0].path, 'utf8')).resolves.toBe('png-bytes');
        expect(persisted?.[1].path).toBe(join(uploadsDir, 'notes.txt'));
    });

    it('keeps already-persisted image attachments unchanged', async () => {
        const testDir = await mkdtemp(join(tmpdir(), 'hapi-codex-persist-'));
        const storeRoot = join(testDir, 'image-store');
        const sessionDir = join(storeRoot, 'session-2');
        await mkdir(sessionDir, { recursive: true });

        const persistentImage = join(sessionDir, 'kept.png');
        await writeFile(persistentImage, 'already-there', 'utf8');

        const attachments: AttachmentMetadata[] = [
            {
                id: 'img-1',
                filename: 'kept.png',
                mimeType: 'image/png',
                size: 13,
                path: persistentImage
            }
        ];

        const persisted = await persistCodexImageAttachments({
            sessionId: 'session-2',
            attachments,
            imageStoreRootDir: storeRoot
        });

        expect(persisted).toEqual(attachments);
    });
});
