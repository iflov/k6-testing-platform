#!/bin/bash
# tests/docker/test-reproducible-build.sh
# Verify mock-server Dockerfile uses npm ci for reproducible builds

set -euo pipefail

DOCKERFILE="apps/mock-server/Dockerfile"

if ! grep -q 'npm ci' "$DOCKERFILE"; then
  echo "FAIL: $DOCKERFILE does not use 'npm ci' for reproducible builds"
  exit 1
fi

if grep -q 'RUN npm install' "$DOCKERFILE"; then
  echo "FAIL: $DOCKERFILE still uses 'npm install' instead of 'npm ci'"
  exit 1
fi

echo "PASS: $DOCKERFILE uses 'npm ci' for reproducible builds"
