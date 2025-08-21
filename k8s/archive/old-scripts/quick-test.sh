#!/bin/bash

# Quick test deployment - minimal setup for testing
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}Quick K8s Test Deployment${NC}"
echo ""

# Check cluster
kubectl cluster-info --context kind-k6-platform

# Deploy only Mock Server for testing
echo -e "${YELLOW}Deploying Mock Server only...${NC}"

# Create simple mock server deployment
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mock-server
  namespace: k6-platform
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mock-server
  template:
    metadata:
      labels:
        app: mock-server
    spec:
      containers:
      - name: mock-server
        image: k6-testing-platform-mock-server:local
        imagePullPolicy: Never
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: development
        - name: PORT
          value: "3001"
---
apiVersion: v1
kind: Service
metadata:
  name: mock-server-service
  namespace: k6-platform
spec:
  type: NodePort
  ports:
  - port: 3001
    targetPort: 3001
    nodePort: 30001
  selector:
    app: mock-server
EOF

echo ""
echo -e "${BLUE}Waiting for deployment...${NC}"
sleep 5

kubectl get pods -n k6-platform
echo ""
echo -e "${GREEN}Test URL: http://localhost:3001/health${NC}"
echo ""
echo "Test with: curl http://localhost:3001/health"