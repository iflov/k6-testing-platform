#!/bin/bash

# K6 Testing Platform - Port Forwarding Script
# Use this if NodePort is not working properly

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔌 Setting up port forwarding for K6 Testing Platform${NC}"
echo ""

# Function to create port forward in background
forward_port() {
    local service=$1
    local local_port=$2
    local remote_port=$3
    
    echo -e "${BLUE}Forwarding ${service} (localhost:${local_port} -> ${remote_port})${NC}"
    kubectl port-forward -n k6-platform svc/${service} ${local_port}:${remote_port} &
}

# Kill existing port forwards
echo -e "${YELLOW}Cleaning up existing port forwards...${NC}"
pkill -f "kubectl port-forward" || true
sleep 2

# Start port forwards
forward_port "control-panel-service" 3000 3000
forward_port "mock-server-service" 3001 3001
forward_port "k6-runner-service" 3002 3002
forward_port "k6-runner-service" 5665 5665
forward_port "influxdb" 8086 8086
forward_port "postgres-service" 5432 5432

echo ""
echo -e "${GREEN}✅ Port forwarding established!${NC}"
echo ""
echo "Access URLs:"
echo "• Control Panel:  http://localhost:3000"
echo "• Mock Server:    http://localhost:3001"
echo "• K6 Runner API:  http://localhost:3002"
echo "• K6 Dashboard:   http://localhost:5665"
echo "• InfluxDB:       http://localhost:8086"
echo "• PostgreSQL:     localhost:5432"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all port forwards${NC}"

# Wait for interrupt
trap "pkill -f 'kubectl port-forward'; echo -e '\n${GREEN}Port forwarding stopped${NC}'" INT
wait