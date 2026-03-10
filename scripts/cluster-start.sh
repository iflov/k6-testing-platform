#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="${GKE_CLUSTER_NAME:-k6-gke}"
NODE_POOL="${GKE_NODE_POOL:-default-pool}"
ZONE="${GKE_ZONE:-asia-northeast3-a}"
MIN_NODES="${GKE_MIN_NODES:-1}"
MAX_NODES="${GKE_MAX_NODES:-3}"
VM_NAME="${INFLUXDB_VM_NAME:-influxdb-vm}"
PROJECT_ID="${GCP_PROJECT_ID:-}"
DRY_RUN="${DRY_RUN:-false}"

run() {
  echo "+ $*"
  if [[ "$DRY_RUN" == "true" ]]; then
    return 0
  fi
  "$@"
}

GCLOUD_ARGS=()
if [[ -n "$PROJECT_ID" ]]; then
  GCLOUD_ARGS+=(--project "$PROJECT_ID")
fi

run gcloud container clusters resize "$CLUSTER_NAME" \
  --node-pool "$NODE_POOL" \
  --num-nodes "$MIN_NODES" \
  --zone "$ZONE" \
  "${GCLOUD_ARGS[@]}" \
  -q

run gcloud container node-pools update "$NODE_POOL" \
  --cluster "$CLUSTER_NAME" \
  --zone "$ZONE" \
  --enable-autoscaling \
  --min-nodes "$MIN_NODES" \
  --max-nodes "$MAX_NODES" \
  "${GCLOUD_ARGS[@]}" \
  -q

run gcloud compute instances start "$VM_NAME" \
  --zone "$ZONE" \
  "${GCLOUD_ARGS[@]}" \
  -q
