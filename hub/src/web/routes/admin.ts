import { Hono } from 'hono'
import type { WebAppEnv } from '../middleware/auth'
import { configuration } from '../../configuration'
import { readAccessPolicy, updateAccessPolicy } from '../../config/accessPolicy'
import { rotateCliApiToken } from '../../config/cliApiToken'
import { updatePublicUrl } from '../../config/publicUrlConfig'
import { getAccessUrls } from '../../utils/accessUrls'
import { getTailscaleStatus } from '../../utils/tailscale'

type AccessHealth = {
    ok: boolean
    status?: number
    message: string
    checkedAt: number
}

function getTokenState() {
    const canRotate = !process.env.CLI_API_TOKEN
    return {
        value: configuration.cliApiToken,
        source: configuration.cliApiTokenSource,
        canRotate,
        reason: canRotate
            ? undefined
            : 'CLI_API_TOKEN is set via environment variable; update or unset it before rotating.'
    }
}

async function probeHealth(url: string): Promise<AccessHealth> {
    const checkedAt = Date.now()
    const normalizedUrl = url.replace(/\/+$/, '')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3_500)

    try {
        const response = await fetch(`${normalizedUrl}/health`, {
            signal: controller.signal
        })
        const body = await response.json().catch(() => null) as { status?: unknown } | null
        if (!response.ok) {
            return {
                ok: false,
                status: response.status,
                message: `HTTP ${response.status}`,
                checkedAt
            }
        }

        return {
            ok: body?.status === 'ok',
            status: response.status,
            message: body?.status === 'ok' ? 'Reachable' : 'Unexpected health payload',
            checkedAt
        }
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : String(error),
            checkedAt
        }
    } finally {
        clearTimeout(timeout)
    }
}

export function createAdminRoutes(): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.get('/admin/overview', async (c) => {
        const tailscale = getTailscaleStatus()
        const localUrls = getAccessUrls(configuration.listenHost, configuration.listenPort)
        const tailscaleUrls = tailscale.ips.map((ip) => `http://${ip}:${configuration.listenPort}`)
        const publicUrl = configuration.publicUrl || null
        const accessPolicy = await readAccessPolicy(configuration.settingsFile)
        const [publicHealth, tailscaleHealth] = await Promise.all([
            publicUrl ? probeHealth(publicUrl) : Promise.resolve(null),
            tailscaleUrls.length > 0 ? probeHealth(tailscaleUrls[0]) : Promise.resolve(null)
        ])

        return c.json({
            overview: {
                generatedAt: Date.now(),
                config: {
                    listenHost: configuration.listenHost,
                    listenPort: configuration.listenPort,
                    publicUrl: configuration.publicUrl,
                    dataDir: configuration.dataDir,
                    dbPath: configuration.dbPath,
                    settingsFile: configuration.settingsFile,
                    corsOrigins: configuration.corsOrigins,
                    sources: {
                        listenHost: configuration.sources.listenHost,
                        listenPort: configuration.sources.listenPort,
                        publicUrl: configuration.sources.publicUrl,
                        corsOrigins: configuration.sources.corsOrigins,
                    },
                    publicUrlEditable: configuration.sources.publicUrl !== 'env',
                    publicUrlEditableReason: configuration.sources.publicUrl === 'env'
                        ? 'HAPI_PUBLIC_URL is set via environment variable; update the startup config to change it.'
                        : undefined,
                },
                token: getTokenState(),
                access: {
                    policy: accessPolicy,
                    localUrls,
                    publicUrl,
                    publicHealth,
                    tailscale: {
                        ...tailscale,
                        urls: tailscaleUrls,
                        health: tailscaleHealth
                    }
                }
            }
        })
    })

    app.post('/admin/access-policy', async (c) => {
        const body = await c.req.json().catch(() => null)
        if (!body || typeof body !== 'object') {
            return c.json({ error: 'Invalid body' }, 400)
        }

        try {
            const accessPolicy = await updateAccessPolicy(configuration.settingsFile, {
                enabledModes: Reflect.get(body, 'enabledModes'),
                preferredMode: Reflect.get(body, 'preferredMode'),
            })
            return c.json({ accessPolicy })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update access policy'
            return c.json({ error: message }, 500)
        }
    })

    app.post('/admin/public-url', async (c) => {
        const body = await c.req.json().catch(() => null)
        if (!body || typeof body !== 'object') {
            return c.json({ error: 'Invalid body' }, 400)
        }

        if (configuration.sources.publicUrl === 'env') {
            return c.json({
                error: 'HAPI_PUBLIC_URL is set via environment variable; update the startup config to change it.'
            }, 409)
        }

        try {
            const result = await updatePublicUrl(
                configuration.settingsFile,
                Reflect.get(body, 'publicUrl')
            )
            configuration._setPublicUrl(result.publicUrl, result.source)
            return c.json({
                publicUrl: result.publicUrl,
                source: result.source,
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update public URL'
            return c.json({ error: message }, 400)
        }
    })

    app.post('/admin/token/rotate', async (c) => {
        try {
            const rotated = await rotateCliApiToken(configuration.dataDir)
            configuration._setCliApiToken(rotated.token, rotated.source, false)
            return c.json({
                token: getTokenState()
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to rotate access token'
            const status = process.env.CLI_API_TOKEN ? 409 : 500
            return c.json({ error: message }, status)
        }
    })

    return app
}
