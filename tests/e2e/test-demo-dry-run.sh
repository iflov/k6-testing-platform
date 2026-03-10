#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_FILE="$(mktemp)"
trap 'rm -f "$OUTPUT_FILE"' EXIT

DRY_RUN=true RUN_CLUSTER_STOP=true "$ROOT_DIR/scripts/demo.sh" > "$OUTPUT_FILE"

grep -q '\[1/6\] Start GKE cluster and InfluxDB VM' "$OUTPUT_FILE"
grep -q '\[2/6\] Validate Helm chart' "$OUTPUT_FILE"
grep -q '\[5/6\] Run a smoke test through control-panel' "$OUTPUT_FILE"
grep -q 'Demo script completed.' "$OUTPUT_FILE"

echo "✅ Demo dry-run completed successfully"
