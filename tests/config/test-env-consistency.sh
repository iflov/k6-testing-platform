#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if grep -q 'K6_RUNNER_URL=' "$ROOT_DIR/apps/control-panel/.env.example"; then
  echo "❌ apps/control-panel/.env.example still uses deprecated K6_RUNNER_URL" >&2
  exit 1
fi

grep -q 'K6_RUNNER_BASE_URL=' "$ROOT_DIR/apps/control-panel/.env.example"
grep -q 'K6_DASHBOARD_URL=' "$ROOT_DIR/apps/control-panel/.env.example"
grep -q 'http://influxdb.k6-platform.svc.cluster.local:8181' "$ROOT_DIR/apps/k6-runner-v2/.env.example"
grep -q 'http://mock-server.k6-platform.svc.cluster.local:3001' "$ROOT_DIR/apps/k6-runner-v2/.env.example"
grep -q 'GCP Secret Manager' "$ROOT_DIR/.env.example"

echo "✅ Environment examples are aligned with the GKE migration" 
