import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useAppContext } from '@/lib/app-context'
import { useAppGoBack } from '@/hooks/useAppGoBack'
import { useAdminOverview } from '@/hooks/queries/useAdminOverview'
import { useMachines } from '@/hooks/queries/useMachines'
import { useSessions } from '@/hooks/queries/useSessions'
import { useToast } from '@/lib/toast-context'
import { queryKeys } from '@/lib/query-keys'
import { LoadingState } from '@/components/LoadingState'
import { storeAccessTokenForBaseUrl } from '@/lib/accessTokenStorage'

function BackIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <polyline points="15 18 9 12 15 6" />
        </svg>
    )
}

function CopyIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
    )
}

function RefreshIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        </svg>
    )
}

function AdminCard(props: {
    title: string
    description?: string
    children: React.ReactNode
    actions?: React.ReactNode
}) {
    return (
        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--app-divider)] px-4 py-3">
                <div>
                    <div className="text-sm font-semibold text-[var(--app-fg)]">{props.title}</div>
                    {props.description ? (
                        <div className="mt-1 text-xs text-[var(--app-hint)]">{props.description}</div>
                    ) : null}
                </div>
                {props.actions ? <div className="shrink-0">{props.actions}</div> : null}
            </div>
            <div className="px-4 py-3">{props.children}</div>
        </section>
    )
}

function StatTile(props: {
    label: string
    value: string
    hint?: string
}) {
    return (
        <div className="rounded-xl border border-[var(--app-divider)] bg-[var(--app-subtle-bg)] px-3 py-3">
            <div className="text-xs text-[var(--app-hint)]">{props.label}</div>
            <div className="mt-1 text-xl font-semibold text-[var(--app-fg)]">{props.value}</div>
            {props.hint ? <div className="mt-1 text-xs text-[var(--app-hint)]">{props.hint}</div> : null}
        </div>
    )
}

function UrlRow(props: {
    label: string
    value: string
    onCopy: (value: string, label: string) => void
}) {
    return (
        <div className="flex items-start gap-3 rounded-xl border border-[var(--app-divider)] px-3 py-3">
            <div className="min-w-0 flex-1">
                <div className="text-xs text-[var(--app-hint)]">{props.label}</div>
                <div className="mt-1 break-all text-sm text-[var(--app-fg)]">{props.value}</div>
            </div>
            <button
                type="button"
                onClick={() => props.onCopy(props.value, props.label)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]"
                title={`Copy ${props.label}`}
            >
                <CopyIcon />
            </button>
        </div>
    )
}

export default function AdminPage() {
    const { api, baseUrl, authSourceType, setBrowserAccessToken } = useAppContext()
    const goBack = useAppGoBack()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { addToast } = useToast()
    const { overview, isLoading, error, refetch } = useAdminOverview(api)
    const {
        machines,
        isLoading: machinesLoading,
        error: machinesError,
    } = useMachines(api, true)
    const {
        sessions,
        isLoading: sessionsLoading,
        error: sessionsError,
    } = useSessions(api)
    const [showToken, setShowToken] = useState(false)

    const rotateTokenMutation = useMutation({
        mutationFn: async () => {
            if (!api) {
                throw new Error('API unavailable')
            }
            return await api.rotateCliApiToken()
        },
        onSuccess: async (result) => {
            if (authSourceType === 'accessToken' && setBrowserAccessToken) {
                setBrowserAccessToken(result.token.value)
            } else {
                storeAccessTokenForBaseUrl(baseUrl, result.token.value)
            }
            await queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview })
            addToast({
                title: 'Access token rotated',
                body: 'The new token has been saved for this browser. Update any old external links as needed.',
                sessionId: '',
                url: ''
            })
        }
    })

    const recentSessions = useMemo(() => sessions.slice(0, 8), [sessions])
    const activeSessions = sessions.filter((session) => session.active).length
    const importedSessions = sessions.filter((session) => session.metadata?.sessionOrigin === 'imported').length
    const onlineMachines = machines.filter((machine) => machine.active).length
    const runnerMachines = machines.filter((machine) => Boolean(machine.runnerState?.pid)).length

    const copyText = async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value)
            addToast({
                title: `${label} copied`,
                body: value,
                sessionId: '',
                url: ''
            })
        } catch (copyError) {
            addToast({
                title: `Failed to copy ${label}`,
                body: copyError instanceof Error ? copyError.message : 'Clipboard is unavailable.',
                sessionId: '',
                url: ''
            })
        }
    }

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--app-bg)]">
            <div className="border-b border-[var(--app-border)] bg-[var(--app-bg)] pt-[env(safe-area-inset-top)]">
                <div className="mx-auto flex w-full max-w-content items-center gap-2 px-3 py-3">
                    <button
                        type="button"
                        onClick={goBack}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]"
                    >
                        <BackIcon />
                    </button>
                    <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[var(--app-fg)]">Admin & Diagnose</div>
                        <div className="text-xs text-[var(--app-hint)]">Manage sessions, connection entrypoints, and self-host diagnostics.</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => void refetch()}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-fg)] transition-colors hover:bg-[var(--app-subtle-bg)]"
                    >
                        <RefreshIcon />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    {isLoading ? (
                        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-10">
                            <LoadingState label="Loading admin overview…" className="text-sm" />
                        </div>
                    ) : null}

                    {error ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <StatTile label="Sessions" value={`${sessions.length}`} hint={`${activeSessions} active`} />
                        <StatTile label="Imported from Codex" value={`${importedSessions}`} hint="Desktop / CLI resumes" />
                        <StatTile label="Machines online" value={`${onlineMachines}`} hint={`${runnerMachines} runner registered`} />
                        <StatTile
                            label="Current hub"
                            value={baseUrl.replace(/^https?:\/\//, '')}
                            hint={overview?.config.publicUrl ? 'Public URL configured' : 'Using direct access'}
                        />
                    </div>

                    <AdminCard
                        title="Access"
                        description="Primary remote path should be Tailscale. Public URL stays available as a fallback."
                    >
                        <div className="space-y-3">
                            <UrlRow label="Current hub" value={baseUrl} onCopy={copyText} />
                            {overview?.access.publicUrl ? (
                                <UrlRow label="Public URL" value={overview.access.publicUrl} onCopy={copyText} />
                            ) : null}
                            {overview?.access.localUrls.map((url) => (
                                <UrlRow key={url} label="Local URL" value={url} onCopy={copyText} />
                            ))}
                            {overview?.access.tailscale.urls.map((url) => (
                                <UrlRow key={url} label="Tailscale URL" value={url} onCopy={copyText} />
                            ))}
                            {!overview?.access.tailscale.installed ? (
                                <div className="rounded-xl border border-[var(--app-divider)] px-3 py-3 text-sm text-[var(--app-hint)]">
                                    Tailscale CLI is not installed on this machine yet.
                                </div>
                            ) : null}
                            {overview?.access.tailscale.installed && !overview.access.tailscale.running ? (
                                <div className="rounded-xl border border-[var(--app-divider)] px-3 py-3 text-sm text-[var(--app-hint)]">
                                    Tailscale is installed but not connected{overview.access.tailscale.backendState ? ` (${overview.access.tailscale.backendState})` : ''}.
                                    {overview.access.tailscale.error ? ` ${overview.access.tailscale.error}` : ''}
                                </div>
                            ) : null}
                        </div>
                    </AdminCard>

                    <AdminCard
                        title="Access Token"
                        description="Use this token for browser or PWA login. Rotating it will invalidate old direct-access links."
                        actions={overview?.token.canRotate ? (
                            <button
                                type="button"
                                onClick={() => void rotateTokenMutation.mutateAsync()}
                                disabled={rotateTokenMutation.isPending}
                                className="rounded-full border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-fg)] transition-colors hover:bg-[var(--app-subtle-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {rotateTokenMutation.isPending ? 'Rotating…' : 'Rotate'}
                            </button>
                        ) : null}
                    >
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--app-hint)]">
                                <span>Source: {overview?.token.source ?? 'unknown'}</span>
                                {overview?.token.canRotate ? null : (
                                    <span>{overview?.token.reason}</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type={showToken ? 'text' : 'password'}
                                    readOnly
                                    value={overview?.token.value ?? ''}
                                    className="min-w-0 flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowToken((value) => !value)}
                                    className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] transition-colors hover:bg-[var(--app-subtle-bg)]"
                                >
                                    {showToken ? 'Hide' : 'Show'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void copyText(overview?.token.value ?? '', 'Access token')}
                                    className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] transition-colors hover:bg-[var(--app-subtle-bg)]"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>
                    </AdminCard>

                    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                        <AdminCard title="Recent Sessions" description="Quick overview of active, archived, and imported conversations.">
                            {sessionsLoading ? (
                                <LoadingState label="Loading sessions…" className="text-sm" />
                            ) : sessionsError ? (
                                <div className="text-sm text-red-600">{sessionsError}</div>
                            ) : recentSessions.length === 0 ? (
                                <div className="text-sm text-[var(--app-hint)]">No sessions yet.</div>
                            ) : (
                                <div className="space-y-2">
                                    {recentSessions.map((session) => {
                                        const label = session.metadata?.name
                                            || session.metadata?.summary?.text
                                            || session.metadata?.path
                                            || session.id
                                        const hint = [
                                            session.active ? 'active' : 'archived',
                                            session.metadata?.sessionOrigin === 'imported' ? `imported from ${session.metadata.importedFrom ?? 'Codex'}` : 'spawned in HAPI',
                                        ].join(' · ')
                                        return (
                                            <button
                                                key={session.id}
                                                type="button"
                                                onClick={() => navigate({
                                                    to: '/sessions/$sessionId',
                                                    params: { sessionId: session.id },
                                                })}
                                                className="flex w-full items-start justify-between gap-3 rounded-xl border border-[var(--app-divider)] px-3 py-3 text-left transition-colors hover:bg-[var(--app-subtle-bg)]"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-sm font-medium text-[var(--app-fg)]">{label}</div>
                                                    <div className="mt-1 text-xs text-[var(--app-hint)]">{hint}</div>
                                                </div>
                                                <div className="text-xs text-[var(--app-hint)]">
                                                    {new Date(session.updatedAt).toLocaleString()}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </AdminCard>

                        <AdminCard title="Machines & Runtime" description="Hub status, runner connections, and local config paths.">
                            <div className="space-y-3">
                                {machinesLoading ? (
                                    <LoadingState label="Loading machines…" className="text-sm" />
                                ) : machinesError ? (
                                    <div className="text-sm text-red-600">{machinesError}</div>
                                ) : machines.length === 0 ? (
                                    <div className="rounded-xl border border-[var(--app-divider)] px-3 py-3 text-sm text-[var(--app-hint)]">
                                        No runner is connected right now.
                                    </div>
                                ) : (
                                    machines.map((machine) => (
                                        <div key={machine.id} className="rounded-xl border border-[var(--app-divider)] px-3 py-3">
                                            <div className="text-sm font-medium text-[var(--app-fg)]">
                                                {machine.metadata?.displayName || machine.metadata?.host || machine.id}
                                            </div>
                                            <div className="mt-1 text-xs text-[var(--app-hint)]">
                                                {machine.active ? 'online' : 'offline'} · {machine.metadata?.platform ?? 'unknown platform'} · version {machine.metadata?.happyCliVersion ?? 'unknown'}
                                            </div>
                                            {machine.runnerState?.pid ? (
                                                <div className="mt-1 text-xs text-[var(--app-hint)]">
                                                    runner pid {machine.runnerState.pid}
                                                    {machine.runnerState.httpPort ? ` · port ${machine.runnerState.httpPort}` : ''}
                                                </div>
                                            ) : null}
                                        </div>
                                    ))
                                )}

                                {overview ? (
                                    <div className="rounded-xl border border-[var(--app-divider)] px-3 py-3 text-xs text-[var(--app-hint)]">
                                        <div>Listen: {overview.config.listenHost}:{overview.config.listenPort}</div>
                                        <div className="mt-1 break-all">Settings: {overview.config.settingsFile}</div>
                                        <div className="mt-1 break-all">Data: {overview.config.dataDir}</div>
                                        <div className="mt-1 break-all">Database: {overview.config.dbPath}</div>
                                        <div className="mt-1 break-all">CORS: {overview.config.corsOrigins.join(', ') || 'none'}</div>
                                    </div>
                                ) : null}
                            </div>
                        </AdminCard>
                    </div>
                </div>
            </div>
        </div>
    )
}
