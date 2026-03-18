import type {
    DecryptedMessage as ProtocolDecryptedMessage,
    Session,
    SessionSummary,
    SyncEvent as ProtocolSyncEvent,
    WorktreeMetadata
} from '@hapi/protocol/types'

export type {
    AgentState,
    AttachmentMetadata,
    ModelMode,
    PermissionMode,
    Session,
    SessionSummary,
    SessionSummaryMetadata,
    TeamMember,
    TeamMessage,
    TeamState,
    TeamTask,
    TodoItem,
    WorktreeMetadata
} from '@hapi/protocol/types'

export type SessionMetadataSummary = {
    path: string
    host: string
    version?: string
    name?: string
    os?: string
    summary?: { text: string; updatedAt: number }
    machineId?: string
    tools?: string[]
    flavor?: string | null
    sessionOrigin?: 'spawned' | 'imported'
    importedFrom?: string
    importedAt?: number
    worktree?: WorktreeMetadata
}

export type MessageStatus = 'sending' | 'sent' | 'failed'

export type DecryptedMessage = ProtocolDecryptedMessage & {
    status?: MessageStatus
    originalText?: string
}

export type RunnerState = {
    status?: string
    pid?: number
    httpPort?: number
    startedAt?: number
    shutdownRequestedAt?: number
    shutdownSource?: string
    lastSpawnError?: {
        message: string
        pid?: number
        exitCode?: number | null
        signal?: string | null
        at: number
    } | null
}

export type Machine = {
    id: string
    active: boolean
    metadata: {
        host: string
        platform: string
        happyCliVersion: string
        displayName?: string
    } | null
    runnerState?: RunnerState | null
}

export type AuthResponse = {
    token: string
    user: {
        id: number
        username?: string
        firstName?: string
        lastName?: string
    }
}

export type SessionsResponse = { sessions: SessionSummary[] }
export type SessionResponse = { session: Session }
export type MessagesResponse = {
    messages: DecryptedMessage[]
    page: {
        limit: number
        beforeSeq: number | null
        nextBeforeSeq: number | null
        hasMore: boolean
    }
}

export type MachinesResponse = { machines: Machine[] }
export type MachinePathsExistsResponse = { exists: Record<string, boolean> }
export type ImportableSession = {
    id: string
    title: string
    cwd: string
    updatedAt: number
    originator?: string
}
export type ImportableSessionsQuery = {
    limit?: number
    offset?: number
    titleQuery?: string
    cwdQuery?: string
}
export type ImportableSessionsPage = {
    limit: number
    offset: number
    total: number
    hasMore: boolean
}
export type ImportableSessionsResponse = {
    sessions: ImportableSession[]
    directories: string[]
    page: ImportableSessionsPage
}

export type AdminToken = {
    value: string
    source: 'env' | 'file' | 'generated'
    canRotate: boolean
    reason?: string
}

export type AdminAccessMode = 'local' | 'tailscale' | 'public'

export type AdminAccessPolicy = {
    enabledModes: AdminAccessMode[]
    preferredMode: AdminAccessMode
}

export type AccessHealth = {
    ok: boolean
    status?: number
    message: string
    checkedAt: number
}

export type AdminTailscaleStatus = {
    installed: boolean
    running: boolean
    backendState?: string
    hostname?: string
    ips: string[]
    urls: string[]
    health: AccessHealth | null
    error?: string
}

export type AdminOverview = {
    generatedAt: number
    config: {
        listenHost: string
        listenPort: number
        publicUrl: string
        dataDir: string
        dbPath: string
        settingsFile: string
        corsOrigins: string[]
        sources: {
            listenHost: 'env' | 'file' | 'default'
            listenPort: 'env' | 'file' | 'default'
            publicUrl: 'env' | 'file' | 'default'
            corsOrigins: 'env' | 'file' | 'default'
        }
        publicUrlEditable: boolean
        publicUrlEditableReason?: string
    }
    token: AdminToken
    access: {
        policy: AdminAccessPolicy
        localUrls: string[]
        publicUrl: string | null
        publicHealth: AccessHealth | null
        tailscale: AdminTailscaleStatus
    }
}

export type AdminOverviewResponse = {
    overview: AdminOverview
}

export type RotateCliApiTokenResponse = {
    token: AdminToken
}

export type UpdateAccessPolicyPayload = {
    enabledModes: AdminAccessMode[]
    preferredMode: AdminAccessMode
}

export type UpdateAccessPolicyResponse = {
    accessPolicy: AdminAccessPolicy
}

export type UpdatePublicUrlPayload = {
    publicUrl?: string | null
}

export type UpdatePublicUrlResponse = {
    publicUrl: string
    source: 'file' | 'default'
}

export type SpawnResponse =
    | { type: 'success'; sessionId: string }
    | { type: 'error'; message: string }

export type GitCommandResponse = {
    success: boolean
    stdout?: string
    stderr?: string
    exitCode?: number
    error?: string
}

export type FileSearchItem = {
    fileName: string
    filePath: string
    fullPath: string
    fileType: 'file' | 'folder'
}

export type FileSearchResponse = {
    success: boolean
    files?: FileSearchItem[]
    error?: string
}

export type DirectoryEntry = {
    name: string
    type: 'file' | 'directory' | 'other'
    size?: number
    modified?: number
}

export type ListDirectoryResponse = {
    success: boolean
    entries?: DirectoryEntry[]
    error?: string
}

export type FileReadResponse = {
    success: boolean
    content?: string
    error?: string
}

export type UploadFileResponse = {
    success: boolean
    path?: string
    error?: string
}

export type DeleteUploadResponse = {
    success: boolean
    error?: string
}

export type GitFileStatus = {
    fileName: string
    filePath: string
    fullPath: string
    status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted'
    isStaged: boolean
    linesAdded: number
    linesRemoved: number
    oldPath?: string
}

export type GitStatusFiles = {
    stagedFiles: GitFileStatus[]
    unstagedFiles: GitFileStatus[]
    branch: string | null
    totalStaged: number
    totalUnstaged: number
}

export type SlashCommand = {
    name: string
    description?: string
    source: 'builtin' | 'user' | 'plugin' | 'project'
    content?: string  // Expanded content for Codex user prompts
    pluginName?: string
}

export type SlashCommandsResponse = {
    success: boolean
    commands?: SlashCommand[]
    error?: string
}

export type SkillSummary = {
    name: string
    description?: string
}

export type SkillsResponse = {
    success: boolean
    skills?: SkillSummary[]
    error?: string
}

export type PushSubscriptionKeys = {
    p256dh: string
    auth: string
}

export type PushSubscriptionPayload = {
    endpoint: string
    keys: PushSubscriptionKeys
}

export type PushUnsubscribePayload = {
    endpoint: string
}

export type PushVapidPublicKeyResponse = {
    publicKey: string
}

export type VisibilityPayload = {
    subscriptionId: string
    visibility: 'visible' | 'hidden'
}

export type SyncEvent = ProtocolSyncEvent
