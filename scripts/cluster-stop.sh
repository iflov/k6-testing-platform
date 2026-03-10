#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="${GKE_CLUSTER_NAME:-k6-gke}"
NODE_POOL="${GKE_NODE_POOL:-default-pool}"
ZONE="${GKE_ZONE:-asia-northeast3-a}"
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

run gcloud container node-pools update "$NODE_POOL" \
  --cluster "$CLUSTER_NAME" \
  --zone "$ZONE" \
  --no-enable-autoscaling \
  "${GCLOUD_ARGS[@]}" \
  -q

run gcloud container clusters resize "$CLUSTER_NAME" \
  --node-pool "$NODE_POOL" \
  --num-nodes 0 \
  --zone "$ZONE" \
  "${GCLOUD_ARGS[@]}" \
  -q

run gcloud compute instances stop "$VM_NAME" \
  --zone "$ZONE" \
  "${GCLOUD_ARGS[@]}" \
  -q
