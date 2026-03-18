import { networkInterfaces } from 'node:os'

function formatHostForUrl(host: string): string {
    return host.includes(':') ? `[${host}]` : host
}

function getLanHosts(): string[] {
    const nets = networkInterfaces()
    const hosts = new Set<string>()

    for (const entries of Object.values(nets)) {
        for (const entry of entries ?? []) {
            if (entry.internal) {
                continue
            }
            if (entry.family === 'IPv4' && entry.address) {
                hosts.add(entry.address)
            }
        }
    }

    return Array.from(hosts)
}

export function getAccessUrls(listenHost: string, listenPort: number): string[] {
    const urls = new Set<string>()
    const add = (host: string) => {
        if (!host) {
            return
        }
        urls.add(`http://${formatHostForUrl(host)}:${listenPort}`)
    }

    if (listenHost === '0.0.0.0' || listenHost === '::') {
        add('localhost')
        add('127.0.0.1')
        for (const host of getLanHosts()) {
            add(host)
        }
        return Array.from(urls)
    }

    if (listenHost === 'localhost') {
        add('localhost')
        add('127.0.0.1')
        return Array.from(urls)
    }

    add(listenHost)
    return Array.from(urls)
}
