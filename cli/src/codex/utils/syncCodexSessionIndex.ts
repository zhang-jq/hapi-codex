import { appendFile, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

type SyncCodexSessionIndexOptions = {
    sessionId: string;
    codexHomeDir?: string;
    threadName?: string;
};

type SessionIndexEntry = {
    id: string;
    thread_name?: string;
    updated_at?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

async function readLatestThreadName(
    filePath: string,
    sessionId: string
): Promise<string | undefined> {
    try {
        const raw = await readFile(filePath, 'utf8');
        let latestThreadName: string | undefined;

        for (const line of raw.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) {
                continue;
            }

            let parsed: unknown;
            try {
                parsed = JSON.parse(trimmed);
            } catch {
                continue;
            }

            const record = asRecord(parsed);
            if (!record || asString(record.id) !== sessionId) {
                continue;
            }

            const threadName = asString(record.thread_name);
            if (threadName) {
                latestThreadName = threadName;
            }
        }

        return latestThreadName;
    } catch {
        return undefined;
    }
}

export async function syncCodexSessionIndex(
    options: SyncCodexSessionIndexOptions
): Promise<void> {
    const codexHomeDir = options.codexHomeDir ?? process.env.CODEX_HOME ?? join(homedir(), '.codex');
    const sessionIndexPath = join(codexHomeDir, 'session_index.jsonl');
    const existingThreadName = await readLatestThreadName(sessionIndexPath, options.sessionId);

    const entry: SessionIndexEntry = {
        id: options.sessionId,
        thread_name: options.threadName ?? existingThreadName,
        updated_at: new Date().toISOString()
    };

    await appendFile(sessionIndexPath, `${JSON.stringify(entry)}\n`, 'utf8');
}
