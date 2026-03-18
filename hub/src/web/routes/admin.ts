import { Hono } from 'hono'
import type { WebAppEnv } from '../middleware/auth'
import { configuration } from '../../configuration'
import { rotateCliApiToken } from '../../config/cliApiToken'
import { getAccessUrls } from '../../utils/accessUrls'
import { getTailscaleStatus } from '../../utils/tailscale'

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

export function createAdminRoutes(): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.get('/admin/overview', (c) => {
        const tailscale = getTailscaleStatus()
        const localUrls = getAccessUrls(configuration.listenHost, configuration.listenPort)
        const tailscaleUrls = tailscale.ips.map((ip) => `http://${ip}:${configuration.listenPort}`)

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
                },
                token: getTokenState(),
                access: {
                    localUrls,
                    publicUrl: configuration.publicUrl || null,
                    tailscale: {
                        ...tailscale,
                        urls: tailscaleUrls
                    }
                }
            }
        })
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
