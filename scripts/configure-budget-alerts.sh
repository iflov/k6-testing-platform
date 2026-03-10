#!/usr/bin/env bash
set -euo pipefail

BILLING_ACCOUNT="${BILLING_ACCOUNT:-}"
BUDGET_AMOUNT="${BUDGET_AMOUNT:-300USD}"
DISPLAY_NAME_PREFIX="${DISPLAY_NAME_PREFIX:-k6-platform}"
PROJECT_FILTER="${GCP_PROJECT_ID:-}"
NOTIFICATION_CHANNELS="${NOTIFICATION_CHANNELS:-}"
DRY_RUN="${DRY_RUN:-false}"

if [[ -z "$BILLING_ACCOUNT" ]]; then
  echo "BILLING_ACCOUNT is required (example: 000000-000000-000000)" >&2
  exit 1
fi

run() {
  echo "+ $*"
  if [[ "$DRY_RUN" == "true" ]]; then
    return 0
  fi
  "$@"
}

COMMON_ARGS=(
  --billing-account="$BILLING_ACCOUNT"
  --budget-amount="$BUDGET_AMOUNT"
)

if [[ -n "$PROJECT_FILTER" ]]; then
  COMMON_ARGS+=(--filter-projects="projects/$PROJECT_FILTER")
fi

if [[ -n "$NOTIFICATION_CHANNELS" ]]; then
  COMMON_ARGS+=(--notifications-rule-monitoring-notification-channels="$NOTIFICATION_CHANNELS")
fi

create_budget() {
  local name="$1"
  local percent="$2"

  run gcloud billing budgets create \
    "${COMMON_ARGS[@]}" \
    --display-name="${DISPLAY_NAME_PREFIX}-${name}" \
    --threshold-rule="percent=${percent},basis=current-spend" \
    --calendar-period=month
}

create_budget threshold-50 0.1666
create_budget threshold-100 0.3333
create_budget threshold-200 0.6666
create_budget threshold-300 1.0
