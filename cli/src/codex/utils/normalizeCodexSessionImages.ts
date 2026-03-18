import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { extname, join } from 'node:path';

import { readdir } from 'node:fs/promises';

import { configuration } from '@/configuration';
import { logger } from '@/ui/logger';

type NormalizeCodexSessionImagesOptions = {
    sessionId: string;
    codexHomeDir?: string;
    imageStoreDir?: string;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    return value as JsonRecord;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function ensureTrailingSlash(value: string): string {
    return `${value.replace(/[\\/]+$/, '')}/`;
}

async function findSessionLogFile(dir: string, sessionId: string): Promise<string | null> {
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch {
        return null;
    }

    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            const nested = await findSessionLogFile(fullPath, sessionId);
            if (nested) {
                return nested;
            }
            continue;
        }

        if (entry.isFile() && entry.name.endsWith(`${sessionId}.jsonl`)) {
            return fullPath;
        }
    }

    return null;
}

function extensionFromMimeType(mimeType: string): string {
    switch (mimeType.toLowerCase()) {
        case 'image/jpeg':
            return 'jpg';
        case 'image/png':
            return 'png';
        case 'image/gif':
            return 'gif';
        case 'image/webp':
            return 'webp';
        case 'image/svg+xml':
            return 'svg';
        case 'image/bmp':
            return 'bmp';
        case 'image/heic':
            return 'heic';
        case 'image/heif':
            return 'heif';
        default:
            return 'png';
    }
}

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Buffer } | null {
    const match = /^data:([^;,]+)?(?:;[^;,=]+=[^;,]+)*(;base64)?,(.*)$/s.exec(dataUrl);
    if (!match || match[2] !== ';base64') {
        return null;
    }

    const mimeType = match[1] ?? 'image/png';
    return {
        mimeType,
        bytes: Buffer.from(match[3], 'base64')
    };
}

function buildStableImageFilename(sessionId: string, lineIndex: number, imageIndex: number, mimeType: string): string {
    const extension = extensionFromMimeType(mimeType);
    const digest = createHash('sha1')
        .update(`${sessionId}:${lineIndex}:${imageIndex}:${mimeType}`)
        .digest('hex')
        .slice(0, 12);
    return `${String(lineIndex + 1).padStart(6, '0')}-${imageIndex + 1}-${digest}.${extension}`;
}

function buildStablePathFilename(sessionId: string, lineIndex: number, imageIndex: number, sourcePath: string): string {
    const extension = extname(sourcePath) || '.png';
    const digest = createHash('sha1')
        .update(`${sessionId}:${lineIndex}:${imageIndex}:${sourcePath}`)
        .digest('hex')
        .slice(0, 12);
    return `${String(lineIndex + 1).padStart(6, '0')}-${imageIndex + 1}-${digest}${extension}`;
}

async function materializeLegacyImage(options: {
    imageEntry: string;
    sessionId: string;
    lineIndex: number;
    imageIndex: number;
    imageStoreDir: string;
}): Promise<string | null> {
    if (options.imageEntry.startsWith('data:')) {
        const parsed = parseDataUrl(options.imageEntry);
        if (!parsed) {
            return null;
        }

        await mkdir(options.imageStoreDir, { recursive: true });
        const filename = buildStableImageFilename(
            options.sessionId,
            options.lineIndex,
            options.imageIndex,
            parsed.mimeType
        );
        const filePath = join(options.imageStoreDir, filename);
        await writeFile(filePath, parsed.bytes);
        return filePath;
    }

    if (options.imageEntry.startsWith('file://')) {
        try {
            const { fileURLToPath } = await import('node:url');
            return fileURLToPath(options.imageEntry);
        } catch {
            return null;
        }
    }

    if (options.imageEntry.startsWith('/')) {
        return options.imageEntry;
    }

    return null;
}

async function persistTransientLocalImage(options: {
    localImagePath: string;
    sessionId: string;
    lineIndex: number;
    imageIndex: number;
    imageStoreDir: string;
}): Promise<string | null> {
    const normalizedStorePrefix = ensureTrailingSlash(options.imageStoreDir);
    if (options.localImagePath === options.imageStoreDir || options.localImagePath.startsWith(normalizedStorePrefix)) {
        return options.localImagePath;
    }

    const tmpPrefix = ensureTrailingSlash(tmpdir());
    if (!options.localImagePath.startsWith(tmpPrefix)) {
        return options.localImagePath;
    }

    try {
        await mkdir(options.imageStoreDir, { recursive: true });
        const filename = buildStablePathFilename(
            options.sessionId,
            options.lineIndex,
            options.imageIndex,
            options.localImagePath
        );
        const persistentPath = join(options.imageStoreDir, filename);
        await copyFile(options.localImagePath, persistentPath);
        return persistentPath;
    } catch {
        return options.localImagePath;
    }
}

/**
 * 把旧版 HAPI 写入的 event_msg.images 规范化为 Codex 原生更稳定识别的 local_images。
 * 这一步只修正已有会话日志，不改变消息文本顺序，也避免重复改写已经正常的 local_images。
 */
export async function normalizeCodexSessionImages(
    options: NormalizeCodexSessionImagesOptions
): Promise<number> {
    const codexHomeDir = options.codexHomeDir ?? process.env.CODEX_HOME ?? join(homedir(), '.codex');
    const sessionsRoot = join(codexHomeDir, 'sessions');
    const sessionFile = await findSessionLogFile(sessionsRoot, options.sessionId);

    if (!sessionFile) {
        return 0;
    }

    const imageStoreDir = options.imageStoreDir
        ?? join(configuration.happyHomeDir, 'codex-session-images', options.sessionId);
    const raw = await readFile(sessionFile, 'utf8');
    const lines = raw.split('\n');
    let updated = 0;

    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = lines[index].trim();
        if (!trimmed) {
            continue;
        }

        let record: JsonRecord | null = null;
        try {
            record = JSON.parse(trimmed);
        } catch {
            continue;
        }

        if (!record) {
            continue;
        }

        if (asString(record.type) !== 'event_msg') {
            continue;
        }

        const payload = asRecord(record.payload);
        if (!payload || asString(payload.type) !== 'user_message') {
            continue;
        }

        const existingLocalImages = Array.isArray(payload.local_images)
            ? payload.local_images.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
            : [];
        const legacyImages = Array.isArray(payload.images)
            ? payload.images.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
            : [];

        if (existingLocalImages.length === 0 && legacyImages.length === 0) {
            continue;
        }

        const convertedLocalImages: string[] = [];
        const remainingLegacyImages: string[] = [];
        let changed = false;

        for (let imageIndex = 0; imageIndex < existingLocalImages.length; imageIndex += 1) {
            const originalPath = existingLocalImages[imageIndex];
            const persistentPath = await persistTransientLocalImage({
                localImagePath: originalPath,
                sessionId: options.sessionId,
                lineIndex: index,
                imageIndex,
                imageStoreDir
            });

            if (!persistentPath) {
                continue;
            }

            if (persistentPath !== originalPath) {
                changed = true;
            }

            convertedLocalImages.push(persistentPath);
        }

        // 这里兜底旧格式：把 data URL 落成稳定文件，再改成 local_images，方便 Codex 原生前端识别。
        for (let imageIndex = 0; imageIndex < legacyImages.length; imageIndex += 1) {
            const imageEntry = legacyImages[imageIndex];
            const localImagePath = await materializeLegacyImage({
                imageEntry,
                sessionId: options.sessionId,
                lineIndex: index,
                imageIndex,
                imageStoreDir
            });

            if (localImagePath) {
                convertedLocalImages.push(localImagePath);
                changed = true;
            } else {
                remainingLegacyImages.push(imageEntry);
            }
        }

        if (!changed) {
            continue;
        }

        payload.local_images = convertedLocalImages;
        payload.images = remainingLegacyImages;
        record.payload = payload;
        lines[index] = JSON.stringify(record);
        updated += 1;
    }

    if (updated > 0) {
        await writeFile(sessionFile, lines.join('\n'), 'utf8');
        logger.debug('[codex] Normalized legacy session images', {
            sessionId: options.sessionId,
            updated,
            sessionFile,
            imageStoreDir
        });
    }

    return updated;
}
