# hapi-codex

A Codex-first fork of HAPI focused on mobile handoff, image input, existing Codex session import, and self-hosted remote access.

This fork keeps HAPI's local-first session model while making Codex a first-class target for:

- uploading images from desktop and mobile
- importing existing Codex Desktop / Codex CLI sessions
- resuming the same underlying Codex conversation across devices
- running through Tailscale-first self-hosted access

> **Why HAPI?** HAPI is a local-first alternative to Happy. See [Why Not Happy?](docs/guide/why-hapi.md) for the key differences.

## What Changed

- **Codex Image Support** - Mobile and desktop uploads reach Codex as real image inputs instead of only file-path fallback.
- **Import Existing Codex Sessions** - Resume a session that already exists in Codex Desktop or Codex CLI from the HAPI web UI.
- **Historical Image Replay** - Imported Codex sessions preserve recent user prompts, assistant replies, and historical image attachments.
- **Same Session Continuity** - HAPI resumes the same underlying Codex session so desktop / CLI can continue from the same thread.
- **Tailscale-First Self-Hosting** - Local network and private remote access work without depending on a public relay or VPS.
- **Keep the Rest of HAPI** - Session management, approvals, terminal access, rename/archive/delete, and multi-agent support remain intact.

## Demo

https://github.com/user-attachments/assets/38230353-94c6-4dbe-9c29-b2a2cc457546

## Getting Started

### Source checkout (recommended for this fork)

```bash
bun install

# Hub (Tailscale / LAN friendly, no relay)
./scripts/start-source-hub.sh

# Runner
./scripts/start-source-runner.sh
```

Then open:

- `http://localhost:3006`
- your LAN IP, such as `http://192.168.x.x:3006`
- your Tailscale IP, such as `http://100.x.x.x:3006`

Use `bun --cwd cli run src/index.ts doctor` to verify token, hub reachability, runner status, and Tailscale addresses.

### Packaged / upstream-style usage

```bash
npx @twsxtd/hapi hub --relay     # start hub with E2E encrypted relay
npx @twsxtd/hapi                 # run claude code
```

`hapi server` remains supported as an alias.

The terminal will display a URL and QR code. Scan the QR code with your phone or open the URL to access.

> The relay uses WireGuard + TLS for end-to-end encryption. Your data is encrypted from your device to your machine.

For self-hosted options, Tailscale, launchd templates, and token rotation, see [Installation](docs/guide/installation.md)

## Docs

- [App](docs/guide/pwa.md)
- [How it Works](docs/guide/how-it-works.md)
- [Cursor Agent](docs/guide/cursor.md)
- [Voice Assistant](docs/guide/voice-assistant.md)
- [Why HAPI](docs/guide/why-hapi.md)
- [FAQ](docs/guide/faq.md)

## Build from source

```bash
bun install
bun run build:single-exe
```

## Operations

- Rotate the shared access token: `bun --cwd cli run src/index.ts hub token rotate`
- Install source-based launchd services on macOS: `./deploy/macos/install-source-launchagents.sh`
- Remove source-based launchd services on macOS: `./deploy/macos/uninstall-source-launchagents.sh`
- Run diagnostics: `bun --cwd cli run src/index.ts doctor`

## Discussion

- Telegram: [@veryhapi](https://t.me/veryhapi)

## Credits

Based on [tiann/hapi](https://github.com/tiann/hapi), which in turn took inspiration from [Happy](https://github.com/slopus/happy). Great credit to the original projects.
