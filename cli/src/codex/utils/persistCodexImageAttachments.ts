import { createHash } from 'node:crypto';
import { copyFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

import type { AttachmentMetadata } from '@/api/types';
import { configuration } from '@/configuration';

type PersistCodexImageAttachmentsOptions = {
    sessionId: string;
    attachments?: AttachmentMetadata[];
    imageStoreRootDir?: string;
};

function sanitizeFilenameSegment(value: string): string {
    const sanitized = value
        .replace(/[/\\]/g, '_')
        .replace(/\.\./g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 80);

    return sanitized || 'image';
}

function getPreferredExtension(attachment: AttachmentMetadata): string {
    const fromFilename = extname(attachment.filename);
    if (fromFilename) {
        return fromFilename;
    }

    switch (attachment.mimeType.toLowerCase()) {
        case 'image/jpeg':
            return '.jpg';
        case 'image/png':
            return '.png';
        case 'image/webp':
            return '.webp';
        case 'image/gif':
            return '.gif';
        case 'image/heic':
            return '.heic';
        case 'image/heif':
            return '.heif';
        default:
            return '.png';
    }
}

function isImageAttachment(attachment: AttachmentMetadata): boolean {
    return attachment.mimeType.startsWith('image/') && attachment.path.trim().length > 0;
}

function isPathInsideDir(filePath: string, dirPath: string): boolean {
    const resolvedFile = resolve(filePath);
    const resolvedDir = resolve(dirPath);
    const dirPrefix = resolvedDir.endsWith(sep) ? resolvedDir : `${resolvedDir}${sep}`;
    return resolvedFile === resolvedDir || resolvedFile.startsWith(dirPrefix);
}

function buildPersistentFilename(
    sessionId: string,
    attachment: AttachmentMetadata,
    index: number
): string {
    const baseName = sanitizeFilenameSegment(attachment.filename.replace(/\.[^/.]+$/, ''));
    const digest = createHash('sha1')
        .update(`${sessionId}:${attachment.id}:${attachment.path}:${attachment.filename}:${index}`)
        .digest('hex')
        .slice(0, 12);

    return `${String(index + 1).padStart(4, '0')}-${baseName}-${digest}${getPreferredExtension(attachment)}`;
}

export async function persistCodexImageAttachments(
    options: PersistCodexImageAttachmentsOptions
): Promise<AttachmentMetadata[] | undefined> {
    if (!options.attachments || options.attachments.length === 0) {
        return options.attachments;
    }

    const imageStoreDir = join(
        options.imageStoreRootDir ?? join(configuration.happyHomeDir, 'codex-session-images'),
        options.sessionId
    );

    let hasCopiedAnyImage = false;
    const persistedAttachments: AttachmentMetadata[] = [];

    for (let index = 0; index < options.attachments.length; index += 1) {
        const attachment = options.attachments[index];
        if (!isImageAttachment(attachment)) {
            persistedAttachments.push(attachment);
            continue;
        }

        if (isPathInsideDir(attachment.path, imageStoreDir)) {
            persistedAttachments.push(attachment);
            continue;
        }

        await mkdir(imageStoreDir, { recursive: true });
        const persistentPath = join(
            imageStoreDir,
            buildPersistentFilename(options.sessionId, attachment, index)
        );
        await copyFile(attachment.path, persistentPath);
        hasCopiedAnyImage = true;

        persistedAttachments.push({
            ...attachment,
            path: persistentPath
        });
    }

    return hasCopiedAnyImage ? persistedAttachments : options.attachments;
}
