#!/bin/bash

# Fix Docker Desktop and Kind setup for macOS M1
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Fixing Docker Desktop and Kind Setup${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

# Step 1: Check and configure Docker Desktop
echo -e "${YELLOW}Step 1: Checking Docker Desktop configuration...${NC}"

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo -e "${YELLOW}Please start Docker Desktop first!${NC}"
    echo ""
    echo "1. Open Docker Desktop from Applications"
    echo "2. Wait for it to start completely"
    echo "3. Run this script again"
    exit 1
fi

# Check Docker version
echo -e "${BLUE}Docker version:${NC}"
docker version

# Check available resources
echo -e "${BLUE}Docker system info:${NC}"
docker system df

# Step 2: Clean up any existing Kind clusters
echo -e "${YELLOW}Step 2: Cleaning up existing clusters...${NC}"
kind delete cluster --name k6-platform 2>/dev/null || true
kind delete cluster --name kind 2>/dev/null || true

# Clean up Docker resources
echo -e "${YELLOW}Cleaning Docker resources...${NC}"
docker system prune -f

# Step 3: Increase Docker Desktop resources
echo -e "${YELLOW}Step 3: Docker Desktop Resource Recommendations${NC}"
echo -e "${RED}IMPORTANT: Please check your Docker Desktop settings:${NC}"
echo ""
echo "Docker Desktop → Settings (⚙️) → Resources:"
echo "• CPUs: At least 4 (recommended: 6)"
echo "• Memory: At least 6 GB (recommended: 8 GB)"
echo "• Swap: 2 GB"
echo "• Disk image size: 60 GB"
echo ""
echo -e "${YELLOW}Have you configured these settings? (y/n)${NC}"
read -r response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Please configure Docker Desktop resources and run this script again."
    exit 1
fi

# Step 4: Install/update Kind
echo -e "${YELLOW}Step 4: Installing/updating Kind...${NC}"
if command -v brew &> /dev/null; then
    brew upgrade kind || brew install kind
else
    echo -e "${RED}Homebrew not found. Installing Kind manually...${NC}"
    curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-darwin-arm64
    chmod +x ./kind
    sudo mv ./kind /usr/local/bin/kind
fi

echo -e "${GREEN}Kind version:${NC}"
kind version

# Step 5: Create simplified Kind cluster
echo -e "${YELLOW}Step 5: Creating Kind cluster with simplified config...${NC}"

cd k8s/kind

# Use the simplified configuration
cat > cluster-config-temp.yaml <<EOF
# Minimal Kind cluster configuration
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: k6-platform
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30000
        hostPort: 3000
      - containerPort: 30001
        hostPort: 3001
      - containerPort: 30002
        hostPort: 3002
      - containerPort: 30665
        hostPort: 5665
      - containerPort: 30086
        hostPort: 8086
      - containerPort: 30432
        hostPort: 5432
  - role: worker
  - role: worker
EOF

# Create cluster with timeout and verbose output
echo -e "${GREEN}Creating cluster (this may take 2-5 minutes)...${NC}"
kind create cluster --config cluster-config-temp.yaml --wait 5m --verbosity 1

# Step 6: Verify cluster is working
echo -e "${YELLOW}Step 6: Verifying cluster...${NC}"

# Set kubectl context
kubectl cluster-info --context kind-k6-platform

# Check nodes
echo -e "${GREEN}Cluster nodes:${NC}"
kubectl get nodes

# Label the worker nodes
echo -e "${YELLOW}Labeling worker nodes...${NC}"
WORKERS=($(kubectl get nodes --no-headers -o custom-columns=NAME:.metadata.name | grep -v control-plane))
if [ ${#WORKERS[@]} -ge 2 ]; then
    kubectl label node ${WORKERS[0]} workload=mock-server --overwrite
    kubectl label node ${WORKERS[1]} workload=main-services --overwrite
    echo "✅ Nodes labeled successfully"
else
    echo "⚠️  Less than 2 worker nodes found, skipping labels"
fi

# Step 7: Create namespace
echo -e "${YELLOW}Step 7: Creating namespace...${NC}"
kubectl create namespace k6-platform || true

# Step 8: Create basic secrets
echo -e "${YELLOW}Step 8: Creating secrets...${NC}"
kubectl create secret generic postgres-secret \
  --from-literal=username=test_admin \
  --from-literal=password=testpassword \
  --namespace=k6-platform \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic influxdb-secret \
  --from-literal=admin-user=admin \
  --from-literal=admin-password=admin123 \
  --namespace=k6-platform \
  --dry-run=client -o yaml | kubectl apply -f -

# Step 9: Add Helm repos
echo -e "${YELLOW}Step 9: Adding Helm repositories...${NC}"
helm repo add bitnami https://charts.bitnami.com/bitnami || true
helm repo update

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${BLUE}Cluster Info:${NC}"
kubectl get nodes -o wide
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Build Docker images: make docker-build"
echo "2. Deploy services: make k8s-deploy"
echo ""
echo -e "${GREEN}Or run everything at once:${NC}"
echo "   cd ../.. && make k8s-deploy"