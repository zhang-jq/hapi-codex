import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useAppContext } from '@/lib/app-context'
import { useAppGoBack } from '@/hooks/useAppGoBack'
import { useAdminOverview } from '@/hooks/queries/useAdminOverview'
import { useMachines } from '@/hooks/queries/useMachines'
import { useSessions } from '@/hooks/queries/useSessions'
import { useTranslation } from '@/lib/use-translation'
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
    displayValue?: string
    hint?: string
    onCopy: (value: string, label: string) => void
}) {
    return (
        <div className="flex items-start gap-3 rounded-xl border border-[var(--app-divider)] px-3 py-3">
            <div className="min-w-0 flex-1">
                <div className="text-xs text-[var(--app-hint)]">{props.label}</div>
                <div className="mt-1 break-all text-sm text-[var(--app-fg)]">{props.displayValue ?? props.value}</div>
                {props.hint ? (
                    <div className="mt-1 text-xs text-[var(--app-hint)]">{props.hint}</div>
                ) : null}
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
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                props.active
                    ? 'border border-[var(--app-fg)] bg-[var(--app-fg)] text-[var(--app-bg)]'
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
    const { t } = useTranslation()

    return (
        <div className="rounded-xl border border-[var(--app-divider)] px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[var(--app-fg)]">{t(ACCESS_MODE_LABEL_KEYS[props.mode])}</div>
                    <div className="mt-1 text-xs text-[var(--app-hint)]">{t(ACCESS_MODE_HINT_KEYS[props.mode])}</div>
                </div>
                <button
                    type="button"
                    onClick={props.onToggle}
                    disabled={props.enabled && !props.canDisable}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                        props.enabled
                            ? 'border border-[var(--app-fg)] bg-[var(--app-fg)] text-[var(--app-bg)]'
                            : 'border border-[var(--app-border)] text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]'
                    } ${props.enabled && !props.canDisable ? 'opacity-70' : ''}`}
                >
                    {props.enabled ? t('admin.policy.enabled') : t('admin.policy.disabled')}
                </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-xs text-[var(--app-hint)]">
                    {props.enabled
                        ? (props.preferred
                            ? t('admin.policy.defaultShown')
                            : t('admin.policy.enabledButNotDefault'))
                        : t('admin.policy.hiddenFromGuide')}
                </div>
                <button
                    type="button"
                    onClick={props.onSetPreferred}
                    disabled={!props.enabled || props.preferred}
                    className="rounded-full border border-[var(--app-border)] px-3 py-1.5 text-xs text-[var(--app-fg)] transition-colors hover:bg-[var(--app-subtle-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {props.preferred ? t('admin.policy.default') : t('admin.policy.setDefault')}
                </button>
            </div>
        </div>
    )
}

function SnippetBlock(props: {
    title: string
    code: string
    displayCode?: string
    hint?: string
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
            <pre className="overflow-x-auto whitespace-pre-wrap break-words px-3 py-3 text-xs text-[var(--app-fg)]">{props.displayCode ?? props.code}</pre>
            {props.hint ? (
                <div className="border-t border-[var(--app-divider)] px-3 py-2 text-xs text-[var(--app-hint)]">{props.hint}</div>
            ) : null}
        </div>
    )
}

type TroubleshootingLevel = 'good' | 'warning' | 'critical'
const ACCESS_MODES: AdminAccessMode[] = ['local', 'tailscale', 'public']

const ACCESS_MODE_LABEL_KEYS: Record<AdminAccessMode, string> = {
    local: 'admin.mode.local.label',
    tailscale: 'admin.mode.tailscale.label',
    public: 'admin.mode.public.label',
}

const ACCESS_MODE_HINT_KEYS: Record<AdminAccessMode, string> = {
    local: 'admin.mode.local.hint',
    tailscale: 'admin.mode.tailscale.hint',
    public: 'admin.mode.public.hint',
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

function maskTokenizedUrl(value: string): string {
    try {
        const parsed = new URL(value)
        if (parsed.searchParams.has('token')) {
            parsed.searchParams.set('token', '••••hidden••••')
        }
        return parsed.toString()
    } catch {
        return value.replace(/([?&]token=)[^&\s]+/g, '$1••••hidden••••')
    }
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
    const { t } = useTranslation()
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
    const [draftPublicUrl, setDraftPublicUrl] = useState('')
    const getModeLabel = (mode: AdminAccessMode) => t(ACCESS_MODE_LABEL_KEYS[mode])

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
                title: t('admin.token.rotatedTitle'),
                body: t('admin.token.rotatedBody'),
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
                title: t('admin.policy.savedTitle'),
                body: t('admin.policy.summary', {
                    enabled: result.accessPolicy.enabledModes.map((mode) => getModeLabel(mode)).join(', '),
                    preferred: getModeLabel(result.accessPolicy.preferredMode),
                }),
                sessionId: '',
                url: ''
            })
        },
        onError: (mutationError) => {
            addToast({
                title: t('admin.policy.failedTitle'),
                body: mutationError instanceof Error ? mutationError.message : 'Unknown error',
                sessionId: '',
                url: ''
            })
        },
    })

    const updatePublicUrlMutation = useMutation({
        mutationFn: async () => {
            if (!api) {
                throw new Error('API unavailable')
            }
            return await api.updatePublicUrl({
                publicUrl: draftPublicUrl.trim() || null,
            })
        },
        onSuccess: async (result) => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview })
            addToast({
                title: t('admin.publicUrl.savedTitle'),
                body: t('admin.publicUrl.savedBody', { publicUrl: result.publicUrl }),
                sessionId: '',
                url: ''
            })
        },
        onError: (mutationError) => {
            addToast({
                title: t('admin.publicUrl.failedTitle'),
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
        setDraftPublicUrl(overview.config.publicUrl)
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

    const publicUrlIsDirty = useMemo(() => {
        if (!overview) {
            return false
        }
        return draftPublicUrl.trim() !== overview.config.publicUrl
    }, [draftPublicUrl, overview])

    const tokenValue = overview?.token.value ?? ''

    const sanitizeSensitivePreview = (value: string) => {
        let masked = maskTokenizedUrl(value)
        if (tokenValue) {
            masked = masked.split(tokenValue).join('••••hidden••••')
        }
        return masked
    }

    const copyText = async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value)
            addToast({
                title: t('admin.copy.copied', { label }),
                body: sanitizeSensitivePreview(value),
                sessionId: '',
                url: ''
            })
        } catch (copyError) {
            addToast({
                title: t('admin.copy.failed', { label }),
                body: copyError instanceof Error ? copyError.message : 'Clipboard is unavailable.',
                sessionId: '',
                url: ''
            })
        }
    }

    const buildLoginLink = (entryUrl: string): string => {
        const normalized = entryUrl.replace(/\/+$/, '')
        return `${normalized}/?token=${encodeURIComponent(tokenValue)}`
    }

    const toggleDraftMode = (mode: AdminAccessMode) => {
        if (draftEnabledModes.includes(mode)) {
            if (draftEnabledModes.length === 1) {
                addToast({
                    title: t('admin.policy.keepOneTitle'),
                    body: t('admin.policy.keepOneBody'),
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

    const localLoginLinkPreview = localLoginLink ? sanitizeSensitivePreview(localLoginLink) : ''
    const tailscaleLoginLinkPreview = tailscaleLoginLink ? sanitizeSensitivePreview(tailscaleLoginLink) : ''
    const publicLoginLinkPreview = publicLoginLink ? sanitizeSensitivePreview(publicLoginLink) : ''

    const accessModeContent = useMemo(() => {
        if (!overview) {
            return null
        }

        if (selectedMode === 'tailscale') {
            return {
                summary: t('admin.mode.tailscale.summary'),
                health: overview.access.tailscale.health,
                link: tailscaleLoginLink,
                linkPreview: tailscaleLoginLinkPreview,
                steps: [
                    t('admin.mode.tailscale.step1'),
                    t('admin.mode.tailscale.step2'),
                    t('admin.mode.tailscale.step3'),
                    t('admin.mode.tailscale.step4'),
                ],
                shareSnippet: t('admin.mode.tailscale.share', { link: tailscaleLoginLink }),
                shareSnippetPreview: t('admin.mode.tailscale.share', { link: tailscaleLoginLinkPreview }),
                snippets: [] as { title: string; code: string }[],
            }
        }

        if (selectedMode === 'public') {
            return {
                summary: t('admin.mode.public.summary'),
                health: overview.access.publicHealth,
                link: publicLoginLink,
                linkPreview: publicLoginLinkPreview,
                steps: [
                    t('admin.mode.public.step1'),
                    t('admin.mode.public.step2'),
                    t('admin.mode.public.step3'),
                    t('admin.mode.public.step4'),
                ],
                shareSnippet: t('admin.mode.public.share', { link: publicLoginLink }),
                shareSnippetPreview: t('admin.mode.public.share', { link: publicLoginLinkPreview }),
                snippets: [
                    { title: t('admin.snippet.hubEnv'), code: hubEnvSnippet },
                    { title: t('admin.snippet.reverseSsh'), code: vpsTunnelSnippet },
                    { title: t('admin.snippet.nginxTemplate'), code: vpsNginxSnippet },
                    ...(publicUsesDomain ? [{ title: t('admin.snippet.nginxHttpsTemplate'), code: httpsNginxSnippet }] : []),
                ],
            }
        }

        return {
            summary: t('admin.mode.local.summary'),
            health: null,
            link: localLoginLink,
            linkPreview: localLoginLinkPreview,
            steps: [
                t('admin.mode.local.step1'),
                t('admin.mode.local.step2'),
                t('admin.mode.local.step3'),
            ],
            shareSnippet: t('admin.mode.local.share', { link: localLoginLink }),
            shareSnippetPreview: t('admin.mode.local.share', { link: localLoginLinkPreview }),
            snippets: [] as { title: string; code: string }[],
        }
    }, [
        hubEnvSnippet,
        httpsNginxSnippet,
        localLoginLink,
        overview,
        publicLoginLink,
        publicLoginLinkPreview,
        publicUsesDomain,
        selectedMode,
        tailscaleLoginLink,
        tailscaleLoginLinkPreview,
        t,
        vpsNginxSnippet,
        vpsTunnelSnippet,
        localLoginLinkPreview,
    ])

    const troubleshootingItems = useMemo(() => {
        const items: Array<{ level: TroubleshootingLevel; title: string; body: string }> = []
        const publicModeEnabled = overview?.access.policy.enabledModes.includes('public') ?? true
        const tailscaleModeEnabled = overview?.access.policy.enabledModes.includes('tailscale') ?? true

        if (onlineMachines === 0) {
            items.push({
                level: 'critical',
                title: t('admin.troubleshooting.noRunnerTitle'),
                body: t('admin.troubleshooting.noRunnerBody'),
            })
        }

        if (tailscaleModeEnabled && overview?.access.tailscale.installed && !overview.access.tailscale.running) {
            items.push({
                level: 'warning',
                title: t('admin.troubleshooting.tailscaleDisconnectedTitle'),
                body: t('admin.troubleshooting.tailscaleDisconnectedBody', {
                    state: overview.access.tailscale.backendState ? ` (${overview.access.tailscale.backendState})` : '',
                }),
            })
        }

        if (tailscaleModeEnabled && !overview?.access.tailscale.installed) {
            items.push({
                level: 'warning',
                title: t('admin.troubleshooting.tailscaleMissingTitle'),
                body: t('admin.troubleshooting.tailscaleMissingBody'),
            })
        }

        if (publicModeEnabled && overview?.access.publicUrl && overview.access.publicHealth && !overview.access.publicHealth.ok) {
            const httpHint = overview.access.publicHealth.status === 502
                ? t('admin.troubleshooting.publicUnhealthyHint502')
                : t('admin.troubleshooting.publicUnhealthyHintGeneric')
            items.push({
                level: 'critical',
                title: t('admin.troubleshooting.publicUnhealthyTitle'),
                body: t('admin.troubleshooting.publicUnhealthyBody', { hint: httpHint }),
            })
        }

        if (publicModeEnabled && overview?.access.publicUrl && !publicUsesDomain) {
            items.push({
                level: 'warning',
                title: t('admin.troubleshooting.publicIpTitle'),
                body: t('admin.troubleshooting.publicIpBody'),
            })
        }

        if (items.length === 0) {
            items.push({
                level: 'good',
                title: t('admin.troubleshooting.healthyTitle'),
                body: t('admin.troubleshooting.healthyBody'),
            })
        }

        return items
    }, [onlineMachines, overview, publicUsesDomain, t])

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
                        <div className="font-semibold text-[var(--app-fg)]">{t('admin.title')}</div>
                        <div className="text-xs text-[var(--app-hint)]">{t('admin.subtitle')}</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => void refetch()}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-fg)] transition-colors hover:bg-[var(--app-subtle-bg)]"
                    >
                        <RefreshIcon />
                        {t('admin.refresh')}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    {isLoading ? (
                        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-10">
                            <LoadingState label={t('admin.loadingOverview')} className="text-sm" />
                        </div>
                    ) : null}

                    {error ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <StatTile label={t('admin.stats.sessions')} value={`${sessions.length}`} hint={t('admin.stats.sessionsHint', { count: activeSessions })} />
                        <StatTile label={t('admin.stats.imported')} value={`${importedSessions}`} hint={t('admin.stats.importedHint')} />
                        <StatTile label={t('admin.stats.onlineMachines')} value={`${onlineMachines}`} hint={t('admin.stats.onlineMachinesHint', { count: runnerMachines })} />
                        <StatTile
                            label={t('admin.stats.currentHub')}
                            value={baseUrl.replace(/^https?:\/\//, '')}
                            hint={overview?.config.publicUrl ? t('admin.stats.publicConfigured') : t('admin.stats.directAccess')}
                        />
                    </div>

                    <AdminCard
                        title={t('admin.access.title')}
                        description={t('admin.access.description')}
                    >
                        <div className="space-y-3">
                            <div className="rounded-xl border border-[var(--app-divider)] px-3 py-3">
                                <div className="text-sm font-medium text-[var(--app-fg)]">{t('admin.publicUrl.title')}</div>
                                <div className="mt-1 text-xs text-[var(--app-hint)]">
                                    {t('admin.publicUrl.description')}
                                </div>
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                    <input
                                        type="text"
                                        value={draftPublicUrl}
                                        onChange={(event) => setDraftPublicUrl(event.target.value)}
                                        disabled={!overview?.config.publicUrlEditable}
                                        placeholder="https://hapi.example.com"
                                        className="min-w-0 flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)] disabled:cursor-not-allowed disabled:opacity-60"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => void updatePublicUrlMutation.mutateAsync()}
                                        disabled={!overview?.config.publicUrlEditable || !publicUrlIsDirty || updatePublicUrlMutation.isPending}
                                        className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] transition-colors hover:bg-[var(--app-subtle-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {updatePublicUrlMutation.isPending ? t('admin.publicUrl.saving') : t('admin.publicUrl.save')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDraftPublicUrl('')}
                                        disabled={!overview?.config.publicUrlEditable || updatePublicUrlMutation.isPending}
                                        className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] transition-colors hover:bg-[var(--app-subtle-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {t('admin.publicUrl.reset')}
                                    </button>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--app-hint)]">
                                    <span>{t('admin.publicUrl.source')}: {overview?.config.sources.publicUrl ?? t('admin.token.unknown')}</span>
                                    <span>{t('admin.publicUrl.restartNote')}</span>
                                </div>
                                {!overview?.config.publicUrlEditable && overview?.config.publicUrlEditableReason ? (
                                    <div className="mt-2 text-xs text-amber-600">{overview.config.publicUrlEditableReason}</div>
                                ) : null}
                            </div>
                            <UrlRow label={t('admin.access.currentHub')} value={baseUrl} onCopy={copyText} />
                            {overview?.access.publicUrl ? (
                                <UrlRow label={t('admin.access.publicUrl')} value={overview.access.publicUrl} onCopy={copyText} />
                            ) : null}
                            {overview?.access.localUrls.map((url) => (
                                <UrlRow key={url} label={t('admin.access.localUrl')} value={url} onCopy={copyText} />
                            ))}
                            {overview?.access.tailscale.urls.map((url) => (
                                <UrlRow key={url} label={t('admin.access.tailscaleUrl')} value={url} onCopy={copyText} />
                            ))}
                            {!overview?.access.tailscale.installed ? (
                                <div className="rounded-xl border border-[var(--app-divider)] px-3 py-3 text-sm text-[var(--app-hint)]">
                                    {t('admin.access.tailscaleMissing')}
                                </div>
                            ) : null}
                            {overview?.access.tailscale.installed && !overview.access.tailscale.running ? (
                                <div className="rounded-xl border border-[var(--app-divider)] px-3 py-3 text-sm text-[var(--app-hint)]">
                                    {t('admin.access.tailscaleDisconnected', {
                                        state: overview.access.tailscale.backendState ? ` (${overview.access.tailscale.backendState})` : '',
                                    })}
                                    {overview.access.tailscale.error ? ` ${overview.access.tailscale.error}` : ''}
                                </div>
                            ) : null}
                            {overview?.access.publicUrl && overview.access.publicHealth ? (
                                <div className="flex items-center justify-between rounded-xl border border-[var(--app-divider)] px-3 py-3">
                                    <div>
                                        <div className="text-sm text-[var(--app-fg)]">{t('admin.access.publicHealth')}</div>
                                        <div className="mt-1 text-xs text-[var(--app-hint)]">{overview.access.publicHealth.message}</div>
                                    </div>
                                    <StatusBadge
                                        ok={overview.access.publicHealth.ok}
                                        label={overview.access.publicHealth.ok ? t('admin.health.healthy') : t('admin.health.needsAttention')}
                                    />
                                </div>
                            ) : null}
                            {overview?.access.tailscale.health ? (
                                <div className="flex items-center justify-between rounded-xl border border-[var(--app-divider)] px-3 py-3">
                                    <div>
                                        <div className="text-sm text-[var(--app-fg)]">{t('admin.access.tailscaleHealth')}</div>
                                        <div className="mt-1 text-xs text-[var(--app-hint)]">{overview.access.tailscale.health.message}</div>
                                    </div>
                                    <StatusBadge
                                        ok={overview.access.tailscale.health.ok}
                                        label={overview.access.tailscale.health.ok ? t('admin.health.healthy') : t('admin.health.needsAttention')}
                                    />
                                </div>
                            ) : null}
                        </div>
                    </AdminCard>

                    <AdminCard
                        title={t('admin.policy.title')}
                        description={t('admin.policy.description')}
                        actions={(
                            <button
                                type="button"
                                onClick={() => void updateAccessPolicyMutation.mutateAsync()}
                                disabled={!draftPolicyIsDirty || updateAccessPolicyMutation.isPending}
                                className="rounded-full border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-fg)] transition-colors hover:bg-[var(--app-subtle-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {updateAccessPolicyMutation.isPending ? t('admin.policy.saving') : t('admin.policy.save')}
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
                                {t('admin.policy.summary', {
                                    enabled: draftEnabledModes.map((mode) => getModeLabel(mode)).join(', '),
                                    preferred: getModeLabel(draftPreferredMode),
                                })}
                            </div>
                        </div>
                    </AdminCard>

                    <AdminCard
                        title={t('admin.guide.title')}
                        description={t('admin.guide.description')}
                    >
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {enabledGuideModes.map((mode) => (
                                    <ModeButton
                                        key={mode}
                                        label={getModeLabel(mode)}
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
                                                {selectedMode === configuredPreferredMode ? t('admin.guide.currentDefault') : t('admin.guide.currentMode')}
                                            </div>
                                            {accessModeContent.health ? (
                                                <StatusBadge
                                                    ok={accessModeContent.health.ok}
                                                    label={accessModeContent.health.ok ? t('admin.health.healthy') : t('admin.health.checkSetup')}
                                                />
                                            ) : null}
                                        </div>
                                        <div className="mt-2 text-sm text-[var(--app-hint)]">{accessModeContent.summary}</div>
                                    </div>

                                    {accessModeContent.link ? (
                                        <UrlRow
                                            label={t('admin.guide.loginLink')}
                                            value={accessModeContent.link}
                                            displayValue={accessModeContent.linkPreview}
                                            hint={t('admin.guide.sensitiveNote')}
                                            onCopy={copyText}
                                        />
                                    ) : (
                                        <div className="rounded-xl border border-[var(--app-divider)] px-3 py-3 text-sm text-[var(--app-hint)]">
                                            {t('admin.guide.noLink')}
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-[var(--app-divider)] px-3 py-3">
                                        <div className="text-sm font-medium text-[var(--app-fg)]">{t('admin.guide.howToUse')}</div>
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
                                            title={t('admin.guide.shareMessage')}
                                            code={accessModeContent.shareSnippet}
                                            displayCode={accessModeContent.shareSnippetPreview}
                                            hint={t('admin.guide.sensitiveNote')}
                                            onCopy={copyText}
                                        />
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    </AdminCard>

                    <AdminCard
                        title={t('admin.troubleshooting.title')}
                        description={t('admin.troubleshooting.description')}
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
                        title={t('admin.token.title')}
                        description={t('admin.token.description')}
                        actions={overview?.token.canRotate ? (
                            <button
                                type="button"
                                onClick={() => void rotateTokenMutation.mutateAsync()}
                                disabled={rotateTokenMutation.isPending}
                                className="rounded-full border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-fg)] transition-colors hover:bg-[var(--app-subtle-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {rotateTokenMutation.isPending ? t('admin.token.rotating') : t('admin.token.rotate')}
                            </button>
                        ) : null}
                    >
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--app-hint)]">
                                <span>{t('admin.token.source')}: {overview?.token.source ?? t('admin.token.unknown')}</span>
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
                                    {showToken ? t('admin.token.hide') : t('admin.token.show')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void copyText(overview?.token.value ?? '', t('admin.token.title'))}
                                    className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] transition-colors hover:bg-[var(--app-subtle-bg)]"
                                >
                                    {t('admin.copy.button')}
                                </button>
                            </div>
                        </div>
                    </AdminCard>

                    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                        <AdminCard title={t('admin.sessions.title')} description={t('admin.sessions.description')}>
                            {sessionsLoading ? (
                                <LoadingState label={t('admin.sessions.loading')} className="text-sm" />
                            ) : sessionsError ? (
                                <div className="text-sm text-red-600">{sessionsError}</div>
                            ) : recentSessions.length === 0 ? (
                                <div className="text-sm text-[var(--app-hint)]">{t('admin.sessions.empty')}</div>
                            ) : (
                                <div className="space-y-2">
                                    {recentSessions.map((session) => {
                                        const label = session.metadata?.name
                                            || session.metadata?.summary?.text
                                            || session.metadata?.path
                                            || session.id
                                        const hint = [
                                            session.active ? t('admin.sessions.active') : t('admin.sessions.archived'),
                                            session.metadata?.sessionOrigin === 'imported'
                                                ? t('admin.sessions.importedFrom', { source: session.metadata.importedFrom ?? 'Codex' })
                                                : t('admin.sessions.spawnedInHapi'),
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

                        <AdminCard title={t('admin.runtime.title')} description={t('admin.runtime.description')}>
                            <div className="space-y-3">
                                {machinesLoading ? (
                                    <LoadingState label={t('admin.runtime.loading')} className="text-sm" />
                                ) : machinesError ? (
                                    <div className="text-sm text-red-600">{machinesError}</div>
                                ) : machines.length === 0 ? (
                                    <div className="rounded-xl border border-[var(--app-divider)] px-3 py-3 text-sm text-[var(--app-hint)]">
                                        {t('admin.runtime.noRunner')}
                                    </div>
                                ) : (
                                    machines.map((machine) => (
                                        <div key={machine.id} className="rounded-xl border border-[var(--app-divider)] px-3 py-3">
                                            <div className="text-sm font-medium text-[var(--app-fg)]">
                                                {machine.metadata?.displayName || machine.metadata?.host || machine.id}
                                            </div>
                                            <div className="mt-1 text-xs text-[var(--app-hint)]">
                                                {machine.active ? t('misc.online') : t('misc.offline')} · {machine.metadata?.platform ?? t('admin.runtime.unknownPlatform')} · {t('admin.runtime.version')} {machine.metadata?.happyCliVersion ?? t('admin.token.unknown')}
                                            </div>
                                            {machine.runnerState?.pid ? (
                                                <div className="mt-1 text-xs text-[var(--app-hint)]">
                                                    {t('admin.runtime.runnerPid', { pid: machine.runnerState.pid })}
                                                    {machine.runnerState.httpPort ? ` · ${t('admin.runtime.port', { port: machine.runnerState.httpPort })}` : ''}
                                                </div>
                                            ) : null}
                                        </div>
                                    ))
                                )}

                                {overview ? (
                                    <div className="rounded-xl border border-[var(--app-divider)] px-3 py-3 text-xs text-[var(--app-hint)]">
                                        <div>{t('admin.runtime.listen')}: {overview.config.listenHost}:{overview.config.listenPort}</div>
                                        <div className="mt-1 break-all">{t('admin.runtime.settings')}: {overview.config.settingsFile}</div>
                                        <div className="mt-1 break-all">{t('admin.runtime.data')}: {overview.config.dataDir}</div>
                                        <div className="mt-1 break-all">{t('admin.runtime.database')}: {overview.config.dbPath}</div>
                                        <div className="mt-1 break-all">{t('admin.runtime.cors')}: {overview.config.corsOrigins.join(', ') || t('admin.runtime.none')}</div>
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
