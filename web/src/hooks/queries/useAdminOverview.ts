import { useQuery } from '@tanstack/react-query'
import type { ApiClient } from '@/api/client'
import type { AdminOverview } from '@/types/api'
import { queryKeys } from '@/lib/query-keys'

export function useAdminOverview(api: ApiClient | null): {
    overview: AdminOverview | null
    isLoading: boolean
    error: string | null
    refetch: () => Promise<unknown>
} {
    const query = useQuery({
        queryKey: queryKeys.adminOverview,
        queryFn: async () => {
            if (!api) {
                throw new Error('API unavailable')
            }
            return await api.getAdminOverview()
        },
        enabled: Boolean(api),
    })

    return {
        overview: query.data?.overview ?? null,
        isLoading: query.isLoading,
        error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to load admin overview' : null,
        refetch: query.refetch,
    }
}
