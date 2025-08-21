#!/bin/bash

# K6 Testing Platform - Complete K8s Setup and Deployment
# For M1 Mac with Docker Desktop

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   K6 Testing Platform - Complete K8s Setup  ║${NC}"
echo -e "${CYAN}║           for macOS M1 (Apple Silicon)       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Install tools
echo -e "${GREEN}Step 1: Installing required tools...${NC}"
echo -e "${YELLOW}This will install: kubectl, helm, kind${NC}"
./install-tools-mac.sh

# Verify Docker is running
echo -e "${GREEN}Step 2: Checking Docker...${NC}"
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo -e "${YELLOW}Please start Docker Desktop and press Enter...${NC}"
    read
fi
echo -e "${GREEN}✅ Docker is running${NC}"

# Step 3: Create Kind cluster
echo -e "${GREEN}Step 3: Creating Kind cluster...${NC}"
cd kind
if kind get clusters 2>/dev/null | grep -q "k6-platform"; then
    echo -e "${YELLOW}Cluster already exists. Recreating...${NC}"
    kind delete cluster --name k6-platform
fi
./setup.sh
cd ..

# Step 4: Build Docker images
echo -e "${GREEN}Step 4: Building Docker images...${NC}"
echo -e "${YELLOW}This may take several minutes...${NC}"

cd .. # Go to project root

# Build Control Panel
echo -e "${BLUE}Building Control Panel...${NC}"
docker build -t k6-testing-platform-control-panel:local \
  --platform linux/amd64 \
  ./apps/control-panel

# Build Mock Server
echo -e "${BLUE}Building Mock Server...${NC}"
docker build -t k6-testing-platform-mock-server:local \
  --platform linux/amd64 \
  ./apps/mock-server

# Build K6 Runner
echo -e "${BLUE}Building K6 Runner...${NC}"
docker build -t k6-testing-platform-k6-runner:local \
  --platform linux/amd64 \
  ./apps/k6-runner-v2

cd k8s # Return to k8s directory

# Step 5: Load images to Kind
echo -e "${GREEN}Step 5: Loading images to Kind cluster...${NC}"
kind load docker-image k6-testing-platform-control-panel:local --name k6-platform
kind load docker-image k6-testing-platform-mock-server:local --name k6-platform
kind load docker-image k6-testing-platform-k6-runner:local --name k6-platform

# Step 6: Deploy all services
echo -e "${GREEN}Step 6: Deploying all services...${NC}"
cd scripts
./deploy-all.sh
cd ..

# Step 7: Verify deployment
echo -e "${GREEN}Step 7: Verifying deployment...${NC}"
sleep 10

echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "${CYAN}Checking Pod Status:${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
kubectl get pods -n k6-platform -o wide

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "${CYAN}Node Distribution:${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"

# Show which pods are on which nodes
for node in $(kubectl get nodes --no-headers -o custom-columns=NAME:.metadata.name | grep -v control-plane); do
    workload=$(kubectl get node $node -o jsonpath='{.metadata.labels.workload}')
    echo -e "${BLUE}Node: $node (workload=$workload)${NC}"
    kubectl get pods -n k6-platform --field-selector spec.nodeName=$node --no-headers | awk '{print "  • " $1}'
done

# Final status
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         🎉 Setup Complete! 🎉               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Access your services at:${NC}"
echo "• Control Panel:  http://localhost:3000"
echo "• Mock Server:    http://localhost:3001"
echo "• K6 Runner API:  http://localhost:3002"
echo "• K6 Dashboard:   http://localhost:5665"
echo "• InfluxDB:       http://localhost:8086"
echo "• PostgreSQL:     localhost:5432"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "• View UI: k9s -n k6-platform"
echo "• Logs: kubectl logs -n k6-platform <pod-name>"
echo "• Shell: kubectl exec -it -n k6-platform <pod-name> -- sh"
echo "• Cleanup: ./scripts/cleanup.sh"
echo ""
echo -e "${GREEN}Happy Testing! 🚀${NC}"