import chalk from 'chalk'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { CommandDefinition, CommandContext } from './types'
import { rotateCliApiToken } from '../../../hub/src/config/cliApiToken'

function parseHubArgs(args: string[]): { host?: string; port?: string } {
    const result: { host?: string; port?: string } = {}

    for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        if (arg === '--host' && i + 1 < args.length) {
            result.host = args[++i]
        } else if (arg === '--port' && i + 1 < args.length) {
            result.port = args[++i]
        } else if (arg.startsWith('--host=')) {
            result.host = arg.slice('--host='.length)
        } else if (arg.startsWith('--port=')) {
            result.port = arg.slice('--port='.length)
        }
    }

    return result
}

function resolveDataDir(): string {
    return process.env.HAPI_HOME
        ? process.env.HAPI_HOME.replace(/^~/, homedir())
        : join(homedir(), '.hapi')
}

function showHubHelp(): void {
    console.log(`
${chalk.bold('hapi hub')} - Hub process and maintenance helpers

${chalk.bold('Usage:')}
  hapi hub                          Start the hub
  hapi hub --host 0.0.0.0          Override listen host
  hapi hub --port 3006             Override listen port
  hapi hub token rotate            Rotate the file-backed CLI_API_TOKEN
`)
}

async function handleHubMaintenanceCommand(args: string[]): Promise<boolean> {
    if (args[0] !== 'token') {
        return false
    }

    const action = args[1]
    if (!action || action === 'help' || action === '--help' || action === '-h') {
        console.log(`
${chalk.bold('hapi hub token')} - Hub access token helpers

${chalk.bold('Usage:')}
  hapi hub token rotate            Rotate the file-backed CLI_API_TOKEN
`)
        return true
    }

    if (action !== 'rotate') {
        throw new Error(`Unknown hub token subcommand: ${action}`)
    }

    const result = await rotateCliApiToken(resolveDataDir())
    console.log(chalk.green('CLI_API_TOKEN rotated successfully.'))
    console.log(chalk.gray(`Settings file: ${result.filePath}`))
    console.log(chalk.yellow('Restart any running hub or runner processes so they pick up the new token.'))
    console.log(chalk.cyan(`New token: ${result.token}`))
    return true
}

export const hubCommand: CommandDefinition = {
    name: 'hub',
    requiresRuntimeAssets: true,
    run: async (context: CommandContext) => {
        try {
            if (
                context.commandArgs[0] === 'help'
                || context.commandArgs[0] === '--help'
                || context.commandArgs[0] === '-h'
            ) {
                showHubHelp()
                return
            }

            if (await handleHubMaintenanceCommand(context.commandArgs)) {
                return
            }

            const { host, port } = parseHubArgs(context.commandArgs)

            if (host) {
                process.env.WEBAPP_HOST = host
            }
            if (port) {
                process.env.WEBAPP_PORT = port
            }
            await import('../../../hub/src/index')
        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
            if (process.env.DEBUG) {
                console.error(error)
            }
            process.exit(1)
        }
    }
}
