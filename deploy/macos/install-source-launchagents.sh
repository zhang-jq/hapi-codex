#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"
BUN_BIN="${BUN_BIN:-$(command -v bun || true)}"
if [[ -z "$BUN_BIN" && -x "${HOME}/.bun/bin/bun" ]]; then
  BUN_BIN="${HOME}/.bun/bin/bun"
fi
USER_ID="$(id -u)"

if [[ -z "$BUN_BIN" ]]; then
  echo "bun not found. Set BUN_BIN or install bun first." >&2
  exit 1
fi

mkdir -p "$LAUNCH_AGENTS_DIR" "${HOME}/.hapi/logs"

render_template() {
  local template="$1"
  local target="$2"
  sed \
    -e "s|__REPO_DIR__|$REPO_DIR|g" \
    -e "s|__BUN_BIN__|$BUN_BIN|g" \
    -e "s|__HOME__|$HOME|g" \
    "$template" > "$target"
}

HUB_TARGET="${LAUNCH_AGENTS_DIR}/com.hapi-codex.hub.plist"
RUNNER_TARGET="${LAUNCH_AGENTS_DIR}/com.hapi-codex.runner.plist"

render_template "${SCRIPT_DIR}/com.hapi-codex.hub.plist.template" "$HUB_TARGET"
render_template "${SCRIPT_DIR}/com.hapi-codex.runner.plist.template" "$RUNNER_TARGET"

launchctl bootout "gui/${USER_ID}/com.hapi-codex.hub" >/dev/null 2>&1 || true
launchctl bootout "gui/${USER_ID}/com.hapi-codex.runner" >/dev/null 2>&1 || true

launchctl bootstrap "gui/${USER_ID}" "$HUB_TARGET"
launchctl bootstrap "gui/${USER_ID}" "$RUNNER_TARGET"
launchctl kickstart -k "gui/${USER_ID}/com.hapi-codex.hub"
launchctl kickstart -k "gui/${USER_ID}/com.hapi-codex.runner"

echo "Installed launch agents:"
echo "  $HUB_TARGET"
echo "  $RUNNER_TARGET"
echo
echo "Logs:"
echo "  ~/.hapi/logs/source-hub.log"
echo "  ~/.hapi/logs/source-runner.log"
