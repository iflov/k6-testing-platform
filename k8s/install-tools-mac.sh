#!/bin/bash

# K6 Testing Platform - macOS (M1) Tools Installation Script
# Installs: Homebrew, kubectl, helm, kind, docker (if needed)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}K6 Testing Platform - macOS M1 Setup${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ This script is for macOS only${NC}"
    exit 1
fi

# Check if running on ARM64 (M1)
if [[ $(uname -m) == "arm64" ]]; then
    echo -e "${GREEN}✅ Detected Apple Silicon (M1) Mac${NC}"
else
    echo -e "${YELLOW}⚠️  Detected Intel Mac, but continuing...${NC}"
fi

# Install Homebrew if not installed
if ! command -v brew &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Homebrew...${NC}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for M1 Macs
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
else
    echo -e "${GREEN}✅ Homebrew already installed${NC}"
    brew --version
fi

# Update Homebrew
echo -e "${BLUE}🔄 Updating Homebrew...${NC}"
brew update

# Install Docker Desktop if not installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Docker Desktop...${NC}"
    brew install --cask docker
    echo -e "${YELLOW}⚠️  Please start Docker Desktop manually from Applications${NC}"
    echo -e "${YELLOW}   Press Enter after Docker Desktop is running...${NC}"
    read
else
    echo -e "${GREEN}✅ Docker already installed${NC}"
    docker --version
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop${NC}"
    echo -e "${YELLOW}   Press Enter after Docker Desktop is running...${NC}"
    read
fi

# Install kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${YELLOW}📦 Installing kubectl...${NC}"
    brew install kubectl
else
    echo -e "${GREEN}✅ kubectl already installed${NC}"
fi
kubectl version --client

# Install Helm
if ! command -v helm &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Helm...${NC}"
    brew install helm
else
    echo -e "${GREEN}✅ Helm already installed${NC}"
fi
helm version

# Install Kind
if ! command -v kind &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Kind...${NC}"
    brew install kind
else
    echo -e "${GREEN}✅ Kind already installed${NC}"
fi
kind version

# Install useful utilities
echo -e "${BLUE}📦 Installing useful utilities...${NC}"

# k9s - Kubernetes CLI UI
if ! command -v k9s &> /dev/null; then
    echo -e "${YELLOW}Installing k9s (Kubernetes UI)...${NC}"
    brew install k9s
fi

# jq - JSON processor
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}Installing jq...${NC}"
    brew install jq
fi

# kubectx and kubens - Context/namespace switcher
if ! command -v kubectx &> /dev/null; then
    echo -e "${YELLOW}Installing kubectx/kubens...${NC}"
    brew install kubectx
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✅ All tools installed successfully!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${BLUE}Installed versions:${NC}"
echo "• Docker: $(docker --version 2>/dev/null || echo 'Not running')"
echo "• kubectl: $(kubectl version --client --short 2>/dev/null | head -1)"
echo "• Helm: $(helm version --short 2>/dev/null)"
echo "• Kind: $(kind version 2>/dev/null)"
echo ""
echo -e "${YELLOW}Optional tools installed:${NC}"
echo "• k9s: Kubernetes CLI UI (run 'k9s')"
echo "• jq: JSON processor"
echo "• kubectx: Switch between clusters (run 'kubectx')"
echo "• kubens: Switch between namespaces (run 'kubens')"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Ensure Docker Desktop is running"
echo "2. Enable Kubernetes in Docker Desktop (optional)"
echo "3. Run: cd k8s/kind && ./setup.sh"
echo "4. Deploy services: cd k8s/scripts && ./deploy-all.sh"