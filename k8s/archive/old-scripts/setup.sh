#!/bin/bash

# K6 Testing Platform - Kind Local Kubernetes Setup Script
# 2-node cluster matching infrastructure team's setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}K6 Testing Platform - Kind Cluster Setup${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""

# Check if kind is installed
if ! command -v kind &> /dev/null; then
    echo -e "${YELLOW}📦 Installing kind...${NC}"
    
    # Detect OS and architecture
    OS="$(uname -s)"
    ARCH="$(uname -m)"
    
    case "${OS}" in
        Linux*)
            if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
                curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-arm64
            else
                curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
            fi
            ;;
        Darwin*)
            if command -v brew &> /dev/null; then
                brew install kind
            else
                if [ "$ARCH" = "arm64" ]; then
                    curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-darwin-arm64
                else
                    curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-darwin-amd64
                fi
            fi
            ;;
        *)
            echo -e "${RED}❌ Unsupported OS: ${OS}${NC}"
            exit 1
            ;;
    esac
    
    if [ -f ./kind ]; then
        chmod +x ./kind
        sudo mv ./kind /usr/local/bin/kind
    fi
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${YELLOW}📦 Installing kubectl...${NC}"
    
    OS="$(uname -s)"
    ARCH="$(uname -m)"
    
    case "${OS}" in
        Linux*)
            if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
                curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/arm64/kubectl"
            else
                curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
            fi
            ;;
        Darwin*)
            if command -v brew &> /dev/null; then
                brew install kubectl
            else
                if [ "$ARCH" = "arm64" ]; then
                    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/darwin/arm64/kubectl"
                else
                    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/darwin/amd64/kubectl"
                fi
            fi
            ;;
    esac
    
    if [ -f ./kubectl ]; then
        chmod +x ./kubectl
        sudo mv ./kubectl /usr/local/bin/kubectl
    fi
fi

# Check if helm is installed
if ! command -v helm &> /dev/null; then
    echo -e "${YELLOW}📦 Installing helm...${NC}"
    curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi

# Delete existing cluster if it exists
if kind get clusters 2>/dev/null | grep -q "k6-platform"; then
    echo -e "${YELLOW}🗑️  Deleting existing k6-platform cluster...${NC}"
    kind delete cluster --name k6-platform
fi

# Create kind cluster
echo -e "${GREEN}🚀 Creating kind cluster with 2 worker nodes...${NC}"
kind create cluster --config cluster-config.yaml

# Wait for nodes to be ready
echo -e "${YELLOW}⏳ Waiting for nodes to be ready...${NC}"
kubectl wait --for=condition=Ready nodes --all --timeout=120s

# Verify node labels
echo -e "${BLUE}🏷️  Verifying node labels...${NC}"
kubectl get nodes --show-labels

# Install Nginx Ingress Controller (optional, for future use)
echo -e "${GREEN}📡 Installing Nginx Ingress Controller...${NC}"
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# Wait for ingress to be ready
echo -e "${YELLOW}⏳ Waiting for ingress controller...${NC}"
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s || true

# Create namespace for k6-platform
echo -e "${GREEN}📁 Creating k6-platform namespace...${NC}"
kubectl create namespace k6-platform || true

# Create basic secrets for development
echo -e "${GREEN}🔐 Creating development secrets...${NC}"
kubectl create secret generic postgres-secret \
  --from-literal=username=test_admin \
  --from-literal=password=testpassword \
  --namespace=k6-platform \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic influxdb-secret \
  --from-literal=admin-user=admin \
  --from-literal=admin-password=admin123 \
  --from-literal=user-password=k6password \
  --namespace=k6-platform \
  --dry-run=client -o yaml | kubectl apply -f -

# Add Bitnami Helm repository for InfluxDB
echo -e "${GREEN}📚 Adding Helm repositories...${NC}"
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Display cluster info
echo ""
echo -e "${GREEN}✅ Kind cluster setup complete!${NC}"
echo ""
echo -e "${BLUE}Cluster Information:${NC}"
echo "===================="
kubectl cluster-info --context kind-k6-platform
echo ""
echo -e "${BLUE}Nodes:${NC}"
kubectl get nodes -o wide
echo ""
echo -e "${BLUE}Node Labels:${NC}"
echo "• mock-server node: workload=mock-server"
echo "• main services node: workload=main-services"
echo ""
echo -e "${BLUE}Access URLs (after deploying):${NC}"
echo "=============================="
echo "• Control Panel:  http://localhost:3000"
echo "• Mock Server:    http://localhost:3001"
echo "• K6 Runner API:  http://localhost:3002"
echo "• K6 Dashboard:   http://localhost:5665"
echo "• InfluxDB:       http://localhost:8086"
echo "• PostgreSQL:     localhost:5432"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Build Docker images: make docker-build"
echo "2. Load images to Kind: kind load docker-image <image-name> --name k6-platform"
echo "3. Deploy applications: ./k8s/scripts/deploy-all.sh"
echo "4. Check pod distribution: kubectl get pods -n k6-platform -o wide"