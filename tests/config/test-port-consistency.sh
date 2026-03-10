#!/bin/bash
# tests/config/test-port-consistency.sh
# Verify InfluxDB port is consistently 8181 across all config files

set -euo pipefail

ERRORS=0

# Check init-influxdb.sh default port
if grep -q 'INFLUXDB_PORT:-8086' services/influxdb/init-influxdb.sh; then
  echo "FAIL: init-influxdb.sh still defaults to 8086"
  ERRORS=$((ERRORS + 1))
fi

# Check docker-compose.yml uses 8181
if ! grep -q '8181' docker-compose.yml; then
  echo "FAIL: docker-compose.yml does not reference port 8181"
  ERRORS=$((ERRORS + 1))
fi

# Check .env.example uses 8181
if ! grep -q 'INFLUXDB_PORT=8181' .env.example; then
  echo "FAIL: .env.example does not set INFLUXDB_PORT=8181"
  ERRORS=$((ERRORS + 1))
fi

# Check k6-runner .env.example comments
if grep -q 'influxdb:8086' apps/k6-runner-v2/.env.example; then
  echo "FAIL: k6-runner-v2/.env.example still references port 8086"
  ERRORS=$((ERRORS + 1))
fi

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: Found $ERRORS port inconsistencies"
  exit 1
fi

echo "PASS: InfluxDB port 8181 is consistent across all config files"
