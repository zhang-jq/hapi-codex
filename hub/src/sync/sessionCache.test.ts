import { describe, expect, it } from 'bun:test'
import { Store } from '../store'
import type { EventPublisher } from './eventPublisher'
import { SessionCache } from './sessionCache'

function createPublisher() {
    return {
        emit() {
            // no-op
        }
    } as unknown as EventPublisher
}

describe('SessionCache.mergeSessions', () => {
    it('preserves imported Codex session metadata when wrappers merge', async () => {
        const store = new Store(':memory:')
        const cache = new SessionCache(store, createPublisher())

        const oldSession = cache.getOrCreateSession(
            'old-wrapper',
            {
                path: '/tmp/project',
                host: 'localhost',
                codexSessionId: 'codex-session-1',
                sessionOrigin: 'imported',
                importedFrom: 'Codex Desktop',
                importedAt: 1_710_000_000_000
            },
            { requests: {}, completedRequests: {} },
            'default'
        )

        const newSession = cache.getOrCreateSession(
            'new-wrapper',
            {
                path: '/tmp/project',
                host: 'localhost',
                codexSessionId: 'codex-session-1'
            },
            { requests: {}, completedRequests: {} },
            'default'
        )

        await cache.mergeSessions(oldSession.id, newSession.id, 'default')

        const merged = cache.getSession(newSession.id)
        expect(merged).toBeDefined()
        expect(merged?.metadata).toEqual(expect.objectContaining({
            codexSessionId: 'codex-session-1',
            sessionOrigin: 'imported',
            importedFrom: 'Codex Desktop',
            importedAt: 1_710_000_000_000
        }))
        expect(cache.getSession(oldSession.id)).toBeUndefined()
    })
})
