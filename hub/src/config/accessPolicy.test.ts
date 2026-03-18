import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normalizeAccessPolicy, readAccessPolicy, updateAccessPolicy } from './accessPolicy'
import { readSettings } from './settings'

const tempDirs: string[] = []

afterEach(async () => {
    while (tempDirs.length > 0) {
        const directory = tempDirs.pop()
        if (directory) {
            await rm(directory, { recursive: true, force: true })
        }
    }
})

describe('accessPolicy', () => {
    it('normalizes invalid values to defaults', () => {
        expect(normalizeAccessPolicy({
            enabledModes: ['public', 'invalid', 'public'],
            preferredMode: 'tailscale',
        })).toEqual({
            enabledModes: ['public'],
            preferredMode: 'public',
        })
    })

    it('reads defaults when no policy exists yet', async () => {
        const dataDir = await mkdtemp(join(tmpdir(), 'hapi-access-policy-'))
        tempDirs.push(dataDir)
        const settingsFile = join(dataDir, 'settings.json')

        await writeFile(settingsFile, JSON.stringify({
            publicUrl: 'http://localhost:3006',
        }, null, 2))

        await expect(readAccessPolicy(settingsFile)).resolves.toEqual({
            enabledModes: ['local', 'tailscale', 'public'],
            preferredMode: 'tailscale',
        })
    })

    it('persists normalized policy without touching unrelated settings', async () => {
        const dataDir = await mkdtemp(join(tmpdir(), 'hapi-access-policy-'))
        tempDirs.push(dataDir)
        const settingsFile = join(dataDir, 'settings.json')

        await writeFile(settingsFile, JSON.stringify({
            cliApiToken: 'keep-me',
            publicUrl: 'http://43.142.77.143',
        }, null, 2))

        const result = await updateAccessPolicy(settingsFile, {
            enabledModes: ['public', 'local'],
            preferredMode: 'tailscale',
        })
        const settings = await readSettings(settingsFile)

        expect(result).toEqual({
            enabledModes: ['local', 'public'],
            preferredMode: 'local',
        })
        expect(settings).toMatchObject({
            cliApiToken: 'keep-me',
            publicUrl: 'http://43.142.77.143',
            accessPolicy: {
                enabledModes: ['local', 'public'],
                preferredMode: 'local',
            }
        })
    })
})
