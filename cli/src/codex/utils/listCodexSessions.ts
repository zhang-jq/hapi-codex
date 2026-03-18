import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';

export interface ImportableCodexSession {
    id: string;
    title: string;
    cwd: string;
    updatedAt: number;
    originator?: string;
}

export interface ListCodexSessionsOptions {
    limit?: number;
    offset?: number;
    titleQuery?: string;
    cwdQuery?: string;
    directoriesLimit?: number;
}

export interface ListCodexSessionsPage {
    sessions: ImportableCodexSession[];
    total: number;
    directories: string[];
    page: {
        limit: number;
        offset: number;
        hasMore: boolean;
    };
}

type SessionIndexEntry = {
    id: string;
    thread_name?: string;
    updated_at?: string;
};

type SessionMetaEntry = {
    id: string;
    cwd: string;
    updatedAt: number;
    originator?: string;
};

const DEFAULT_LIMIT = 30;
const DEFAULT_DIRECTORIES_LIMIT = 100;

export async function listCodexSessions(options: number | ListCodexSessionsOptions = DEFAULT_LIMIT): Promise<ImportableCodexSession[]> {
    return (await listCodexSessionsPage(options)).sessions;
}

export async function listCodexSessionsPage(options: number | ListCodexSessionsOptions = DEFAULT_LIMIT): Promise<ListCodexSessionsPage> {
    const normalizedOptions = normalizeOptions(options);
    const codexHomeDir = process.env.CODEX_HOME || join(homedir(), '.codex');
    const sessionIndexPath = join(codexHomeDir, 'session_index.jsonl');
    const sessionsRoot = join(codexHomeDir, 'sessions');

    const [indexById, metaById] = await Promise.all([
        readSessionIndex(sessionIndexPath),
        readSessionMetadata(sessionsRoot)
    ]);

    const merged = new Map<string, ImportableCodexSession>();

    for (const [id, meta] of metaById.entries()) {
        const indexed = indexById.get(id);
        const updatedAt = indexed?.updatedAt ?? meta.updatedAt;
        merged.set(id, {
            id,
            title: pickSessionTitle(indexed?.threadName, meta.cwd, id),
            cwd: meta.cwd,
            updatedAt,
            originator: meta.originator
        });
    }

    const sessions = Array.from(merged.values())
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .filter((session) => matchesSearch(session, normalizedOptions));

    const total = sessions.length;
    const pagedSessions = normalizedOptions.limit > 0
        ? sessions.slice(normalizedOptions.offset, normalizedOptions.offset + normalizedOptions.limit)
        : sessions.slice(normalizedOptions.offset);
    const directories = collectDirectorySuggestions(sessions, normalizedOptions.directoriesLimit);

    return {
        sessions: pagedSessions,
        total,
        directories,
        page: {
            limit: normalizedOptions.limit,
            offset: normalizedOptions.offset,
            hasMore: normalizedOptions.offset + pagedSessions.length < total
        }
    };
}

function normalizeOptions(options: number | ListCodexSessionsOptions): Required<ListCodexSessionsOptions> {
    if (typeof options === 'number') {
        return {
            limit: options,
            offset: 0,
            titleQuery: '',
            cwdQuery: '',
            directoriesLimit: DEFAULT_DIRECTORIES_LIMIT
        };
    }

    return {
        limit: options.limit ?? DEFAULT_LIMIT,
        offset: Math.max(0, options.offset ?? 0),
        titleQuery: normalizeQuery(options.titleQuery),
        cwdQuery: normalizeQuery(options.cwdQuery),
        directoriesLimit: options.directoriesLimit ?? DEFAULT_DIRECTORIES_LIMIT
    };
}

function normalizeQuery(value: string | undefined): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function matchesSearch(session: ImportableCodexSession, options: Required<ListCodexSessionsOptions>): boolean {
    if (options.titleQuery && !session.title.toLowerCase().includes(options.titleQuery)) {
        return false;
    }

    if (options.cwdQuery && !session.cwd.toLowerCase().includes(options.cwdQuery)) {
        return false;
    }

    return true;
}

function collectDirectorySuggestions(
    sessions: ImportableCodexSession[],
    limit: number
): string[] {
    const uniqueLeafDirectories = Array.from(new Set(sessions.map((session) => session.cwd)));
    const ancestorCounts = new Map<string, number>();

    for (const directory of uniqueLeafDirectories) {
        let current = dirname(directory);
        while (current && current !== directory) {
            ancestorCounts.set(current, (ancestorCounts.get(current) ?? 0) + 1);
            const parent = dirname(current);
            if (!parent || parent === current) {
                break;
            }
            current = parent;
        }
    }

    const seen = new Set<string>();
    const results: string[] = [];

    for (const session of sessions) {
        const directories = [session.cwd, ...collectUsefulAncestors(session.cwd, ancestorCounts)];
        for (const current of directories) {
            if (!current || seen.has(current)) {
                continue;
            }

            seen.add(current);
            results.push(current);
            if (results.length >= limit) {
                return results;
            }
        }
    }

    return results;
}

function collectUsefulAncestors(
    directory: string,
    ancestorCounts: Map<string, number>
): string[] {
    const results: string[] = [];
    let current = dirname(directory);

    while (current && current !== directory) {
        if (shouldIncludeAncestor(current, ancestorCounts)) {
            results.push(current);
        }

        const parent = dirname(current);
        if (!parent || parent === current) {
            break;
        }
        current = parent;
    }

    return results;
}

function shouldIncludeAncestor(
    directory: string,
    ancestorCounts: Map<string, number>
): boolean {
    if ((ancestorCounts.get(directory) ?? 0) < 2) {
        return false;
    }

    return directory.split('/').filter(Boolean).length >= 2;
}

async function readSessionIndex(filePath: string): Promise<Map<string, { threadName?: string; updatedAt?: number }>> {
    const entries = new Map<string, { threadName?: string; updatedAt?: number }>();
    for await (const line of readJsonlLines(filePath)) {
        const parsed = safeParseJson(line) as SessionIndexEntry | null;
        if (!parsed || typeof parsed.id !== 'string' || !parsed.id) {
            continue;
        }

        const updatedAt = parseTimestamp(parsed.updated_at);
        const previous = entries.get(parsed.id);
        if (!previous || (updatedAt ?? 0) >= (previous.updatedAt ?? 0)) {
            entries.set(parsed.id, {
                threadName: typeof parsed.thread_name === 'string' && parsed.thread_name.trim().length > 0
                    ? parsed.thread_name.trim()
                    : previous?.threadName,
                updatedAt: updatedAt ?? previous?.updatedAt
            });
        }
    }
    return entries;
}

async function readSessionMetadata(sessionsRoot: string): Promise<Map<string, SessionMetaEntry>> {
    const files = await listSessionFiles(sessionsRoot);
    const entries = new Map<string, SessionMetaEntry>();

    for (const filePath of files) {
        const meta = await readSessionMeta(filePath);
        if (!meta) {
            continue;
        }

        const previous = entries.get(meta.id);
        if (!previous || meta.updatedAt >= previous.updatedAt) {
            entries.set(meta.id, meta);
        }
    }

    return entries;
}

async function listSessionFiles(dir: string): Promise<string[]> {
    try {
        const entries = await readdir(dir, { withFileTypes: true });
        const results: string[] = [];
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                results.push(...await listSessionFiles(fullPath));
            } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
                results.push(fullPath);
            }
        }
        return results;
    } catch {
        return [];
    }
}

async function readSessionMeta(filePath: string): Promise<SessionMetaEntry | null> {
    let fileUpdatedAt = 0;
    try {
        const fileStats = await stat(filePath);
        fileUpdatedAt = Math.floor(fileStats.mtimeMs);
    } catch {
        fileUpdatedAt = 0;
    }

    for await (const line of readJsonlLines(filePath)) {
        const parsed = safeParseJson(line) as { type?: string; payload?: Record<string, unknown> } | null;
        if (!parsed || parsed.type !== 'session_meta' || !parsed.payload || typeof parsed.payload !== 'object') {
            continue;
        }

        const id = asString(parsed.payload.id);
        const cwd = asString(parsed.payload.cwd);
        if (!id || !cwd) {
            return null;
        }

        const updatedAt = parseTimestamp(parsed.payload.timestamp) ?? fileUpdatedAt;
        const originator = asString(parsed.payload.originator) ?? undefined;
        return { id, cwd, updatedAt, originator };
    }

    return null;
}

async function* readJsonlLines(filePath: string): AsyncGenerator<string> {
    try {
        const stream = createReadStream(filePath, { encoding: 'utf8' });
        const rl = createInterface({ input: stream, crlfDelay: Infinity });

        try {
            for await (const line of rl) {
                const trimmed = line.trim();
                if (trimmed) {
                    yield trimmed;
                }
            }
        } finally {
            rl.close();
            stream.destroy();
        }
    } catch {
        return;
    }
}

function pickSessionTitle(threadName: string | undefined, cwd: string, id: string): string {
    if (threadName && threadName.trim().length > 0) {
        return threadName.trim();
    }

    const dirName = basename(cwd);
    if (dirName && dirName.trim().length > 0) {
        return dirName;
    }

    return id;
}

function parseTimestamp(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.length > 0) {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function safeParseJson(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}
