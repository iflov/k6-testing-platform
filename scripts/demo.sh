#!/usr/bin/env bash
set -euo pipefail

DRY_RUN="${DRY_RUN:-false}"
RUN_CLUSTER_START="${RUN_CLUSTER_START:-true}"
RUN_CLUSTER_STOP="${RUN_CLUSTER_STOP:-false}"
VALUES_FILE="${VALUES_FILE:-helm/k6-platform/values-gke-dev.yaml}"

run() {
  echo "+ $*"
  if [[ "$DRY_RUN" == "true" ]]; then
    return 0
  fi
  "$@"
}

echo "[1/6] Start GKE cluster and InfluxDB VM"
if [[ "$RUN_CLUSTER_START" == "true" ]]; then
  run ./scripts/cluster-start.sh
fi

echo "[2/6] Validate Helm chart"
run helm lint helm/k6-platform
run helm template k6-platform helm/k6-platform -f "$VALUES_FILE" >/tmp/k6-platform-demo-render.yaml

echo "[3/6] Ensure ArgoCD application manifests are ready"
run test -f argocd/projects/k6-platform.yaml
run test -f argocd/applications/k6-platform.yaml

echo "[4/6] Sync or inspect workloads"
if [[ "$DRY_RUN" == "true" ]]; then
  echo "+ kubectl get pods -n argocd"
  echo "+ kubectl get pods -n k6-platform"
  echo "+ argocd app sync k6-platform"
else
  kubectl get pods -n argocd
  kubectl get pods -n k6-platform
  if command -v argocd >/dev/null 2>&1; then
    argocd app sync k6-platform || true
  fi
fi

echo "[5/6] Run a smoke test from k6-runner"
if [[ "$DRY_RUN" == "true" ]]; then
  echo "+ curl -sf -X POST http://localhost:3002/api/test/start -H 'Content-Type: application/json' -d '{"scenario":"smoke","vus":1,"duration":"30s","targetUrl":"http://mock-server:3001"}'"
else
  curl -sf -X POST http://localhost:3002/api/test/start \
    -H 'Content-Type: application/json' \
    -d '{"scenario":"smoke","vus":1,"duration":"30s","targetUrl":"http://mock-server:3001"}' || true
fi

echo "[6/6] Wrap up demo"
if [[ "$RUN_CLUSTER_STOP" == "true" ]]; then
  run ./scripts/cluster-stop.sh
fi

echo "Demo script completed."
