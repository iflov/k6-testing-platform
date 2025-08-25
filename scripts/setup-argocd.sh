#!/bin/bash

# ArgoCD Setup Script for Local Kind Cluster
# This script installs ArgoCD and configures it for the K6 Testing Platform

set -e

NAMESPACE="argocd"
CLUSTER_NAME="k6-cluster"

echo "🚀 Setting up ArgoCD for K6 Testing Platform"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    exit 1
fi

# Check if cluster exists
if ! kubectl cluster-info --context kind-${CLUSTER_NAME} &> /dev/null; then
    echo "❌ Kind cluster '${CLUSTER_NAME}' not found. Please run 'make k8s-setup' first."
    exit 1
fi

# Create ArgoCD namespace
echo "📦 Creating ArgoCD namespace..."
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# Install ArgoCD
echo "📥 Installing ArgoCD..."
kubectl apply -n ${NAMESPACE} -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
echo "⏳ Waiting for ArgoCD pods to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n ${NAMESPACE} --timeout=300s

# Patch ArgoCD server to NodePort for local access
echo "🔧 Configuring ArgoCD for local access..."
kubectl patch svc argocd-server -n ${NAMESPACE} -p '{"spec": {"type": "NodePort", "ports": [{"port": 443, "nodePort": 30443, "protocol": "TCP", "targetPort": 8080}]}}'

# Get initial admin password
echo "🔑 Getting ArgoCD admin password..."
ARGOCD_PASSWORD=$(kubectl -n ${NAMESPACE} get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)

# Apply ArgoCD applications
echo "📋 Creating ArgoCD Applications..."

# Check if applications directory exists
if [ -d "k8s/argocd/applications" ]; then
    kubectl apply -f k8s/argocd/applications/
else
    echo "⚠️  ArgoCD applications directory not found. Please create application manifests."
fi

# Port forward for ArgoCD UI access
echo "🌐 Setting up port forwarding..."
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ ArgoCD installation complete!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📝 Access Information:"
echo "   URL: https://localhost:8080"
echo "   Username: admin"
echo "   Password: ${ARGOCD_PASSWORD}"
echo ""
echo "🚀 To access ArgoCD UI, run:"
echo "   kubectl port-forward svc/argocd-server -n argocd 8080:443"
echo ""
echo "💡 To use ArgoCD CLI:"
echo "   1. Install: brew install argocd"
echo "   2. Login: argocd login localhost:8080 --username admin --password ${ARGOCD_PASSWORD} --insecure"
echo "   3. List apps: argocd app list"
echo ""
echo "🔄 To sync applications:"
echo "   argocd app sync control-panel"
echo "   argocd app sync k6-runner"
echo ""
echo "════════════════════════════════════════════════════════════════"

# Optional: Start port forwarding
read -p "Do you want to start port forwarding now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting port forwarding (Press Ctrl+C to stop)..."
    kubectl port-forward svc/argocd-server -n argocd 8080:443
fi