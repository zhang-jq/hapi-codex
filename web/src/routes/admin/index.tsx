import { useEffect, useMemo, useState } from 'react'
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
import type { AdminAccessMode } from '@/types/api'

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

function StatusBadge(props: {
    ok: boolean
    label: string
}) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                props.ok
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
            }`}
        >
            {props.label}
        </span>
    )
}

function ModeButton(props: {
    label: string
    active: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={props.onClick}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                props.active
                    ? 'bg-[var(--app-link)] text-white'
                    : 'border border-[var(--app-border)] text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]'
            }`}
        >
            {props.label}
        </button>
    )
}

function PolicyToggleCard(props: {
    mode: AdminAccessMode
    enabled: boolean
    preferred: boolean
    canDisable: boolean
    onToggle: () => void
    onSetPreferred: () => void
}) {
    return (
        <div className="rounded-xl border border-[var(--app-divider)] px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[var(--app-fg)]">{ACCESS_MODE_LABELS[props.mode]}</div>
                    <div className="mt-1 text-xs text-[var(--app-hint)]">{ACCESS_MODE_HINTS[props.mode]}</div>
                </div>
                <button
                    type="button"
                    onClick={props.onToggle}
                    disabled={props.enabled && !props.canDisable}
                    className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                        props.enabled
                            ? 'bg-[var(--app-link)] text-white'
                            : 'border border-[var(--app-border)] text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]'
                    } ${props.enabled && !props.canDisable ? 'opacity-70' : ''}`}
                >
                    {props.enabled ? 'Enabled' : 'Disabled'}
                </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-xs text-[var(--app-hint)]">
                    {props.enabled
                        ? (props.preferred
                            ? 'This is the default mode shown to users first.'
                            : 'Enabled, but not the default recommendation.')
                        : 'Disabled modes stay visible for admin diagnostics, but disappear from the teammate guide.'}
                </div>
                <button
                    type="button"
                    onClick={props.onSetPreferred}
                    disabled={!props.enabled || props.preferred}
                    className="rounded-full border border-[var(--app-border)] px-3 py-1.5 text-xs text-[var(--app-fg)] transition-colors hover:bg-[var(--app-subtle-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {props.preferred ? 'Default' : 'Set default'}
                </button>
            </div>
        </div>
    )
}

function SnippetBlock(props: {
    title: string
    code: string
    onCopy: (value: string, label: string) => void
}) {
    return (
        <div className="rounded-xl border border-[var(--app-divider)]">
            <div className="flex items-center justify-between border-b border-[var(--app-divider)] px-3 py-2">
                <div className="text-xs font-medium text-[var(--app-hint)]">{props.title}</div>
                <button
                    type="button"
                    onClick={() => props.onCopy(props.code, props.title)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]"
                    title={`Copy ${props.title}`}
                >
                    <CopyIcon />
                </button>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words px-3 py-3 text-xs text-[var(--app-fg)]">{props.code}</pre>
        </div>
    )
}

type TroubleshootingLevel = 'good' | 'warning' | 'critical'
const ACCESS_MODES: AdminAccessMode[] = ['local', 'tailscale', 'public']

const ACCESS_MODE_LABELS: Record<AdminAccessMode, string> = {
    local: 'Local / LAN',
    tailscale: 'Tailscale',
    public: 'Public / VPS',
}

const ACCESS_MODE_HINTS: Record<AdminAccessMode, string> = {
    local: 'Same machine or same LAN only.',
    tailscale: 'Recommended private remote access for teammates in the same tailnet.',
    public: 'Use your own server or public reverse proxy as a fallback.',
}

function getHostFromUrl(url: string): string {
    try {
        return new URL(url).hostname
    } catch {
        return url.replace(/^https?:\/\//, '').split('/')[0] ?? url
    }
}

function isIpLikeHost(host: string): boolean {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')
}

function TroubleshootingCard(props: {
    level: TroubleshootingLevel
    title: string
    body: string
}) {
    const tone = props.level === 'good'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : props.level === 'critical'
            ? 'border-red-200 bg-red-50 text-red-800'
            : 'border-amber-200 bg-amber-50 text-amber-800'

    return (
        <div className={`rounded-xl border px-3 py-3 ${tone}`}>
            <div className="text-sm font-medium">{props.title}</div>
            <div className="mt-1 text-sm">{props.body}</div>
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
    const [selectedMode, setSelectedMode] = useState<AdminAccessMode>('local')
    const [draftEnabledModes, setDraftEnabledModes] = useState<AdminAccessMode[]>(ACCESS_MODES)
    const [draftPreferredMode, setDraftPreferredMode] = useState<AdminAccessMode>('tailscale')

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

    const updateAccessPolicyMutation = useMutation({
        mutationFn: async () => {
            if (!api) {
                throw new Error('API unavailable')
            }
            return await api.updateAccessPolicy({
                enabledModes: draftEnabledModes,
                preferredMode: draftPreferredMode,
            })
        },
        onSuccess: async (result) => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview })
            addToast({
                title: 'Access policy saved',
                body: `Enabled: ${result.accessPolicy.enabledModes.map((mode) => ACCESS_MODE_LABELS[mode]).join(', ')} · Default: ${ACCESS_MODE_LABELS[result.accessPolicy.preferredMode]}`,
                sessionId: '',
                url: ''
            })
        },
        onError: (mutationError) => {
            addToast({
                title: 'Failed to save access policy',
                body: mutationError instanceof Error ? mutationError.message : 'Unknown error',
                sessionId: '',
                url: ''
            })
        },
    })

    const recentSessions = useMemo(() => sessions.slice(0, 8), [sessions])
    const activeSessions = sessions.filter((session) => session.active).length
    const importedSessions = sessions.filter((session) => session.metadata?.sessionOrigin === 'imported').length
    const onlineMachines = machines.filter((machine) => machine.active).length
    const runnerMachines = machines.filter((machine) => Boolean(machine.runnerState?.pid)).length

    useEffect(() => {
        if (!overview) {
            return
        }
        setDraftEnabledModes(overview.access.policy.enabledModes)
        setDraftPreferredMode(overview.access.policy.preferredMode)
    }, [overview])

    const enabledGuideModes = overview?.access.policy.enabledModes ?? ACCESS_MODES
    const configuredPreferredMode = overview?.access.policy.preferredMode ?? 'tailscale'

    const defaultGuideMode = useMemo<AdminAccessMode>(() => {
        if (enabledGuideModes.includes(configuredPreferredMode)) {
            return configuredPreferredMode
        }
        return enabledGuideModes[0] ?? 'local'
    }, [configuredPreferredMode, enabledGuideModes])

    useEffect(() => {
        setSelectedMode((currentMode) => {
            if (!enabledGuideModes.includes(currentMode)) {
                return defaultGuideMode
            }
            return currentMode || defaultGuideMode
        })
    }, [defaultGuideMode, enabledGuideModes])

    const draftPolicyIsDirty = useMemo(() => {
        if (!overview) {
            return false
        }

        if (draftPreferredMode !== overview.access.policy.preferredMode) {
            return true
        }

        if (draftEnabledModes.length !== overview.access.policy.enabledModes.length) {
            return true
        }

        return draftEnabledModes.some((mode, index) => mode !== overview.access.policy.enabledModes[index])
    }, [draftEnabledModes, draftPreferredMode, overview])

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

    const buildLoginLink = (entryUrl: string): string => {
        const normalized = entryUrl.replace(/\/+$/, '')
        return `${normalized}/?token=${encodeURIComponent(overview?.token.value ?? '')}`
    }

    const toggleDraftMode = (mode: AdminAccessMode) => {
        if (draftEnabledModes.includes(mode)) {
            if (draftEnabledModes.length === 1) {
                addToast({
                    title: 'Keep one access mode enabled',
                    body: 'At least one access path must stay available for users.',
                    sessionId: '',
                    url: ''
                })
                return
            }

            const nextModes = ACCESS_MODES.filter(
                (candidate) => candidate !== mode && draftEnabledModes.includes(candidate)
            )
            setDraftEnabledModes(nextModes)
            if (!nextModes.includes(draftPreferredMode)) {
                setDraftPreferredMode(nextModes[0]!)
            }
            return
        }

        setDraftEnabledModes(
            ACCESS_MODES.filter(
                (candidate) => candidate === mode || draftEnabledModes.includes(candidate)
            )
        )
    }

    const publicHost = useMemo(() => {
        if (!overview?.access.publicUrl) {
            return 'your-hapi.example.com'
        }
        return getHostFromUrl(overview.access.publicUrl)
    }, [overview?.access.publicUrl])
    const publicUsesDomain = !isIpLikeHost(publicHost)

    const vpsTunnelSnippet = useMemo(() => {
        return `ssh -NT -R 127.0.0.1:13006:127.0.0.1:${overview?.config.listenPort ?? 3006} user@${publicHost}`
    }, [overview?.config.listenPort, publicHost])

    const vpsNginxSnippet = useMemo(() => {
        return `server {
    listen 80;
    server_name ${publicHost};

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:13006;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_request_buffering off;
    }
}`
    }, [publicHost])

    const httpsNginxSnippet = useMemo(() => {
        return `server {
    listen 80;
    server_name ${publicHost};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${publicHost};

    ssl_certificate /etc/letsencrypt/live/${publicHost}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${publicHost}/privkey.pem;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:13006;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_request_buffering off;
    }
}

# Then issue the certificate once DNS already points here:
# certbot --nginx -d ${publicHost}`
    }, [publicHost])

    const hubEnvSnippet = useMemo(() => {
        const preferredPublicUrl = overview?.access.publicUrl
            ? overview.access.publicUrl
            : publicUsesDomain
                ? `https://${publicHost}`
                : `http://${publicHost}`
        return `HAPI_LISTEN_HOST=0.0.0.0
HAPI_LISTEN_PORT=${overview?.config.listenPort ?? 3006}
HAPI_PUBLIC_URL=${preferredPublicUrl}`
    }, [overview?.access.publicUrl, overview?.config.listenPort, publicHost, publicUsesDomain])

    const localLoginLink = overview?.access.localUrls[0]
        ? buildLoginLink(overview.access.localUrls[0])
        : ''
    const tailscaleLoginLink = overview?.access.tailscale.urls[0]
        ? buildLoginLink(overview.access.tailscale.urls[0])
        : ''
    const publicLoginLink = overview?.access.publicUrl
        ? buildLoginLink(overview.access.publicUrl)
        : ''

    const accessModeContent = useMemo(() => {
        if (!overview) {
            return null
        }

        if (selectedMode === 'tailscale') {
            return {
                summary: 'Recommended for teammates inside the same tailnet. No VPS is required and the route is usually the most stable.',
                health: overview.access.tailscale.health,
                link: tailscaleLoginLink,
                steps: [
                    'Install Tailscale on the Mac running hapi-codex and on the teammate device.',
                    'Sign both devices into the same tailnet.',
                    'Open the generated login link below or add it to the teammate browser/PWA.',
                    'If access fails, check the Tailscale status card above first.',
                ],
                shareSnippet: `Open this hapi-codex link while connected to the same Tailscale tailnet:\n${tailscaleLoginLink}\n\nIf the page does not open, confirm Tailscale is connected on both devices first.`,
                snippets: [] as { title: string; code: string }[],
            }
        }

        if (selectedMode === 'public') {
            return {
                summary: 'Use this when teammates are outside your tailnet. This page does not SSH into the server for you; it generates the template your teammate can follow.',
                health: overview.access.publicHealth,
                link: publicLoginLink,
                steps: [
                    'Keep the hub listening locally on this Mac.',
                    'Expose the hub to the VPS with a reverse tunnel or another private upstream.',
                    'Put nginx (or another proxy) in front of that upstream and point the public URL at it.',
                    'Verify the public URL health result turns green before sharing the login link.',
                ],
                shareSnippet: `Open this public hapi-codex link:\n${publicLoginLink}\n\nIf it fails, ask the server owner to check the public health status in Admin & Diagnose.`,
                snippets: [
                    { title: 'Hub Environment', code: hubEnvSnippet },
                    { title: 'Reverse SSH Tunnel', code: vpsTunnelSnippet },
                    { title: 'nginx Template', code: vpsNginxSnippet },
                    ...(publicUsesDomain ? [{ title: 'nginx HTTPS Template', code: httpsNginxSnippet }] : []),
                ],
            }
        }

        return {
            summary: 'Best for the same LAN or direct testing on this machine.',
            health: null,
            link: localLoginLink,
            steps: [
                'Keep the hub and runner running on this Mac.',
                'Share the LAN URL with the teammate if they are on the same network.',
                'Use the generated login link so they do not need to type the token manually.',
            ],
            shareSnippet: `Open this local hapi-codex link while on the same network:\n${localLoginLink}`,
            snippets: [] as { title: string; code: string }[],
        }
    }, [
        hubEnvSnippet,
        httpsNginxSnippet,
        localLoginLink,
        overview,
        publicLoginLink,
        publicUsesDomain,
        selectedMode,
        tailscaleLoginLink,
        vpsNginxSnippet,
        vpsTunnelSnippet,
    ])

    const troubleshootingItems = useMemo(() => {
        const items: Array<{ level: TroubleshootingLevel; title: string; body: string }> = []
        const publicModeEnabled = overview?.access.policy.enabledModes.includes('public') ?? true
        const tailscaleModeEnabled = overview?.access.policy.enabledModes.includes('tailscale') ?? true

        if (onlineMachines === 0) {
            items.push({
                level: 'critical',
                title: 'No runner is connected',
                body: 'The hub is up, but no machine is registered. Start or restart the runner on the machine that should execute Codex sessions.',
            })
        }

        if (tailscaleModeEnabled && overview?.access.tailscale.installed && !overview.access.tailscale.running) {
            items.push({
                level: 'warning',
                title: 'Tailscale is installed but not connected',
                body: `Reconnect Tailscale first${overview.access.tailscale.backendState ? ` (${overview.access.tailscale.backendState})` : ''}. Until then, teammates outside the LAN should use the public path instead.`,
            })
        }

        if (tailscaleModeEnabled && !overview?.access.tailscale.installed) {
            items.push({
                level: 'warning',
                title: 'Tailscale is not installed',
                body: 'If you want the recommended teammate workflow, install Tailscale on this Mac and the teammate device so they can connect without a VPS.',
            })
        }

        if (publicModeEnabled && overview?.access.publicUrl && overview.access.publicHealth && !overview.access.publicHealth.ok) {
            const httpHint = overview.access.publicHealth.status === 502
                ? 'This usually means the reverse proxy is reachable but its upstream tunnel is down or misconfigured.'
                : 'The public URL is not healthy right now.'
            items.push({
                level: 'critical',
                title: 'Public URL is unhealthy',
                body: `${httpHint} Check the reverse SSH tunnel, nginx upstream, and server logs before sharing the public link.`,
            })
        }

        if (publicModeEnabled && overview?.access.publicUrl && !publicUsesDomain) {
            items.push({
                level: 'warning',
                title: 'Public URL is using an IP address',
                body: 'That works for plain HTTP, but HTTPS and certificates are much easier once you move this to a real domain name.',
            })
        }

        if (items.length === 0) {
            items.push({
                level: 'good',
                title: 'Main access paths look healthy',
                body: 'At least one remote path is ready. You can now share the generated login link with a teammate.',
            })
        }

        return items
    }, [onlineMachines, overview, publicUsesDomain])

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
                        description="Detected entrypoints, runtime health, and URLs you can still use for diagnostics."
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
                            {overview?.access.publicUrl && overview.access.publicHealth ? (
                                <div className="flex items-center justify-between rounded-xl border border-[var(--app-divider)] px-3 py-3">
                                    <div>
                                        <div className="text-sm text-[var(--app-fg)]">Public URL health</div>
                                        <div className="mt-1 text-xs text-[var(--app-hint)]">{overview.access.publicHealth.message}</div>
                                    </div>
                                    <StatusBadge
                                        ok={overview.access.publicHealth.ok}
                                        label={overview.access.publicHealth.ok ? 'Healthy' : 'Needs attention'}
                                    />
                                </div>
                            ) : null}
                            {overview?.access.tailscale.health ? (
                                <div className="flex items-center justify-between rounded-xl border border-[var(--app-divider)] px-3 py-3">
                                    <div>
                                        <div className="text-sm text-[var(--app-fg)]">Tailscale health</div>
                                        <div className="mt-1 text-xs text-[var(--app-hint)]">{overview.access.tailscale.health.message}</div>
                                    </div>
                                    <StatusBadge
                                        ok={overview.access.tailscale.health.ok}
                                        label={overview.access.tailscale.health.ok ? 'Healthy' : 'Needs attention'}
                                    />
                                </div>
                            ) : null}
                        </div>
                    </AdminCard>

                    <AdminCard
                        title="Access Policy"
                        description="Choose which schemes users should see in the connection guide, and which one is recommended by default."
                        actions={(
                            <button
                                type="button"
                                onClick={() => void updateAccessPolicyMutation.mutateAsync()}
                                disabled={!draftPolicyIsDirty || updateAccessPolicyMutation.isPending}
                                className="rounded-full border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-fg)] transition-colors hover:bg-[var(--app-subtle-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {updateAccessPolicyMutation.isPending ? 'Saving…' : 'Save'}
                            </button>
                        )}
                    >
                        <div className="space-y-3">
                            {ACCESS_MODES.map((mode) => (
                                <PolicyToggleCard
                                    key={mode}
                                    mode={mode}
                                    enabled={draftEnabledModes.includes(mode)}
                                    preferred={draftPreferredMode === mode}
                                    canDisable={draftEnabledModes.length > 1}
                                    onToggle={() => toggleDraftMode(mode)}
                                    onSetPreferred={() => setDraftPreferredMode(mode)}
                                />
                            ))}
                            <div className="rounded-xl border border-[var(--app-divider)] px-3 py-3 text-xs text-[var(--app-hint)]">
                                Enabled modes: {draftEnabledModes.map((mode) => ACCESS_MODE_LABELS[mode]).join(', ')}.
                                {' '}Default recommendation: {ACCESS_MODE_LABELS[draftPreferredMode]}.
                            </div>
                        </div>
                    </AdminCard>

                    <AdminCard
                        title="Connection Guide"
                        description="Use this to onboard another teammate. Pick the access mode first, then copy the generated login link or server template."
                    >
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {enabledGuideModes.map((mode) => (
                                    <ModeButton
                                        key={mode}
                                        label={ACCESS_MODE_LABELS[mode]}
                                        active={selectedMode === mode}
                                        onClick={() => setSelectedMode(mode)}
                                    />
                                ))}
                            </div>

                            {accessModeContent ? (
                                <div className="space-y-3">
                                    <div className="rounded-xl border border-[var(--app-divider)] px-3 py-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="text-sm font-medium text-[var(--app-fg)]">
                                                {selectedMode === configuredPreferredMode ? 'Current default recommendation' : 'Current mode'}
                                            </div>
                                            {accessModeContent.health ? (
                                                <StatusBadge
                                                    ok={accessModeContent.health.ok}
                                                    label={accessModeContent.health.ok ? 'Healthy' : 'Check setup'}
                                                />
                                            ) : null}
                                        </div>
                                        <div className="mt-2 text-sm text-[var(--app-hint)]">{accessModeContent.summary}</div>
                                    </div>

                                    {accessModeContent.link ? (
                                        <UrlRow
                                            label="Teammate login link"
                                            value={accessModeContent.link}
                                            onCopy={copyText}
                                        />
                                    ) : (
                                        <div className="rounded-xl border border-[var(--app-divider)] px-3 py-3 text-sm text-[var(--app-hint)]">
                                            No login link is available for this mode yet.
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-[var(--app-divider)] px-3 py-3">
                                        <div className="text-sm font-medium text-[var(--app-fg)]">How to use this mode</div>
                                        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-[var(--app-hint)]">
                                            {accessModeContent.steps.map((step) => (
                                                <li key={step}>{step}</li>
                                            ))}
                                        </ol>
                                    </div>

                                    {accessModeContent.snippets.map((snippet) => (
                                        <SnippetBlock
                                            key={snippet.title}
                                            title={snippet.title}
                                            code={snippet.code}
                                            onCopy={copyText}
                                        />
                                    ))}

                                    {accessModeContent.shareSnippet ? (
                                        <SnippetBlock
                                            title="Teammate Share Message"
                                            code={accessModeContent.shareSnippet}
                                            onCopy={copyText}
                                        />
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    </AdminCard>

                    <AdminCard
                        title="Troubleshooting"
                        description="This is the first place teammates should look when the login link or remote session path does not work."
                    >
                        <div className="space-y-3">
                            {troubleshootingItems.map((item) => (
                                <TroubleshootingCard
                                    key={`${item.level}-${item.title}`}
                                    level={item.level}
                                    title={item.title}
                                    body={item.body}
                                />
                            ))}
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
