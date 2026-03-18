#!/bin/zsh
set -euo pipefail

LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"
USER_ID="$(id -u)"

launchctl bootout "gui/${USER_ID}/com.hapi-codex.hub" >/dev/null 2>&1 || true
launchctl bootout "gui/${USER_ID}/com.hapi-codex.runner" >/dev/null 2>&1 || true

rm -f \
  "${LAUNCH_AGENTS_DIR}/com.hapi-codex.hub.plist" \
  "${LAUNCH_AGENTS_DIR}/com.hapi-codex.runner.plist"

echo "Removed launch agents from ${LAUNCH_AGENTS_DIR}"
