#!/bin/bash

# K6 Testing Platform - Unified Kubernetes Manager
# Single script for all K8s operations on macOS (M1/Intel)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
CLUSTER_NAME="k6-platform"
NAMESPACE="k6-platform"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
K8S_DIR="$PROJECT_ROOT/k8s"

# Help function
show_help() {
    cat << EOF
${CYAN}K6 Testing Platform - Kubernetes Manager${NC}

${YELLOW}Usage:${NC}
    ./k8s-manager.sh [command] [options]

${YELLOW}Commands:${NC}
    ${GREEN}install${NC}      Install required tools (kubectl, helm, kind)
    ${GREEN}setup${NC}        Create Kind cluster (single node)
    ${GREEN}build${NC}        Build Docker images
    ${GREEN}load${NC}         Load images to Kind cluster
    ${GREEN}deploy${NC}       Deploy all services
    ${GREEN}status${NC}       Check deployment status
    ${GREEN}logs${NC}         View logs (use with -s <service>)
    ${GREEN}forward${NC}      Port forward all services
    ${GREEN}test${NC}         Test service endpoints
    ${GREEN}clean${NC}        Clean up deployments
    ${GREEN}destroy${NC}      Destroy Kind cluster
    ${GREEN}all${NC}          Complete setup (setup + build + deploy)

${YELLOW}Options:${NC}
    -s, --service    Service name for logs command
    -h, --help       Show this help message

${YELLOW}Examples:${NC}
    ./k8s-manager.sh install     # Install tools
    ./k8s-manager.sh all         # Complete setup
    ./k8s-manager.sh status      # Check status
    ./k8s-manager.sh logs -s control-panel

${YELLOW}Service URLs (after deployment):${NC}
    Control Panel:  http://localhost:3000
    Mock Server:    http://localhost:3001
    K6 Runner API:  http://localhost:3002
    K6 Dashboard:   http://localhost:5665
    InfluxDB:       http://localhost:8086
    PostgreSQL:     localhost:5432

EOF
}

# Install required tools
install_tools() {
    echo -e "${GREEN}Installing required tools...${NC}"
    
    # Check OS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        echo -e "${RED}This script is for macOS only${NC}"
        exit 1
    fi
    
    # Install Homebrew if needed
    if ! command -v brew &> /dev/null; then
        echo -e "${YELLOW}Installing Homebrew...${NC}"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    # Install tools
    local tools=("kubectl" "helm" "kind" "jq")
    for tool in "${tools[@]}"; do
        if ! command -v $tool &> /dev/null; then
            echo -e "${YELLOW}Installing $tool...${NC}"
            brew install $tool
        else
            echo -e "${GREEN}✓ $tool already installed${NC}"
        fi
    done
    
    # Optional: Install k9s for UI
    if ! command -v k9s &> /dev/null; then
        echo -e "${YELLOW}Installing k9s (optional Kubernetes UI)...${NC}"
        brew install k9s
    fi
    
    echo -e "${GREEN}✅ All tools installed${NC}"
}

# Setup Kind cluster
setup_cluster() {
    echo -e "${GREEN}Setting up Kind cluster...${NC}"
    
    # Check Docker
    if ! docker info &> /dev/null; then
        echo -e "${RED}Docker is not running. Please start Docker Desktop${NC}"
        exit 1
    fi
    
    # Delete existing cluster
    if kind get clusters 2>/dev/null | grep -q "$CLUSTER_NAME"; then
        echo -e "${YELLOW}Deleting existing cluster...${NC}"
        kind delete cluster --name $CLUSTER_NAME
    fi
    
    # Create cluster config
    cat > /tmp/kind-config.yaml <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: $CLUSTER_NAME
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30000
        hostPort: 3000
        protocol: TCP
      - containerPort: 30001
        hostPort: 3001
        protocol: TCP
      - containerPort: 30002
        hostPort: 3002
        protocol: TCP
      - containerPort: 30665
        hostPort: 5665
        protocol: TCP
      - containerPort: 30086
        hostPort: 8086
        protocol: TCP
      - containerPort: 30432
        hostPort: 5432
        protocol: TCP
EOF
    
    # Create cluster
    echo -e "${YELLOW}Creating cluster (this may take 2-3 minutes)...${NC}"
    kind create cluster --config /tmp/kind-config.yaml --wait 5m
    
    # Setup namespace and secrets
    kubectl create namespace $NAMESPACE || true
    
    kubectl create secret generic postgres-secret \
        --from-literal=username=test_admin \
        --from-literal=password=testpassword \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    kubectl create secret generic influxdb-secret \
        --from-literal=admin-user=admin \
        --from-literal=admin-password=admin123 \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Add Helm repos
    helm repo add bitnami https://charts.bitnami.com/bitnami || true
    helm repo update
    
    echo -e "${GREEN}✅ Cluster ready${NC}"
}

# Build Docker images
build_images() {
    echo -e "${GREEN}Building Docker images...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Build images with platform specification for M1
    local platform="linux/arm64"
    if [[ $(uname -m) == "x86_64" ]]; then
        platform="linux/amd64"
    fi
    
    echo -e "${YELLOW}Building Control Panel...${NC}"
    docker build -t k6-testing-platform-control-panel:local \
        --platform $platform \
        ./apps/control-panel
    
    echo -e "${YELLOW}Building Mock Server...${NC}"
    docker build -t k6-testing-platform-mock-server:local \
        --platform $platform \
        ./apps/mock-server
    
    echo -e "${YELLOW}Building K6 Runner...${NC}"
    docker build -t k6-testing-platform-k6-runner:local \
        --platform $platform \
        ./apps/k6-runner-v2
    
    echo -e "${GREEN}✅ Images built${NC}"
}

# Load images to Kind
load_images() {
    echo -e "${GREEN}Loading images to Kind cluster...${NC}"
    
    kind load docker-image k6-testing-platform-control-panel:local --name $CLUSTER_NAME
    kind load docker-image k6-testing-platform-mock-server:local --name $CLUSTER_NAME
    kind load docker-image k6-testing-platform-k6-runner:local --name $CLUSTER_NAME
    
    echo -e "${GREEN}✅ Images loaded${NC}"
}

# Deploy services
deploy_services() {
    echo -e "${GREEN}Deploying services...${NC}"
    
    cd "$K8S_DIR"
    
    # Deploy PostgreSQL
    echo -e "${YELLOW}Deploying PostgreSQL...${NC}"
    kubectl apply -f manifests/postgres.yaml
    
    # Wait for PostgreSQL
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=120s || true
    
    # Deploy InfluxDB
    echo -e "${YELLOW}Deploying InfluxDB...${NC}"
    helm upgrade --install influxdb bitnami/influxdb \
        --namespace $NAMESPACE \
        --values helm/influxdb/values-local.yaml \
        --wait --timeout 5m || true
    
    # Deploy services (single node values)
    echo -e "${YELLOW}Deploying application services...${NC}"
    
    for service in mock-server k6-runner control-panel; do
        echo -e "${YELLOW}Deploying $service...${NC}"
        helm upgrade --install $service ./helm/$service \
            --namespace $NAMESPACE \
            --values helm/$service/values.yaml \
            --values helm/$service/values-single-node.yaml
    done
    
    echo -e "${GREEN}✅ All services deployed${NC}"
}

# Check status
check_status() {
    echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
    echo -e "${CYAN}Cluster Status${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
    
    kubectl get nodes
    echo ""
    
    echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
    echo -e "${CYAN}Pod Status${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
    
    kubectl get pods -n $NAMESPACE -o wide
    echo ""
    
    echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
    echo -e "${CYAN}Services${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
    
    kubectl get svc -n $NAMESPACE
}

# View logs
view_logs() {
    local service=$1
    
    if [ -z "$service" ]; then
        echo -e "${YELLOW}Available services:${NC}"
        kubectl get pods -n $NAMESPACE --no-headers | awk '{print "  • " $1}'
        echo ""
        echo -e "${YELLOW}Usage: $0 logs -s <service-name>${NC}"
        return
    fi
    
    echo -e "${GREEN}Logs for $service:${NC}"
    kubectl logs -n $NAMESPACE -l app=$service --tail=50 -f
}

# Port forward
port_forward() {
    echo -e "${GREEN}Setting up port forwarding...${NC}"
    
    # Kill existing port forwards
    pkill -f "kubectl port-forward" || true
    sleep 2
    
    # Start port forwards in background
    kubectl port-forward -n $NAMESPACE svc/control-panel-service 3000:3000 &
    kubectl port-forward -n $NAMESPACE svc/mock-server-service 3001:3001 &
    kubectl port-forward -n $NAMESPACE svc/k6-runner-service 3002:3002 &
    kubectl port-forward -n $NAMESPACE svc/k6-runner-service 5665:5665 &
    kubectl port-forward -n $NAMESPACE svc/influxdb 8086:8086 &
    kubectl port-forward -n $NAMESPACE svc/postgres-service 5432:5432 &
    
    echo -e "${GREEN}✅ Port forwarding active${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    
    # Wait for interrupt
    trap "pkill -f 'kubectl port-forward'; echo -e '\n${GREEN}Port forwarding stopped${NC}'" INT
    wait
}

# Test endpoints
test_services() {
    echo -e "${GREEN}Testing service endpoints...${NC}"
    
    local services=(
        "Mock Server:3001:/health"
        "Control Panel:3000:/api/health"
        "K6 Runner:3002:/health"
        "K6 Dashboard:5665:/"
        "InfluxDB:8086:/health"
    )
    
    for service in "${services[@]}"; do
        IFS=':' read -r name port path <<< "$service"
        echo -n -e "${YELLOW}Testing $name... ${NC}"
        
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port$path" | grep -q "200\|204"; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${RED}✗${NC}"
        fi
    done
}

# Clean up deployments
clean_deployments() {
    echo -e "${YELLOW}Cleaning up deployments...${NC}"
    
    # Uninstall Helm releases
    helm uninstall control-panel -n $NAMESPACE 2>/dev/null || true
    helm uninstall k6-runner -n $NAMESPACE 2>/dev/null || true
    helm uninstall mock-server -n $NAMESPACE 2>/dev/null || true
    helm uninstall influxdb -n $NAMESPACE 2>/dev/null || true
    
    # Delete PostgreSQL
    kubectl delete -f "$K8S_DIR/manifests/postgres.yaml" 2>/dev/null || true
    
    # Delete PVCs
    kubectl delete pvc --all -n $NAMESPACE 2>/dev/null || true
    
    echo -e "${GREEN}✅ Deployments cleaned${NC}"
}

# Destroy cluster
destroy_cluster() {
    echo -e "${RED}Destroying Kind cluster...${NC}"
    kind delete cluster --name $CLUSTER_NAME
    echo -e "${GREEN}✅ Cluster destroyed${NC}"
}

# Complete setup
complete_setup() {
    echo -e "${MAGENTA}═══════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}Complete K6 Platform Setup${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════${NC}"
    
    setup_cluster
    build_images
    load_images
    deploy_services
    
    sleep 10
    check_status
    
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo -e "${GREEN}🎉 Setup Complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${CYAN}Access your services at:${NC}"
    echo "  • Control Panel:  http://localhost:3000"
    echo "  • Mock Server:    http://localhost:3001"
    echo "  • K6 Runner API:  http://localhost:3002"
    echo "  • K6 Dashboard:   http://localhost:5665"
    echo "  • InfluxDB:       http://localhost:8086"
    echo ""
    echo -e "${YELLOW}Useful commands:${NC}"
    echo "  • View status:    ./k8s-manager.sh status"
    echo "  • View logs:      ./k8s-manager.sh logs -s <service>"
    echo "  • Test services:  ./k8s-manager.sh test"
    echo "  • Clean up:       ./k8s-manager.sh destroy"
}

# Main
main() {
    case "$1" in
        install)
            install_tools
            ;;
        setup)
            setup_cluster
            ;;
        build)
            build_images
            ;;
        load)
            load_images
            ;;
        deploy)
            deploy_services
            ;;
        status)
            check_status
            ;;
        logs)
            shift
            while [[ $# -gt 0 ]]; do
                case $1 in
                    -s|--service)
                        view_logs "$2"
                        shift 2
                        ;;
                    *)
                        shift
                        ;;
                esac
            done
            ;;
        forward)
            port_forward
            ;;
        test)
            test_services
            ;;
        clean)
            clean_deployments
            ;;
        destroy)
            destroy_cluster
            ;;
        all)
            complete_setup
            ;;
        -h|--help|help)
            show_help
            ;;
        *)
            echo -e "${RED}Unknown command: $1${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"