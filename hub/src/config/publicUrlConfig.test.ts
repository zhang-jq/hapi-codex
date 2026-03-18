import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readSettings } from './settings'
import { updatePublicUrl } from './publicUrlConfig'

const tempDirs: string[] = []

afterEach(async () => {
    while (tempDirs.length > 0) {
        const directory = tempDirs.pop()
        if (directory) {
            await rm(directory, { recursive: true, force: true })
        }
    }
})

describe('publicUrlConfig', () => {
    it('persists a normalized public url into settings', async () => {
        const dataDir = await mkdtemp(join(tmpdir(), 'hapi-public-url-'))
        tempDirs.push(dataDir)
        const settingsFile = join(dataDir, 'settings.json')

        await writeFile(settingsFile, JSON.stringify({
            cliApiToken: 'keep-me',
            listenPort: 3006,
        }, null, 2))

        const result = await updatePublicUrl(settingsFile, 'https://example.com/app/')
        const settings = await readSettings(settingsFile)

        expect(result).toEqual({
            publicUrl: 'https://example.com/app',
            source: 'file',
        })
        expect(settings).toMatchObject({
            cliApiToken: 'keep-me',
            listenPort: 3006,
            publicUrl: 'https://example.com/app',
        })
    })

    it('clears the persisted value and falls back to localhost', async () => {
        const dataDir = await mkdtemp(join(tmpdir(), 'hapi-public-url-'))
        tempDirs.push(dataDir)
        const settingsFile = join(dataDir, 'settings.json')

        await writeFile(settingsFile, JSON.stringify({
            publicUrl: 'http://43.142.77.143',
            listenPort: 3012,
        }, null, 2))

        const result = await updatePublicUrl(settingsFile, '')
        const settings = await readSettings(settingsFile)

        expect(result).toEqual({
            publicUrl: 'http://localhost:3012',
            source: 'default',
        })
        expect(settings).toMatchObject({
            listenPort: 3012,
        })
        expect(settings).not.toHaveProperty('publicUrl')
    })

    it('rejects invalid values', async () => {
        const dataDir = await mkdtemp(join(tmpdir(), 'hapi-public-url-'))
        tempDirs.push(dataDir)
        const settingsFile = join(dataDir, 'settings.json')

        await writeFile(settingsFile, JSON.stringify({
            listenPort: 3006,
        }, null, 2))

        await expect(updatePublicUrl(settingsFile, 'example.com')).rejects.toThrow(
            'Public URL must be a valid http:// or https:// URL.'
        )
    })
})
