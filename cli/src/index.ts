#!/usr/bin/env bun

export {}

const { runCli } = await import('./commands/runCli')
await runCli()
