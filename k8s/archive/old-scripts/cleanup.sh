#!/bin/bash

# K6 Testing Platform - Cleanup Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧹 Cleaning up K6 Testing Platform...${NC}"

# Uninstall Helm releases
echo -e "${YELLOW}Uninstalling Helm releases...${NC}"
helm uninstall control-panel -n k6-platform 2>/dev/null || true
helm uninstall k6-runner -n k6-platform 2>/dev/null || true
helm uninstall mock-server -n k6-platform 2>/dev/null || true
helm uninstall influxdb -n k6-platform 2>/dev/null || true

# Delete PostgreSQL
echo -e "${YELLOW}Deleting PostgreSQL...${NC}"
kubectl delete -f ../manifests/postgres.yaml 2>/dev/null || true

# Delete PVCs
echo -e "${YELLOW}Deleting Persistent Volume Claims...${NC}"
kubectl delete pvc --all -n k6-platform 2>/dev/null || true

# Delete secrets
echo -e "${YELLOW}Deleting Secrets...${NC}"
kubectl delete secret --all -n k6-platform 2>/dev/null || true

# Optionally delete namespace
read -p "Delete k6-platform namespace? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    kubectl delete namespace k6-platform
fi

# Optionally delete Kind cluster
read -p "Delete entire Kind cluster? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    kind delete cluster --name k6-platform
fi

echo -e "${GREEN}✅ Cleanup complete!${NC}"