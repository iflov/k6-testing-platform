#!/bin/bash
# tests/docker/test-image-size.sh
# Verify control-panel image is under 200MB after optimization

set -euo pipefail

IMAGE_NAME="control-panel:test"
MAX_SIZE_MB=200

echo "Building control-panel image..."
docker build -t "$IMAGE_NAME" ./apps/control-panel

SIZE_BYTES=$(docker image inspect "$IMAGE_NAME" --format='{{.Size}}')
SIZE_MB=$((SIZE_BYTES / 1048576))

if [ "$SIZE_MB" -gt "$MAX_SIZE_MB" ]; then
  echo "FAIL: Image size ${SIZE_MB}MB exceeds ${MAX_SIZE_MB}MB limit"
  docker rmi "$IMAGE_NAME" > /dev/null 2>&1 || true
  exit 1
fi

echo "PASS: Image size ${SIZE_MB}MB within ${MAX_SIZE_MB}MB limit"
docker rmi "$IMAGE_NAME" > /dev/null 2>&1 || true
