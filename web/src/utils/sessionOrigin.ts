import type { Session, SessionSummary } from '@/types/api'

type SessionMetadataLike = Session['metadata'] | SessionSummary['metadata'] | null | undefined

export function isImportedSession(metadata: SessionMetadataLike): boolean {
    return metadata?.sessionOrigin === 'imported'
}

export function formatImportedFrom(metadata: SessionMetadataLike): string | null {
    const value = metadata?.importedFrom?.trim()
    if (!value) {
        return null
    }

    const normalized = value.toLowerCase()
    if (normalized === 'codex desktop') {
        return 'Codex Desktop'
    }
    if (normalized === 'codex cli' || normalized === 'codex-tui') {
        return 'Codex CLI'
    }
    return value
}
