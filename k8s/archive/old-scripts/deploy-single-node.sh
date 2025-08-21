#!/bin/bash

# K6 Testing Platform - Single Node Deployment Script
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}K6 Testing Platform - Single Node Deployment${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

# Check cluster
if ! kubectl cluster-info --context kind-k6-platform &> /dev/null; then
    echo -e "${RED}❌ Kind cluster not found${NC}"
    echo -e "${YELLOW}Run: cd k8s/kind && ./single-node-setup.sh${NC}"
    exit 1
fi

# Build Docker images
echo -e "${BLUE}🔨 Building Docker images...${NC}"
cd ../.. # Go to project root

# Build with platform specification for M1 Mac
docker build -t k6-testing-platform-control-panel:local \
  --platform linux/arm64 \
  ./apps/control-panel

docker build -t k6-testing-platform-mock-server:local \
  --platform linux/arm64 \
  ./apps/mock-server

docker build -t k6-testing-platform-k6-runner:local \
  --platform linux/arm64 \
  ./apps/k6-runner-v2

# Load images to Kind
echo -e "${BLUE}📦 Loading images to Kind...${NC}"
kind load docker-image k6-testing-platform-control-panel:local --name k6-platform
kind load docker-image k6-testing-platform-mock-server:local --name k6-platform
kind load docker-image k6-testing-platform-k6-runner:local --name k6-platform

cd k8s # Return to k8s directory

# Deploy PostgreSQL
echo -e "${GREEN}🐘 Deploying PostgreSQL...${NC}"
kubectl apply -f manifests/postgres.yaml

# Wait for PostgreSQL
kubectl wait --for=condition=ready pod -l app=postgres -n k6-platform --timeout=120s || true

# Deploy InfluxDB
echo -e "${GREEN}📊 Deploying InfluxDB...${NC}"
helm upgrade --install influxdb bitnami/influxdb \
  --namespace k6-platform \
  --values helm/influxdb/values-local.yaml \
  --set nodeSelector={} \
  --wait --timeout 5m

# Deploy services with single-node values
echo -e "${GREEN}🎭 Deploying Mock Server...${NC}"
helm upgrade --install mock-server ./helm/mock-server \
  --namespace k6-platform \
  --values helm/mock-server/values.yaml \
  --values helm/mock-server/values-single-node.yaml

echo -e "${GREEN}🏃 Deploying K6 Runner...${NC}"
helm upgrade --install k6-runner ./helm/k6-runner \
  --namespace k6-platform \
  --values helm/k6-runner/values.yaml \
  --values helm/k6-runner/values-single-node.yaml

echo -e "${GREEN}🎮 Deploying Control Panel...${NC}"
helm upgrade --install control-panel ./helm/control-panel \
  --namespace k6-platform \
  --values helm/control-panel/values.yaml \
  --values helm/control-panel/values-single-node.yaml

# Wait for deployments
echo -e "${YELLOW}⏳ Waiting for deployments...${NC}"
sleep 10

# Show status
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "${CYAN}Pod Status:${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
kubectl get pods -n k6-platform -o wide

echo ""
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo -e "${CYAN}Service URLs:${NC}"
echo "• Control Panel:  http://localhost:3000"
echo "• Mock Server:    http://localhost:3001"
echo "• K6 Runner API:  http://localhost:3002"
echo "• K6 Dashboard:   http://localhost:5665"
echo "• InfluxDB:       http://localhost:8086"
echo "• PostgreSQL:     localhost:5432"
echo ""
echo -e "${YELLOW}Troubleshooting:${NC}"
echo "• Logs: kubectl logs -n k6-platform <pod-name>"
echo "• Shell: kubectl exec -it -n k6-platform <pod-name> -- sh"
echo "• Port forward: kubectl port-forward -n k6-platform svc/<service> <port>"