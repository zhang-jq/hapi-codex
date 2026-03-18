import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rotateCliApiToken } from './cliApiToken'
import { readSettings } from './settings'

const tempDirs: string[] = []

afterEach(async () => {
    delete process.env.CLI_API_TOKEN
    while (tempDirs.length > 0) {
        const directory = tempDirs.pop()
        if (directory) {
            await rm(directory, { recursive: true, force: true })
        }
    }
})

describe('rotateCliApiToken', () => {
    it('replaces the stored token and preserves unrelated settings', async () => {
        const dataDir = await mkdtemp(join(tmpdir(), 'hapi-token-test-'))
        tempDirs.push(dataDir)

        await writeFile(join(dataDir, 'settings.json'), JSON.stringify({
            cliApiToken: 'old-token',
            listenPort: 3012,
            publicUrl: 'http://100.64.0.1:3006'
        }, null, 2))

        const result = await rotateCliApiToken(dataDir)
        const settings = await readSettings(join(dataDir, 'settings.json'))

        expect(result.token).not.toBe('old-token')
        expect(result.filePath).toBe(join(dataDir, 'settings.json'))
        expect(settings).toMatchObject({
            cliApiToken: result.token,
            listenPort: 3012,
            publicUrl: 'http://100.64.0.1:3006'
        })
    })

    it('creates a file-backed token when settings do not exist yet', async () => {
        const dataDir = await mkdtemp(join(tmpdir(), 'hapi-token-test-'))
        tempDirs.push(dataDir)

        const result = await rotateCliApiToken(dataDir)
        const settings = await readSettings(join(dataDir, 'settings.json'))

        expect(result.token.length).toBeGreaterThan(16)
        expect(settings?.cliApiToken).toBe(result.token)
    })

    it('refuses rotation when CLI_API_TOKEN is controlled by environment', async () => {
        const dataDir = await mkdtemp(join(tmpdir(), 'hapi-token-test-'))
        tempDirs.push(dataDir)

        process.env.CLI_API_TOKEN = 'env-token'

        await expect(rotateCliApiToken(dataDir)).rejects.toThrow(
            'Cannot rotate CLI_API_TOKEN while the environment variable is set.'
        )
    })
})
