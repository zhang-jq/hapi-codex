import { useQuery } from '@tanstack/react-query'
import type { ApiClient } from '@/api/client'
import type { ImportableSession } from '@/types/api'
import { queryKeys } from '@/lib/query-keys'

export function useImportableSessions(
    api: ApiClient,
    machineId: string | null,
    agent: 'codex' | 'claude' | 'cursor' | 'gemini' | 'opencode',
    filters?: {
        limit?: number
        offset?: number
        titleQuery?: string
        cwdQuery?: string
    }
): {
    sessions: ImportableSession[]
    directories: string[]
    page: {
        limit: number
        offset: number
        total: number
        hasMore: boolean
    }
    isLoading: boolean
    isRefreshing: boolean
    error: string | null
    refetch: () => void
} {
    const titleQuery = filters?.titleQuery?.trim() || undefined
    const cwdQuery = filters?.cwdQuery?.trim() || undefined
    const limit = filters?.limit ?? 10
    const offset = filters?.offset ?? 0

    const query = useQuery({
        queryKey: machineId
            ? queryKeys.importableSessions(machineId, 'codex', { titleQuery, cwdQuery, limit, offset })
            : ['importable-sessions', 'disabled'],
        enabled: Boolean(machineId && agent === 'codex'),
        queryFn: async () => {
            if (!machineId) {
                return {
                    sessions: [],
                    directories: [],
                    page: {
                        limit,
                        offset,
                        total: 0,
                        hasMore: false
                    }
                }
            }
            return await api.getImportableSessions(machineId, 'codex', {
                limit,
                offset,
                titleQuery,
                cwdQuery
            })
        },
        placeholderData: (previousData) => previousData,
        staleTime: 30_000
    })

    return {
        sessions: query.data?.sessions ?? [],
        directories: query.data?.directories ?? [],
        page: query.data?.page ?? {
            limit,
            offset,
            total: 0,
            hasMore: false
        },
        isLoading: query.isLoading && !query.data,
        isRefreshing: query.isFetching && Boolean(query.data),
        error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to load sessions' : null,
        refetch: () => {
            void query.refetch()
        }
    }
}
