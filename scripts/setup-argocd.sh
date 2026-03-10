#!/usr/bin/env bash
set -euo pipefail

ARGOCD_NAMESPACE="${ARGOCD_NAMESPACE:-argocd}"
ARGOCD_HELM_CHART_VERSION="${ARGOCD_HELM_CHART_VERSION:-7.7.16}"
DRY_RUN="${DRY_RUN:-false}"

run() {
  echo "+ $*"
  if [[ "$DRY_RUN" == "true" ]]; then
    return 0
  fi
  "$@"
}

run helm repo add argo https://argoproj.github.io/argo-helm
run helm repo update
if [[ "$DRY_RUN" == "true" ]]; then
  echo "+ kubectl create namespace \"$ARGOCD_NAMESPACE\" --dry-run=client -o yaml | kubectl apply -f -"
else
  kubectl create namespace "$ARGOCD_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
fi
run helm upgrade --install argocd argo/argo-cd \
  --namespace "$ARGOCD_NAMESPACE" \
  --version "$ARGOCD_HELM_CHART_VERSION" \
  -f argocd/values.yaml
run kubectl apply -f argocd/projects/k6-platform.yaml
run kubectl apply -f argocd/applications/k6-platform.yaml
