import { readSettingsOrThrow, writeSettings } from './settings'

export type PublicUrlConfigResult = {
    publicUrl: string
    source: 'file' | 'default'
}

function getConfiguredListenPort(settings: {
    listenPort?: number
    webappPort?: number
}): number {
    if (typeof settings.listenPort === 'number' && Number.isFinite(settings.listenPort) && settings.listenPort > 0) {
        return settings.listenPort
    }
    if (typeof settings.webappPort === 'number' && Number.isFinite(settings.webappPort) && settings.webappPort > 0) {
        return settings.webappPort
    }
    return 3006
}

function deriveDefaultPublicUrl(listenPort: number): string {
    return `http://localhost:${listenPort}`
}

function normalizePublicUrlInput(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null
    }

    if (typeof value !== 'string') {
        throw new Error('Public URL must be a string.')
    }

    const trimmed = value.trim()
    if (!trimmed) {
        return null
    }

    let parsed: URL
    try {
        parsed = new URL(trimmed)
    } catch {
        throw new Error('Public URL must be a valid http:// or https:// URL.')
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Public URL must start with http:// or https://.')
    }

    parsed.hash = ''
    return parsed.toString().replace(/\/+$/, '')
}

export async function updatePublicUrl(
    settingsFile: string,
    value: unknown
): Promise<PublicUrlConfigResult> {
    const settings = await readSettingsOrThrow(settingsFile)
    const normalized = normalizePublicUrlInput(value)

    if (normalized) {
        settings.publicUrl = normalized
    } else {
        delete settings.publicUrl
    }
    delete settings.webappUrl

    await writeSettings(settingsFile, settings)

    if (normalized) {
        return {
            publicUrl: normalized,
            source: 'file',
        }
    }

    return {
        publicUrl: deriveDefaultPublicUrl(getConfiguredListenPort(settings)),
        source: 'default',
    }
}
