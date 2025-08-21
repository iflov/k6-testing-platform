#!/bin/bash

# K6 Testing Platform - Complete Deployment Script
# Deploys all services to Kind cluster with proper node distribution

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}K6 Testing Platform - Kubernetes Deployment${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl is not installed${NC}"
    exit 1
fi

# Check if helm is available
if ! command -v helm &> /dev/null; then
    echo -e "${RED}❌ helm is not installed${NC}"
    exit 1
fi

# Check if kind cluster exists
if ! kubectl cluster-info --context kind-k6-platform &> /dev/null; then
    echo -e "${RED}❌ Kind cluster 'k6-platform' not found${NC}"
    echo -e "${YELLOW}Run: cd k8s/kind && ./setup.sh${NC}"
    exit 1
fi

# Set kubectl context
kubectl config use-context kind-k6-platform

# Verify namespace exists
if ! kubectl get namespace k6-platform &> /dev/null; then
    echo -e "${YELLOW}📁 Creating k6-platform namespace...${NC}"
    kubectl create namespace k6-platform
fi

# Build Docker images (optional - comment out if images already exist)
echo -e "${BLUE}🔨 Building Docker images...${NC}"
echo -e "${YELLOW}Note: This requires docker build in the project root${NC}"

# Build images
cd ../.. # Go to project root
docker build -t k6-testing-platform-control-panel:local ./apps/control-panel
docker build -t k6-testing-platform-mock-server:local ./apps/mock-server
docker build -t k6-testing-platform-k6-runner:local ./apps/k6-runner-v2

# Load images to Kind
echo -e "${BLUE}📦 Loading images to Kind cluster...${NC}"
kind load docker-image k6-testing-platform-control-panel:local --name k6-platform
kind load docker-image k6-testing-platform-mock-server:local --name k6-platform
kind load docker-image k6-testing-platform-k6-runner:local --name k6-platform

cd k8s # Return to k8s directory

# Deploy PostgreSQL
echo -e "${GREEN}🐘 Deploying PostgreSQL...${NC}"
kubectl apply -f manifests/postgres.yaml

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}⏳ Waiting for PostgreSQL...${NC}"
kubectl wait --for=condition=ready pod -l app=postgres -n k6-platform --timeout=120s

# Deploy InfluxDB using Bitnami Helm chart
echo -e "${GREEN}📊 Deploying InfluxDB...${NC}"
helm upgrade --install influxdb bitnami/influxdb \
  --namespace k6-platform \
  --values helm/influxdb/values-local.yaml \
  --wait

# Deploy Mock Server (Node 1)
echo -e "${GREEN}🎭 Deploying Mock Server (Node 1 - Isolated)...${NC}"
helm upgrade --install mock-server ./helm/mock-server \
  --namespace k6-platform \
  --values helm/mock-server/values.yaml \
  --values helm/mock-server/values-local.yaml

# Deploy K6 Runner (Node 2)
echo -e "${GREEN}🏃 Deploying K6 Runner (Node 2)...${NC}"
helm upgrade --install k6-runner ./helm/k6-runner \
  --namespace k6-platform \
  --values helm/k6-runner/values.yaml \
  --values helm/k6-runner/values-local.yaml

# Deploy Control Panel (Node 2)
echo -e "${GREEN}🎮 Deploying Control Panel (Node 2)...${NC}"
helm upgrade --install control-panel ./helm/control-panel \
  --namespace k6-platform \
  --values helm/control-panel/values.yaml \
  --values helm/control-panel/values-local.yaml

# Wait for all deployments
echo -e "${YELLOW}⏳ Waiting for all deployments to be ready...${NC}"
kubectl wait --for=condition=available deployment --all -n k6-platform --timeout=180s

# Verify pod distribution
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "${CYAN}Pod Distribution Across Nodes:${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
kubectl get pods -n k6-platform -o wide --sort-by='{.spec.nodeName}'

# Show node distribution summary
echo ""
echo -e "${CYAN}Node Summary:${NC}"
echo -e "${CYAN}─────────────${NC}"
for node in $(kubectl get nodes --no-headers -o custom-columns=NAME:.metadata.name | grep -v control-plane); do
    echo -e "${BLUE}Node: $node${NC}"
    kubectl get pods -n k6-platform --field-selector spec.nodeName=$node --no-headers | awk '{print "  • " $1}'
done

# Display access information
echo ""
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "${CYAN}Service Access URLs:${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}Control Panel:${NC}  http://localhost:3000"
echo -e "${GREEN}Mock Server:${NC}    http://localhost:3001"
echo -e "${GREEN}K6 Runner API:${NC}  http://localhost:3002"
echo -e "${GREEN}K6 Dashboard:${NC}   http://localhost:5665"
echo -e "${GREEN}InfluxDB:${NC}       http://localhost:8086"
echo -e "${GREEN}PostgreSQL:${NC}     localhost:5432"
echo ""
echo -e "${CYAN}Database Credentials:${NC}"
echo "• PostgreSQL: test_admin / testpassword"
echo "• InfluxDB: admin / admin123"
echo ""
echo -e "${CYAN}Useful Commands:${NC}"
echo "• Check pods: kubectl get pods -n k6-platform -o wide"
echo "• View logs: kubectl logs -n k6-platform <pod-name>"
echo "• Port forward: kubectl port-forward -n k6-platform svc/<service> <local>:<remote>"
echo "• Delete all: helm uninstall --namespace k6-platform control-panel k6-runner mock-server influxdb"