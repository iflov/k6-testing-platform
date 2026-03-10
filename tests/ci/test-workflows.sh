#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

for file in \
  "$ROOT_DIR/.github/workflows/ci.yml" \
  "$ROOT_DIR/.github/workflows/cd.yml" \
  "$ROOT_DIR/.github/actions/setup-gcp/action.yml"; do
  [[ -f "$file" ]] || { echo "❌ Missing file: $file" >&2; exit 1; }
done

grep -q 'google-github-actions/auth@v2' "$ROOT_DIR/.github/actions/setup-gcp/action.yml"
grep -q 'hashicorp/setup-terraform@v3' "$ROOT_DIR/.github/workflows/ci.yml"
grep -q 'docker/build-push-action@v6' "$ROOT_DIR/.github/workflows/cd.yml"
grep -q 'tests/e2e/test-demo-dry-run.sh' "$ROOT_DIR/.github/workflows/ci.yml"

echo "✅ GitHub Actions workflow skeletons are present"
