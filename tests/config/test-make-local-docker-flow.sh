#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

HELP_OUTPUT="$(make -C "$ROOT_DIR" help)"
grep -q 'make local-up' <<<"$HELP_OUTPUT"
grep -q 'make local-test-quick' <<<"$HELP_OUTPUT"

UP_OUTPUT="$(make -C "$ROOT_DIR" -n local-up)"
grep -q '^docker compose up -d --build$' <<<"$UP_OUTPUT"

TEST_OUTPUT="$(make -C "$ROOT_DIR" -n local-test-quick CONTROL_PANEL_PORT=3100)"
grep -q 'http://localhost:3100/api/k6/run' <<<"$TEST_OUTPUT"

STATUS_OUTPUT="$(make -C "$ROOT_DIR" -n local-status CONTROL_PANEL_BASE_URL=http://localhost:3100)"
grep -q 'http://localhost:3100/api/k6/status' <<<"$STATUS_OUTPUT"

echo "✅ Local Docker Make targets render the expected commands"
