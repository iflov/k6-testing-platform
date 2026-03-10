#!/bin/bash

# K6 Testing Platform - Kubernetes Deployment Script
# This script handles deployment to local Kind clusters and remote GKE clusters

set -e

# Configuration
PROJECT_NAME="k6-testing-platform"
NAMESPACE="k6-platform"
CLUSTER_NAME="k6-cluster"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check required tools
    command -v kubectl &> /dev/null || missing_tools+=("kubectl")
    command -v docker &> /dev/null || missing_tools+=("docker")
    command -v kind &> /dev/null || missing_tools+=("kind")
    command -v helm &> /dev/null || missing_tools+=("helm")
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_info "Please install missing tools and try again."
        exit 1
    fi
    
    print_success "All prerequisites met."
}

# Function to setup Kind cluster
setup_kind_cluster() {
    print_info "Setting up Kind cluster..."
    
    if kind get clusters | grep -q "${CLUSTER_NAME}"; then
        print_warning "Kind cluster '${CLUSTER_NAME}' already exists."
        read -p "Do you want to recreate it? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kind delete cluster --name ${CLUSTER_NAME}
            make k8s-setup
        fi
    else
        make k8s-setup
    fi
    
    print_success "Kind cluster ready."
}

# Function to build and load images
build_and_load_images() {
    print_info "Building Docker images..."
    
    # Build Kind-compatible images with commit tags
    make k8s-build
    
    print_info "Loading images to Kind cluster..."
    make k8s-load
    
    print_success "Images loaded to cluster."
}

# Function to deploy services
deploy_services() {
    print_info "Deploying services to Kubernetes..."
    
    # Create namespace
    kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy using make command
    make k8s-deploy
    
    print_success "Services deployed."
}

# Function to setup ArgoCD
setup_argocd() {
    print_info "Setting up ArgoCD..."
    
    # Check if ArgoCD is already installed
    if kubectl get namespace argocd &> /dev/null; then
        print_warning "ArgoCD is already installed."
        read -p "Do you want to reinstall it? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return
        fi
    fi
    
    # Run ArgoCD setup script
    ./scripts/setup-argocd.sh
    
    print_success "ArgoCD setup complete."
}

# Function to configure ArgoCD SSH
configure_argocd_ssh() {
    print_info "Configuring ArgoCD SSH access..."
    
    # Run SSH setup script
    ./scripts/setup-argocd-ssh.sh
    
    print_success "ArgoCD SSH configuration complete."
}

# Function to wait for pods
wait_for_pods() {
    print_info "Waiting for pods to be ready..."
    
    kubectl rollout status deployment/control-panel -n ${NAMESPACE} --timeout=180s || true
    kubectl rollout status deployment/k6-runner -n ${NAMESPACE} --timeout=180s || true
    kubectl rollout status deployment/mock-server -n ${NAMESPACE} --timeout=180s || true
    
    print_success "Pods are ready."
}

# Function to display access information
display_access_info() {
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    print_success "Deployment Complete!"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    echo "📝 Access Information:"
    echo ""
    echo "1. Control Panel:"
    echo "   URL: http://localhost:3000"
    echo "   Command: kubectl port-forward svc/control-panel -n ${NAMESPACE} 3000:3000"
    echo ""
    echo "2. K6 Runner:"
    echo "   URL: http://localhost:3002"
    echo "   Command: kubectl port-forward svc/k6-runner -n ${NAMESPACE} 3002:3002"
    echo ""
    echo "3. K6 Dashboard:"
    echo "   URL: http://localhost:5665"
    echo "   Command: kubectl port-forward svc/k6-runner -n ${NAMESPACE} 5665:5665"
    echo ""
    echo "4. InfluxDB:"
    echo "   URL: http://localhost:8181"
    echo "   Command: kubectl port-forward svc/influxdb -n ${NAMESPACE} 8181:8181"
    echo ""
    echo "5. PostgreSQL:"
    echo "   Host: localhost:5432"
    echo "   Command: kubectl port-forward svc/postgres -n ${NAMESPACE} 5432:5432"
    echo ""
    
    if kubectl get namespace argocd &> /dev/null; then
        # Get ArgoCD password
        ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d 2>/dev/null || echo "Not available")
        
        echo "6. ArgoCD:"
        echo "   URL: https://localhost:8080"
        echo "   Username: admin"
        echo "   Password: ${ARGOCD_PASSWORD}"
        echo "   Command: kubectl port-forward svc/argocd-server -n argocd 8080:443"
        echo ""
    fi
    
    echo "🚀 Quick Start Commands:"
    echo "   make k8s-forward     # Start all port forwards"
    echo "   make k8s-logs        # View logs"
    echo "   make k8s-status      # Check status"
    echo ""
    echo "════════════════════════════════════════════════════════════════"
}

# Function to handle deployment mode
deploy_mode() {
    local mode=$1
    
    case $mode in
        "local")
            print_info "Deploying to local Kind cluster..."
            setup_kind_cluster
            build_and_load_images
            deploy_services
            wait_for_pods
            ;;
        "local-argocd")
            print_info "Deploying to local Kind cluster with ArgoCD..."
            setup_kind_cluster
            setup_argocd
            configure_argocd_ssh
            print_warning "ArgoCD will handle deployment. Monitor the ArgoCD UI for progress."
            ;;
        "gke")
            print_info "Deploying to GKE cluster..."
            print_warning "Make sure you're connected to the correct GKE cluster."
            kubectl config current-context
            read -p "Is this the correct cluster? (y/n) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_error "Deployment cancelled."
                exit 1
            fi
            deploy_services
            wait_for_pods
            ;;
        *)
            print_error "Unknown deployment mode: $mode"
            echo "Usage: $0 [local|local-argocd|gke]"
            exit 1
            ;;
    esac
}

# Main script
main() {
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "       K6 Testing Platform - Kubernetes Deployment"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Select deployment mode
    if [ $# -eq 0 ]; then
        echo "Select deployment mode:"
        echo "1) Local (Kind) - Direct deployment"
        echo "2) Local (Kind) - With ArgoCD"
        echo "3) Remote (GKE)"
        echo ""
        read -p "Enter choice [1-3]: " choice
        
        case $choice in
            1) mode="local" ;;
            2) mode="local-argocd" ;;
            3) mode="gke" ;;
            *) print_error "Invalid choice"; exit 1 ;;
        esac
    else
        mode=$1
    fi
    
    # Deploy
    deploy_mode $mode
    
    # Display access information
    display_access_info
}

# Run main function
main "$@"
