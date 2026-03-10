#!/bin/bash
# tests/security/test-no-hardcoded-secrets.sh
# Verify no hardcoded secrets in source-controlled files

set -euo pipefail

ERRORS=0

# Check for the known hardcoded InfluxDB token
if grep -rn 'apiv3_1mW0j3glqhna5FRJrI9A0cGZLKybAUfwrnZ2zG70X' \
  Makefile docker-compose.yml apps/*/Dockerfile apps/*/.env.example 2>/dev/null; then
  echo "FAIL: Found hardcoded InfluxDB API token"
  ERRORS=$((ERRORS + 1))
fi

# Check for hardcoded passwords in Makefile (excluding env var references)
if grep -n 'password=testpassword' Makefile 2>/dev/null | grep -v 'POSTGRES_PASSWORD'; then
  echo "FAIL: Found hardcoded password in Makefile"
  ERRORS=$((ERRORS + 1))
fi

# Check .env files are not tracked by git
TRACKED_ENV=$(git ls-files --cached | grep '\.env$' | grep -v '.env.example' || true)
if [ -n "$TRACKED_ENV" ]; then
  echo "FAIL: .env files tracked by git: $TRACKED_ENV"
  ERRORS=$((ERRORS + 1))
fi

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: Found $ERRORS security issues"
  exit 1
fi

echo "PASS: No hardcoded secrets found"
