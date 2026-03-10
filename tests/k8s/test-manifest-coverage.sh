#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_FILE="$(mktemp)"
GKE_OUTPUT_FILE="$(mktemp)"
trap 'rm -f "$OUTPUT_FILE" "$GKE_OUTPUT_FILE"' EXIT

helm lint "$ROOT_DIR/helm/k6-platform" >/dev/null
helm template k6-platform "$ROOT_DIR/helm/k6-platform" -f "$ROOT_DIR/helm/k6-platform/values-local.yaml" > "$OUTPUT_FILE"
helm template k6-platform "$ROOT_DIR/helm/k6-platform" -f "$ROOT_DIR/helm/k6-platform/values-gke-dev.yaml" > "$GKE_OUTPUT_FILE"

grep -q 'kind: Deployment' "$OUTPUT_FILE"
grep -q 'name: control-panel' "$OUTPUT_FILE"
grep -q 'name: mock-server' "$OUTPUT_FILE"
grep -q 'name: k6-runner' "$OUTPUT_FILE"
grep -q 'nodePort: 30000' "$OUTPUT_FILE"
grep -q 'nodePort: 30001' "$OUTPUT_FILE"
grep -q 'nodePort: 30002' "$OUTPUT_FILE"
grep -q 'nodePort: 30665' "$OUTPUT_FILE"
grep -q 'kind: ExternalSecret' "$GKE_OUTPUT_FILE"

for file in \
  "$ROOT_DIR/argocd/values.yaml" \
  "$ROOT_DIR/argocd/projects/k6-platform.yaml" \
  "$ROOT_DIR/argocd/applications/k6-platform.yaml" \
  "$ROOT_DIR/monitoring/README.md" \
  "$ROOT_DIR/monitoring/grafana-datasource.yaml" \
  "$ROOT_DIR/k8s/manifests/postgres.yaml" \
  "$ROOT_DIR/k8s/manifests/influxdb-deployment.yaml"; do
  [[ -f "$file" ]] || { echo "❌ Missing manifest: $file" >&2; exit 1; }
done

echo "✅ Helm, Kind, and ArgoCD manifests are wired together"
