import { readSettingsOrThrow, writeSettings } from './settings'

export const ACCESS_MODES = ['local', 'tailscale', 'public'] as const

export type AccessMode = (typeof ACCESS_MODES)[number]

export type AccessPolicy = {
    enabledModes: AccessMode[]
    preferredMode: AccessMode
}

const DEFAULT_ENABLED_MODES: AccessMode[] = ['local', 'tailscale', 'public']
const DEFAULT_PREFERRED_MODE: AccessMode = 'tailscale'

function isAccessMode(value: unknown): value is AccessMode {
    return typeof value === 'string' && ACCESS_MODES.includes(value as AccessMode)
}

function normalizeEnabledModes(value: unknown): AccessMode[] {
    const requested = Array.isArray(value) ? value.filter(isAccessMode) : []
    const uniqueModes = new Set(requested)
    const orderedModes = ACCESS_MODES.filter((mode) => uniqueModes.has(mode))
    return orderedModes.length > 0 ? orderedModes : [...DEFAULT_ENABLED_MODES]
}

export function normalizeAccessPolicy(value: {
    enabledModes?: unknown
    preferredMode?: unknown
} | null | undefined): AccessPolicy {
    const enabledModes = normalizeEnabledModes(value?.enabledModes)
    const requestedPreferredMode = isAccessMode(value?.preferredMode)
        ? value.preferredMode
        : DEFAULT_PREFERRED_MODE

    const preferredMode = enabledModes.includes(requestedPreferredMode)
        ? requestedPreferredMode
        : (enabledModes.includes(DEFAULT_PREFERRED_MODE)
            ? DEFAULT_PREFERRED_MODE
            : enabledModes[0]!)

    return {
        enabledModes,
        preferredMode,
    }
}

export async function readAccessPolicy(settingsFile: string): Promise<AccessPolicy> {
    const settings = await readSettingsOrThrow(settingsFile)
    return normalizeAccessPolicy(settings.accessPolicy)
}

export async function updateAccessPolicy(
    settingsFile: string,
    value: {
        enabledModes?: unknown
        preferredMode?: unknown
    }
): Promise<AccessPolicy> {
    const settings = await readSettingsOrThrow(settingsFile)
    const normalized = normalizeAccessPolicy(value)
    settings.accessPolicy = {
        enabledModes: [...normalized.enabledModes],
        preferredMode: normalized.preferredMode,
    }
    await writeSettings(settingsFile, settings)
    return normalized
}
