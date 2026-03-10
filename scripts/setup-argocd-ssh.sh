#!/usr/bin/env bash
set -euo pipefail

ARGOCD_NAMESPACE="${ARGOCD_NAMESPACE:-argocd}"
ARGOCD_REPO_URL="${ARGOCD_REPO_URL:-git@github.com:your-org/k6-testing-platform.git}"
ARGOCD_REPO_NAME="${ARGOCD_REPO_NAME:-k6-testing-platform}"
SSH_KEY_PATH="${ARGOCD_REPO_SSH_PRIVATE_KEY_PATH:-${HOME}/.ssh/id_rsa}"
DRY_RUN="${DRY_RUN:-false}"

if [[ ! -f "$SSH_KEY_PATH" ]]; then
  echo "SSH private key not found: $SSH_KEY_PATH" >&2
  echo "Set ARGOCD_REPO_SSH_PRIVATE_KEY_PATH to continue." >&2
  exit 1
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "+ kubectl apply repository secret for $ARGOCD_REPO_URL using $SSH_KEY_PATH"
  exit 0
fi

kubectl create namespace "$ARGOCD_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f - <<EOF2
apiVersion: v1
kind: Secret
metadata:
  name: argocd-repo-${ARGOCD_REPO_NAME}
  namespace: ${ARGOCD_NAMESPACE}
  labels:
    argocd.argoproj.io/secret-type: repository
stringData:
  type: git
  name: ${ARGOCD_REPO_NAME}
  url: ${ARGOCD_REPO_URL}
  sshPrivateKey: |
$(sed 's/^/    /' "$SSH_KEY_PATH")
EOF2
