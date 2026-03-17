import type { AttachmentMetadata } from '@/api/types';

const QUEUED_CODEX_USER_MESSAGE_PREFIX = '__hapi_codex_user_message_v1__:';

export type QueuedCodexUserMessage = {
    text: string;
    attachments?: AttachmentMetadata[];
};

export function encodeQueuedCodexUserMessage(message: QueuedCodexUserMessage): string {
    return `${QUEUED_CODEX_USER_MESSAGE_PREFIX}${JSON.stringify(message)}`;
}

export function decodeQueuedCodexUserMessage(message: string): QueuedCodexUserMessage {
    if (!message.startsWith(QUEUED_CODEX_USER_MESSAGE_PREFIX)) {
        return { text: message };
    }

    try {
        const parsed = JSON.parse(message.slice(QUEUED_CODEX_USER_MESSAGE_PREFIX.length)) as QueuedCodexUserMessage;
        return {
            text: typeof parsed.text === 'string' ? parsed.text : '',
            attachments: Array.isArray(parsed.attachments) ? parsed.attachments : undefined
        };
    } catch {
        return { text: message };
    }
}

export function formatQueuedCodexUserMessageForDisplay(message: QueuedCodexUserMessage): string {
    const parts: string[] = [];

    if (message.text) {
        parts.push(message.text);
    }

    if (message.attachments && message.attachments.length > 0) {
        const filenames = message.attachments.map((attachment) => attachment.filename).join(', ');
        parts.push(`[Attachments] ${filenames}`);
    }

    return parts.join('\n');
}
