#!/bin/bash

# Single node Kind cluster setup - simpler alternative
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Single Node Kind Cluster Setup (Simplified)${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

# Clean up existing clusters
echo -e "${YELLOW}Cleaning up existing clusters...${NC}"
kind delete cluster --name k6-platform 2>/dev/null || true

# Create single node cluster (much simpler)
echo -e "${GREEN}Creating single node cluster...${NC}"

cat > single-node-config.yaml <<EOF
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
EOF

# Create cluster
kind create cluster --config single-node-config.yaml --wait 5m

# Verify
echo -e "${GREEN}Verifying cluster...${NC}"
kubectl cluster-info --context kind-k6-platform
kubectl get nodes

# Create namespace
kubectl create namespace k6-platform || true

# Create secrets
echo -e "${YELLOW}Creating secrets...${NC}"
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

# Add Helm repos
helm repo add bitnami https://charts.bitnami.com/bitnami || true
helm repo update

echo ""
echo -e "${GREEN}✅ Single node cluster ready!${NC}"
echo ""
echo -e "${YELLOW}Note: This is a single node cluster.${NC}"
echo "All pods will run on the same node (no node separation)."
echo ""
echo "Next: Deploy services with 'make k8s-deploy'"