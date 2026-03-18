#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUN_BIN="${BUN_BIN:-$(command -v bun || true)}"
if [[ -z "$BUN_BIN" && -x "${HOME}/.bun/bin/bun" ]]; then
  BUN_BIN="${HOME}/.bun/bin/bun"
fi

if [[ -z "$BUN_BIN" ]]; then
  echo "bun not found. Set BUN_BIN or install bun first." >&2
  exit 1
fi

export HAPI_LISTEN_HOST="${HAPI_LISTEN_HOST:-0.0.0.0}"
export HAPI_LISTEN_PORT="${HAPI_LISTEN_PORT:-3006}"

cd "$REPO_DIR/hub"
exec "$BUN_BIN" run src/index.ts --no-relay
