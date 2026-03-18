import { spawnSync } from 'node:child_process'

export type TailscaleStatus = {
    installed: boolean
    running: boolean
    backendState?: string
    hostname?: string
    ips: string[]
    error?: string
}

type TailscaleJson = {
    BackendState?: unknown
    Self?: {
        DNSName?: unknown
        HostName?: unknown
        TailscaleIPs?: unknown
    }
}

export function getTailscaleStatus(): TailscaleStatus {
    const result = spawnSync('tailscale', ['status', '--json'], {
        encoding: 'utf8'
    })

    if (result.error) {
        const error = result.error as NodeJS.ErrnoException
        if (error.code === 'ENOENT') {
            return {
                installed: false,
                running: false,
                ips: []
            }
        }

        return {
            installed: true,
            running: false,
            ips: [],
            error: error.message
        }
    }

    if (result.status !== 0) {
        return {
            installed: true,
            running: false,
            ips: [],
            error: (result.stderr || result.stdout || 'tailscale status failed').trim()
        }
    }

    try {
        const parsed = JSON.parse(result.stdout) as TailscaleJson
        const backendState = typeof parsed.BackendState === 'string' ? parsed.BackendState : undefined
        const self = parsed.Self ?? {}
        const hostnameRaw = typeof self.DNSName === 'string'
            ? self.DNSName
            : typeof self.HostName === 'string'
                ? self.HostName
                : undefined
        const hostname = hostnameRaw?.replace(/\.$/, '')
        const ips = Array.isArray(self.TailscaleIPs)
            ? self.TailscaleIPs.filter((value): value is string => typeof value === 'string' && value.length > 0)
            : []
        const running = backendState
            ? !['Stopped', 'NeedsLogin', 'NoState'].includes(backendState)
            : ips.length > 0

        return {
            installed: true,
            running,
            backendState,
            hostname,
            ips
        }
    } catch (error) {
        return {
            installed: true,
            running: false,
            ips: [],
            error: error instanceof Error ? error.message : String(error)
        }
    }
}
