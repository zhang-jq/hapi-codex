import { randomUUID } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { logger } from '@/ui/logger';
import type { ApiSessionClient } from '@/api/apiSession';
import type { AttachmentMetadata } from '@/api/types';

export type ImportedCodexTranscriptMessage = {
    role: 'assistant' | 'user';
    text: string;
    attachments?: AttachmentMetadata[];
};

type ImportCodexSessionHistoryOptions = {
    sessionId: string;
    codexHomeDir?: string;
    maxMessages?: number;
};

const DEFAULT_MAX_IMPORTED_MESSAGES = 400;
const IMAGE_MARKER_TOKENS = new Set(['<image>', '</image>']);

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeImportedText(chunks: string[]): string {
    return chunks
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk.length > 0 && !IMAGE_MARKER_TOKENS.has(chunk))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
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

function guessImageMimeType(filePath: string): string {
    switch (extname(filePath).toLowerCase()) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.gif':
            return 'image/gif';
        case '.webp':
            return 'image/webp';
        case '.svg':
            return 'image/svg+xml';
        case '.bmp':
            return 'image/bmp';
        case '.heic':
            return 'image/heic';
        case '.heif':
            return 'image/heif';
        default:
            return 'image/png';
    }
}

function parseDataUrl(dataUrl: string): { mimeType: string; size: number } | null {
    const match = /^data:([^;,]+)?(?:;[^;,=]+=[^;,]+)*(;base64)?,(.*)$/s.exec(dataUrl);
    if (!match || match[2] !== ';base64') {
        return null;
    }

    const mimeType = match[1] ?? 'image/png';
    const size = Buffer.byteLength(match[3], 'base64');
    return { mimeType, size };
}

function createSyntheticAttachmentPath(sessionId: string, filename: string): string {
    return `codex-history://${encodeURIComponent(sessionId)}/${encodeURIComponent(filename)}`;
}

async function loadFileAttachmentPreview(filePath: string): Promise<{
    mimeType: string;
    size: number;
    previewUrl?: string;
}> {
    const mimeType = guessImageMimeType(filePath);

    try {
        const bytes = await readFile(filePath);
        return {
            mimeType,
            size: bytes.byteLength,
            previewUrl: `data:${mimeType};base64,${bytes.toString('base64')}`
        };
    } catch {
        try {
            const details = await stat(filePath);
            return {
                mimeType,
                size: details.size
            };
        } catch {
            return {
                mimeType,
                size: 0
            };
        }
    }
}

async function buildImportedImageAttachment(
    imageEntry: Record<string, unknown>,
    options: { sessionId: string; index: number }
): Promise<AttachmentMetadata | null> {
    const imageUrl = asString(imageEntry.image_url);
    const fallbackFilename = `codex-image-${options.index + 1}.png`;

    if (imageUrl?.startsWith('data:')) {
        const parsed = parseDataUrl(imageUrl);
        if (!parsed) {
            return null;
        }

        const extension = extensionFromMimeType(parsed.mimeType);
        const filename = `codex-image-${options.index + 1}.${extension}`;
        return {
            id: randomUUID(),
            filename,
            mimeType: parsed.mimeType,
            size: parsed.size,
            path: createSyntheticAttachmentPath(options.sessionId, filename),
            previewUrl: imageUrl
        };
    }

    const filePathValue = imageUrl?.startsWith('file://')
        ? fileURLToPath(imageUrl)
        : asString(imageEntry.file_path) ?? asString(imageEntry.path) ?? imageUrl;

    if (!filePathValue) {
        return null;
    }

    if (/^https?:\/\//i.test(filePathValue)) {
        const mimeType = guessImageMimeType(filePathValue);
        const filename = basename(filePathValue) || fallbackFilename;
        return {
            id: randomUUID(),
            filename,
            mimeType,
            size: 0,
            path: filePathValue,
            previewUrl: filePathValue
        };
    }

    const filename = basename(filePathValue) || fallbackFilename;
    const preview = await loadFileAttachmentPreview(filePathValue);
    return {
        id: randomUUID(),
        filename,
        mimeType: preview.mimeType,
        size: preview.size,
        path: filePathValue,
        previewUrl: preview.previewUrl
    };
}

async function extractImportedMessage(
    payload: Record<string, unknown>,
    options: { sessionId: string }
): Promise<ImportedCodexTranscriptMessage | null> {
    if (asString(payload.type) !== 'message') {
        return null;
    }

    const role = asString(payload.role);
    if (role !== 'user' && role !== 'assistant') {
        return null;
    }

    const phase = asString(payload.phase);
    if (role === 'assistant' && phase === 'commentary') {
        return null;
    }

    const content = Array.isArray(payload.content) ? payload.content : [];
    const textChunks: string[] = [];
    const attachments: AttachmentMetadata[] = [];

    for (const entry of content) {
        const item = asRecord(entry);
        if (!item) {
            continue;
        }

        const entryType = asString(item.type)?.toLowerCase() ?? '';
        const text = asString(item.text);

        if ((entryType === 'input_text' || entryType === 'output_text') && text) {
            textChunks.push(text);
            continue;
        }

        if (entryType.includes('image')) {
            const attachment = await buildImportedImageAttachment(item, {
                sessionId: options.sessionId,
                index: attachments.length
            });
            if (attachment) {
                attachments.push(attachment);
            }
        }
    }

    const body = normalizeImportedText(textChunks);
    if (role === 'assistant') {
        return body ? { role, text: body } : null;
    }

    if (body || attachments.length > 0) {
        return {
            role,
            text: body,
            attachments: attachments.length > 0 ? attachments : undefined
        };
    }

    return null;
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

export async function loadCodexSessionHistory(
    options: ImportCodexSessionHistoryOptions
): Promise<ImportedCodexTranscriptMessage[]> {
    const codexHomeDir = options.codexHomeDir ?? process.env.CODEX_HOME ?? join(homedir(), '.codex');
    const sessionsRoot = join(codexHomeDir, 'sessions');
    const sessionFile = await findSessionLogFile(sessionsRoot, options.sessionId);

    if (!sessionFile) {
        return [];
    }

    const raw = await readFile(sessionFile, 'utf8');
    const messages: ImportedCodexTranscriptMessage[] = [];

    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }

        try {
            const record = JSON.parse(trimmed);
            const payload = asRecord(asRecord(record)?.payload);
            if (!payload) {
                continue;
            }

            const imported = await extractImportedMessage(payload, { sessionId: options.sessionId });
            if (imported) {
                messages.push(imported);
            }
        } catch (error) {
            logger.debug('[codex-history] Failed to parse session line', {
                sessionId: options.sessionId,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    const maxMessages = options.maxMessages ?? DEFAULT_MAX_IMPORTED_MESSAGES;
    return messages.length > maxMessages ? messages.slice(-maxMessages) : messages;
}

export async function replayCodexSessionHistory(
    session: Pick<ApiSessionClient, 'sendUserMessage' | 'sendCodexMessage'>,
    options: ImportCodexSessionHistoryOptions
): Promise<number> {
    const messages = await loadCodexSessionHistory(options);

    for (const message of messages) {
        if (message.role === 'user') {
            session.sendUserMessage(message.text, undefined, message.attachments);
            continue;
        }

        session.sendCodexMessage({
            type: 'message',
            message: message.text,
            id: randomUUID()
        });
    }

    return messages.length;
}
