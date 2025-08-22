# K6 Testing Platform - Kubernetes Deployment

## Overview
Local Kubernetes deployment using Kind (Kubernetes in Docker) for the K6 Testing Platform. Provides a single-node cluster optimized for development on macOS (including M1/M2).

## Architecture
- **Single-node Kind cluster** with NodePort service exposure
- **PostgreSQL** for test history
- **InfluxDB** (Bitnami) for metrics with authentication
- **Mock Server** for testing targets
- **K6 Runner** with xk6-output-influxdb extension
- **Control Panel** for web UI

## Quick Start

### Prerequisites
- Docker Desktop for Mac
- macOS (Intel or Apple Silicon)

### Installation & Deployment
```bash
# Install required tools (kubectl, helm, kind)
make k8s-install

# Complete setup (create cluster + build + deploy)
make k8s-all

# Or step by step:
make k8s-setup    # Create Kind cluster
make k8s-build    # Build Docker images
make k8s-deploy   # Deploy services
```

### Management Commands
```bash
# Check status
make k8s-status

# View logs
make k8s-logs SERVICE=control-panel
make k8s-logs SERVICE=mock-server
make k8s-logs SERVICE=k6-runner

# Test endpoints
make k8s-test

# Port forwarding (interactive)
make k8s-forward

# Cleanup
make k8s-clean    # Remove deployments (keep cluster)
make k8s-destroy  # Destroy entire cluster
```

## Service URLs
After deployment, services are accessible at:
- **Control Panel**: http://localhost:3000
- **Mock Server**: http://localhost:3001
- **K6 Runner API**: http://localhost:3002
- **K6 Dashboard**: http://localhost:5665
- **InfluxDB**: http://localhost:8086
- **PostgreSQL**: localhost:5432

## Configuration

### Unified Management Script
All operations are managed through `k8s-manager.sh`:
```bash
./k8s-manager.sh [command]

Commands:
  install  - Install kubectl, helm, kind
  setup    - Create Kind cluster
  build    - Build Docker images
  load     - Load images to Kind
  deploy   - Deploy all services
  status   - Check deployment status
  logs     - View logs (use with -s <service>)
  forward  - Port forward all services
  test     - Test service endpoints
  clean    - Clean up deployments
  destroy  - Destroy Kind cluster
  all      - Complete setup (setup + build + deploy)
```

### Helm Charts
Each service has its own Helm chart in `helm/<service>/`:
- `values.yaml` - Base configuration
- `values-single-node.yaml` - Single-node overrides (nodeSelector: null)

### Secrets
Created automatically during cluster setup:
- **postgres-secret**: Database credentials
- **influxdb-secret**: InfluxDB admin credentials

## Troubleshooting

### Common Issues

#### Pods stuck in Pending
```bash
# Check pod details
kubectl describe pod <pod-name> -n k6-platform

# Common cause: nodeSelector issues
# Solution: Ensure values-single-node.yaml has nodeSelector: null
```

#### Image pull errors
```bash
# Rebuild and load images
make k8s-build
make k8s-load

# Delete pod to trigger restart
kubectl delete pod <pod-name> -n k6-platform
```

#### Docker disk space
```bash
# Clean up Docker
docker system prune -af --volumes

# Then rebuild
make k8s-build
```

### Debug Commands
```bash
# Get shell access to pod
kubectl exec -it -n k6-platform <pod-name> -- sh

# Check Kind cluster nodes
kubectl get nodes

# View all resources
kubectl get all -n k6-platform

# Check events
kubectl get events -n k6-platform --sort-by='.lastTimestamp'
```

## Directory Structure (Single-Node Setup)
```
k8s/
├── k8s-manager.sh           # Unified management script
├── kind/
│   └── single-node-config.yaml  # Single-node Kind cluster config
├── manifests/
│   └── postgres.yaml        # PostgreSQL manifest
├── helm/
│   ├── control-panel/       # Control Panel Helm chart
│   │   ├── values.yaml      # Base configuration
│   │   └── values-single-node.yaml  # Single-node overrides
│   ├── mock-server/         # Mock Server Helm chart
│   │   ├── values.yaml
│   │   └── values-single-node.yaml
│   ├── k6-runner/           # K6 Runner Helm chart
│   │   ├── values.yaml
│   │   └── values-single-node.yaml
│   └── influxdb/            # InfluxDB wrapper chart with auto-init
│       ├── Chart.yaml       # Depends on Bitnami InfluxDB
│       ├── templates/
│       │   └── init-job.yaml  # Auto token creation & DB setup
│       └── values.yaml
└── archive/
    └── old-scripts/         # Archived individual scripts
```

## Key Features
- **Single-node optimized**: Simplified architecture for local development
- **Automatic InfluxDB setup**: Token creation and database initialization via Helm post-install hook
- **Token management**: InfluxDB tokens stored in Kubernetes secrets, automatically used by services
- **NodePort exposure**: Direct access without LoadBalancer
- **Platform-specific builds**: Support for M1/M2 Macs (linux/arm64)
- **Unified management**: All operations through k8s-manager.sh

## Token Management
InfluxDB tokens are automatically managed:
1. **Auto-creation**: Post-install Job creates admin token
2. **Secret storage**: Token stored in `influxdb-admin-token` secret
3. **Auto-injection**: K6 Runner and Control Panel read from secret
4. **Fallback support**: Manual token in values.yaml as backup