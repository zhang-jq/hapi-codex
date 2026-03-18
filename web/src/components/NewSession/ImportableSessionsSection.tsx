import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/Spinner'
import type { ImportableSession } from '@/types/api'

function formatUpdatedAt(value: number): string {
    try {
        return new Date(value).toLocaleString()
    } catch {
        return ''
    }
}

export function ImportableSessionsSection(props: {
    agentIsCodex: boolean
    sessions: ImportableSession[]
    directories: string[]
    isLoading: boolean
    isRefreshing: boolean
    error: string | null
    isDisabled: boolean
    activeSessionId: string | null
    titleQuery: string
    cwdQuery: string
    total: number
    limit: number
    offset: number
    hasMore: boolean
    onSwitchToCodex: () => void
    onRefresh: () => void
    onTitleQueryChange: (value: string) => void
    onCwdQueryChange: (value: string) => void
    onPreviousPage: () => void
    onNextPage: () => void
    onResume: (session: ImportableSession) => void
}) {
    const showEmpty = props.agentIsCodex && !props.isLoading && !props.isRefreshing && !props.error && props.sessions.length === 0
    const showFilters = props.agentIsCodex && (!props.isLoading || props.titleQuery || props.cwdQuery || props.sessions.length > 0)
    const visibleStart = props.sessions.length > 0 ? props.offset + 1 : 0
    const visibleEnd = props.offset + props.sessions.length
    const canGoPrevious = props.offset > 0
    const canGoNext = props.hasMore
    const directorySuggestions = props.directories.filter((value) => value.trim().length > 0)

    return (
        <div className="flex flex-col gap-3 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                    <span className="text-xs font-medium text-[var(--app-hint)]">
                        Import Existing Codex Session
                    </span>
                    <span className="text-xs text-[var(--app-hint)]">
                        Continue a session that already exists in Codex Desktop or Codex CLI on this machine.
                    </span>
                    <span className="text-xs text-[var(--app-hint)]">
                        Recent user prompts, image attachments, and assistant final answers are imported when you resume.
                    </span>
                </div>
                {props.agentIsCodex ? (
                    <Button
                        variant="secondary"
                        onClick={props.onRefresh}
                        disabled={props.isDisabled}
                        className="shrink-0"
                    >
                        Refresh
                    </Button>
                ) : (
                    <Button
                        variant="secondary"
                        onClick={props.onSwitchToCodex}
                        disabled={props.isDisabled}
                        className="shrink-0"
                    >
                        Use Codex
                    </Button>
                )}
            </div>

            {!props.agentIsCodex ? (
                <div className="rounded-md border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-3 py-3 text-sm text-[var(--app-hint)]">
                    Switch the agent to <span className="font-medium text-[var(--app-fg)]">Codex</span> to browse and resume existing Codex sessions.
                </div>
            ) : null}

            {props.agentIsCodex && props.error ? (
                <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600">
                    {props.error}
                </div>
            ) : null}

            {showFilters ? (
                <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex min-w-0 flex-col gap-1">
                        <span className="text-[11px] font-medium text-[var(--app-hint)]">
                            Search title
                        </span>
                        <input
                            value={props.titleQuery}
                            onChange={(event) => props.onTitleQueryChange(event.target.value)}
                            disabled={props.isDisabled}
                            placeholder="例如：小龙虾维保"
                            className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] disabled:opacity-50"
                        />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1">
                        <span className="text-[11px] font-medium text-[var(--app-hint)]">
                            Filter directory
                        </span>
                        <input
                            list="importable-codex-directories"
                            value={props.cwdQuery}
                            onChange={(event) => props.onCwdQueryChange(event.target.value)}
                            disabled={props.isDisabled}
                            placeholder="输入或下拉选择目录"
                            className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] disabled:opacity-50"
                        />
                        {directorySuggestions.length > 0 ? (
                            <datalist id="importable-codex-directories">
                                {directorySuggestions.map((directory) => (
                                    <option key={directory} value={directory} />
                                ))}
                            </datalist>
                        ) : null}
                    </label>
                    <div className="sm:col-span-2 text-[11px] text-[var(--app-hint)]">
                        Showing {visibleStart}-{visibleEnd} of {props.total} session{props.total === 1 ? '' : 's'}
                        {props.titleQuery || props.cwdQuery ? ' matched' : ''}
                    </div>
                </div>
            ) : null}

            {props.agentIsCodex && (props.isLoading || props.isRefreshing) ? (
                <div className="flex items-center gap-2 rounded-md border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-3 py-3 text-sm text-[var(--app-hint)]">
                    <Spinner size="sm" label={null} />
                    {props.isRefreshing ? 'Updating Codex sessions...' : 'Loading Codex sessions...'}
                </div>
            ) : null}

            {showEmpty ? (
                <div className="rounded-md border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-3 py-3 text-sm text-[var(--app-hint)]">
                    {props.titleQuery || props.cwdQuery
                        ? 'No Codex sessions matched the current title or directory filters.'
                        : 'No importable Codex sessions found on this machine yet.'}
                </div>
            ) : null}

            {props.agentIsCodex && props.sessions.length > 0 ? (
                <div className="flex flex-col gap-2">
                    {props.sessions.map((session) => {
                        const isResuming = props.activeSessionId === session.id
                        return (
                            <div
                                key={session.id}
                                className="rounded-md border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-3 py-3"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium text-[var(--app-fg)]" title={session.title}>
                                            {session.title}
                                        </div>
                                        <div className="mt-1 truncate text-xs text-[var(--app-hint)]" title={session.cwd}>
                                            {session.cwd}
                                        </div>
                                        <div className="mt-1 text-xs text-[var(--app-hint)]">
                                            {formatUpdatedAt(session.updatedAt)}
                                            {session.originator ? ` · ${session.originator}` : ''}
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => props.onResume(session)}
                                        disabled={props.isDisabled}
                                        className="shrink-0 gap-2"
                                        aria-busy={isResuming}
                                    >
                                        {isResuming ? (
                                            <>
                                                <Spinner size="sm" label={null} className="text-[var(--app-button-text)]" />
                                                Resuming
                                            </>
                                        ) : (
                                            'Resume'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                    <div className="flex items-center justify-between gap-2 pt-1">
                        <Button
                            variant="secondary"
                            onClick={props.onPreviousPage}
                            disabled={props.isDisabled || !canGoPrevious}
                        >
                            Previous
                        </Button>
                        <span className="text-[11px] text-[var(--app-hint)]">
                            {Math.floor(props.offset / Math.max(props.limit, 1)) + 1}
                        </span>
                        <Button
                            variant="secondary"
                            onClick={props.onNextPage}
                            disabled={props.isDisabled || !canGoNext}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
