.PHONY: help dev build test clean install up down logs build-control build-mock build-runner-v2 \
	push push-control push-mock push-runner pull version \
	shell-control shell-mock shell-runner shell-postgres influx-cli influx-health \
	health restart clean-all test-stress test-spike test-soak test-quick test-custom status stop-test \
	setup-env network-create network-inspect logs-control logs-mock logs-runner logs-influx rebuild \
	run-control run-mock run-runner db-migrate db-seed db-reset monitor init-influx validate-influx

# Default target
help:
	@echo "╔══════════════════════════════════════════════════════════════╗"
	@echo "║           K6 Testing Platform - Makefile Commands           ║"
	@echo "╚══════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "🚀 Quick Start:"
	@echo "  make setup-env    - Setup environment files"
	@echo "  make install      - Install all dependencies"
	@echo "  make dev          - Start all services in development mode"
	@echo ""
	@echo "📦 Development:"
	@echo "  make up           - Start all services in background"
	@echo "  make down         - Stop all services"
	@echo "  make restart      - Restart all services"
	@echo "  make logs         - Show logs from all services"
	@echo "  make clean        - Clean up containers and volumes"
	@echo "  make clean-all    - Clean everything including images"
	@echo ""
	@echo "🔨 Building:"
	@echo "  make build        - Build all Docker images (with xk6)"
	@echo "  make rebuild      - Rebuild without cache"
	@echo "  make build-control - Build control panel image"
	@echo "  make build-mock   - Build mock server image"
	@echo "  make build-runner-v2 - Build K6 runner v2 image with xk6"
	@echo ""
	@echo "🧪 Testing:"
	@echo "  make test         - Run load test with InfluxDB 3.x"
	@echo "  make test-quick   - Run quick smoke test"
	@echo "  make test-custom  - Run custom test with parameters"
	@echo "  make test-stress  - Run stress test"
	@echo "  make test-spike   - Run spike test"
	@echo "  make test-soak    - Run soak test (long running)"
	@echo "  make status       - Check test status"
	@echo "  make stop-test    - Stop current test"
	@echo ""
	@echo "🐚 Shell Access:"
	@echo "  make shell-control - Access control panel shell"
	@echo "  make shell-mock   - Access mock server shell"
	@echo "  make shell-runner - Access K6 runner shell"
	@echo "  make shell-postgres - Access PostgreSQL shell"
	@echo ""
	@echo "📊 Monitoring:"
	@echo "  make monitor      - Show monitoring dashboard URLs"
	@echo "  make health       - Check service health"
	@echo "  make influx-health - Check InfluxDB 3.x health"
	@echo "  make validate-influx - Validate InfluxDB 3.x token"
	@echo ""
	@echo "📝 Logs:"
	@echo "  make logs-control - Control panel logs"
	@echo "  make logs-mock    - Mock server logs"
	@echo "  make logs-runner  - K6 runner logs"
	@echo "  make logs-influx  - InfluxDB logs"
	@echo ""
	@echo "🗄️ Database:"
	@echo "  make db-migrate   - Run database migrations"
	@echo "  make db-seed      - Seed database"
	@echo "  make db-reset     - Reset database"
	@echo ""
	@echo "🌐 Network:"
	@echo "  make network-create - Create Docker network"
	@echo "  make network-inspect - Inspect network"
	@echo ""
	@echo "🚢 Deployment:"
	@echo "  make push         - Build & push multi-arch images (arm64, amd64)"
	@echo "  make push-single  - Push single-arch images (current platform)"
	@echo "  make buildx-setup - Setup Docker buildx for multi-platform"
	@echo "  make pull         - Pull latest images from Docker Hub"
	@echo "  make version      - Show version and tag information"
	@echo ""
	@echo "⚙️ InfluxDB 3.x:"
	@echo "  make init-influx  - Initialize InfluxDB 3.x"
	@echo "  make influx-health - Check InfluxDB 3.x health"
	@echo "  make validate-influx - Validate InfluxDB token"
	@echo ""
	@echo "💡 Tips:"
	@echo "  - InfluxDB 3.x is now the default (token-based auth)"
	@echo "  - K6 Runner includes xk6-output-influxdb extension"
	@echo "  - Access Control Panel at http://localhost:3000"
	@echo "  - Access K6 Dashboard at http://localhost:5665"

# Install dependencies
install:
	@echo "Installing dependencies..."
	cd apps/control-panel && npm install
	cd apps/mock-server && npm install
	cd apps/k6-runner-v2 && npm install

# Development mode - all services with logs
dev:
	docker compose up --build

# Start services in background
up:
	docker compose up -d --build

# Stop services
down:
	docker compose down

# Show logs
logs:
	docker compose logs -f

# Clean up
clean:
	docker compose down -v
	docker system prune -f

# Build all images with xk6 support
build: build-control build-mock build-runner-v2

# Build control panel
build-control:
	@echo "Building Control Panel..."
	docker build -t k6-control-panel:latest ./apps/control-panel

# Build mock server
build-mock:
	@echo "Building Mock Server..."
	docker build -t k6-mock-server:latest ./apps/mock-server

# Build k6 runner v2 with xk6-output-influxdb
build-runner-v2:
	@echo "Building K6 Runner v2 with xk6-output-influxdb..."
	docker build -t k6-runner:latest ./apps/k6-runner-v2

# Run tests with InfluxDB 3.x
test:
	@echo "Running load test with InfluxDB 3.x..."
	@echo "Starting test via K6 Runner API..."
	@curl -X POST http://localhost:3002/api/test/start \
		-H "Content-Type: application/json" \
		-d '{"scenario": "load", "targetUrl": "http://mock-server:3001", "duration": "30s", "vus": 10}' | jq '.'

test-stress:
	@echo "Running stress test with InfluxDB 3.x..."
	@curl -X POST http://localhost:3002/api/test/start \
		-H "Content-Type: application/json" \
		-d '{"scenario": "stress", "targetUrl": "http://mock-server:3001", "duration": "2m", "vus": 50}' | jq '.'

test-spike:
	@echo "Running spike test with InfluxDB 3.x..."
	@curl -X POST http://localhost:3002/api/test/start \
		-H "Content-Type: application/json" \
		-d '{"scenario": "spike", "targetUrl": "http://mock-server:3001", "duration": "2m", "vus": 100}' | jq '.'

test-soak:
	@echo "Running soak test (this will take a while)..."
	@curl -X POST http://localhost:3002/api/test/start \
		-H "Content-Type: application/json" \
		-d '{"scenario": "soak", "targetUrl": "http://mock-server:3001", "duration": "10m", "vus": 5}' | jq '.'

# Docker Hub Configuration
DOCKER_HUB_USER ?= leehyeontae
GIT_COMMIT := $(shell git rev-parse --short HEAD)
GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD)
BUILD_DATE := $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")

# Multi-architecture build platforms
PLATFORMS ?= linux/amd64,linux/arm64

# Check if buildx is available
BUILDX_EXISTS := $(shell docker buildx version 2>/dev/null)

# Setup buildx builder for multi-platform builds
buildx-setup:
	@if [ -z "$(BUILDX_EXISTS)" ]; then \
		echo "❌ Docker buildx not found. Please update Docker."; \
		exit 1; \
	fi
	@if ! docker buildx ls | grep -q multiplatform-builder; then \
		echo "🔧 Creating buildx builder for multi-platform builds..."; \
		docker buildx create --name multiplatform-builder --use; \
		docker buildx inspect --bootstrap; \
	else \
		echo "✅ Using existing buildx builder"; \
		docker buildx use multiplatform-builder; \
	fi

# Push images to Docker Hub with git commit tag (multi-architecture)
push: buildx-setup push-control-multi push-mock-multi push-runner-multi
	@echo "✅ All multi-architecture images pushed to Docker Hub"

# Legacy single-architecture push (for compatibility)
push-single: build push-control push-mock push-runner
	@echo "✅ All single-architecture images pushed to Docker Hub"

push-control:
	@echo "🚀 Pushing Control Panel to Docker Hub..."
	docker tag k6-control-panel:latest $(DOCKER_HUB_USER)/k6-testing-platform-control-panel:$(GIT_COMMIT)
	docker tag k6-control-panel:latest $(DOCKER_HUB_USER)/k6-testing-platform-control-panel:latest
	docker push $(DOCKER_HUB_USER)/k6-testing-platform-control-panel:$(GIT_COMMIT)
	docker push $(DOCKER_HUB_USER)/k6-testing-platform-control-panel:latest
	@echo "✅ Pushed: $(DOCKER_HUB_USER)/k6-testing-platform-control-panel:$(GIT_COMMIT)"

push-mock:
	@echo "🚀 Pushing Mock Server to Docker Hub..."
	docker tag k6-mock-server:latest $(DOCKER_HUB_USER)/k6-testing-platform-mock-server:$(GIT_COMMIT)
	docker tag k6-mock-server:latest $(DOCKER_HUB_USER)/k6-testing-platform-mock-server:latest
	docker push $(DOCKER_HUB_USER)/k6-testing-platform-mock-server:$(GIT_COMMIT)
	docker push $(DOCKER_HUB_USER)/k6-testing-platform-mock-server:latest
	@echo "✅ Pushed: $(DOCKER_HUB_USER)/k6-testing-platform-mock-server:$(GIT_COMMIT)"

push-runner:
	@echo "🚀 Pushing K6 Runner to Docker Hub..."
	docker tag k6-runner:latest $(DOCKER_HUB_USER)/k6-testing-platform-k6-runner:$(GIT_COMMIT)
	docker tag k6-runner:latest $(DOCKER_HUB_USER)/k6-testing-platform-k6-runner:latest
	docker push $(DOCKER_HUB_USER)/k6-testing-platform-k6-runner:$(GIT_COMMIT)
	docker push $(DOCKER_HUB_USER)/k6-testing-platform-k6-runner:latest
	@echo "✅ Pushed: $(DOCKER_HUB_USER)/k6-testing-platform-k6-runner:$(GIT_COMMIT)"

# Multi-architecture builds and pushes
push-control-multi: buildx-setup
	@echo "🚀 Building and pushing multi-arch Control Panel to Docker Hub..."
	docker buildx build \
		--platform $(PLATFORMS) \
		--tag $(DOCKER_HUB_USER)/k6-testing-platform-control-panel:$(GIT_COMMIT) \
		--tag $(DOCKER_HUB_USER)/k6-testing-platform-control-panel:latest \
		--push \
		./apps/control-panel
	@echo "✅ Pushed multi-arch: $(DOCKER_HUB_USER)/k6-testing-platform-control-panel:$(GIT_COMMIT)"

push-mock-multi: buildx-setup
	@echo "🚀 Building and pushing multi-arch Mock Server to Docker Hub..."
	docker buildx build \
		--platform $(PLATFORMS) \
		--tag $(DOCKER_HUB_USER)/k6-testing-platform-mock-server:$(GIT_COMMIT) \
		--tag $(DOCKER_HUB_USER)/k6-testing-platform-mock-server:latest \
		--push \
		./apps/mock-server
	@echo "✅ Pushed multi-arch: $(DOCKER_HUB_USER)/k6-testing-platform-mock-server:$(GIT_COMMIT)"

push-runner-multi: buildx-setup
	@echo "🚀 Building and pushing multi-arch K6 Runner v2 to Docker Hub..."
	docker buildx build \
		--platform $(PLATFORMS) \
		--tag $(DOCKER_HUB_USER)/k6-testing-platform-k6-runner:$(GIT_COMMIT) \
		--tag $(DOCKER_HUB_USER)/k6-testing-platform-k6-runner:latest \
		--push \
		./apps/k6-runner-v2
	@echo "✅ Pushed multi-arch: $(DOCKER_HUB_USER)/k6-testing-platform-k6-runner:$(GIT_COMMIT)"

# Pull images from Docker Hub
pull:
	@echo "📦 Pulling images from Docker Hub..."
	docker pull $(DOCKER_HUB_USER)/k6-testing-platform-control-panel:latest
	docker pull $(DOCKER_HUB_USER)/k6-testing-platform-mock-server:latest
	docker pull $(DOCKER_HUB_USER)/k6-testing-platform-k6-runner:latest
	docker tag $(DOCKER_HUB_USER)/k6-testing-platform-control-panel:latest k6-control-panel:latest
	docker tag $(DOCKER_HUB_USER)/k6-testing-platform-mock-server:latest k6-mock-server:latest
	docker tag $(DOCKER_HUB_USER)/k6-testing-platform-k6-runner:latest k6-runner:latest
	@echo "✅ All images pulled and tagged"

# Show current version info
version:
	@echo "📌 Version Information:"
	@echo "  Git Commit: $(GIT_COMMIT)"
	@echo "  Git Branch: $(GIT_BRANCH)"
	@echo "  Build Date: $(BUILD_DATE)"
	@echo "  Docker Hub User: $(DOCKER_HUB_USER)"
	@echo ""
	@echo "🏷️  Image Tags:"
	@echo "  $(DOCKER_HUB_USER)/k6-testing-platform-control-panel:$(GIT_COMMIT)"
	@echo "  $(DOCKER_HUB_USER)/k6-testing-platform-mock-server:$(GIT_COMMIT)"
	@echo "  $(DOCKER_HUB_USER)/k6-testing-platform-k6-runner:$(GIT_COMMIT)"

# Development helpers
shell-control:
	docker compose exec control-panel sh

shell-mock:
	docker compose exec mock-server sh

shell-runner:
	docker compose exec k6-runner sh

shell-postgres:
	docker compose exec postgres psql -U test_admin -d k6_test_history

# InfluxDB 3.x commands
influx-cli:
	@echo "InfluxDB 3.x Core does not have a traditional CLI."
	@echo "Use the API endpoints instead:"
	@echo "  - Health: curl http://localhost:8086/health"
	@echo "  - Query: Use SQL via /api/v2/query endpoint"

influx-health:
	@echo "Checking InfluxDB 3.x health..."
	@curl -s http://localhost:8086/health | jq '.' || echo "InfluxDB 3.x not responding"

# Initialize InfluxDB 3.x
init-influx:
	@echo "Initializing InfluxDB 3.x..."
	@docker compose exec influxdb /services/influxdb/init-influxdb.sh || echo "Run init script manually"

# Validate InfluxDB 3.x token
validate-influx:
	@echo "Validating InfluxDB 3.x token..."
	@TOKEN=$$(grep INFLUXDB_TOKEN .env | cut -d'=' -f2); \
	if [ -n "$$TOKEN" ]; then \
		echo "Testing write endpoint..."; \
		curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" \
			-H "Authorization: Token $$TOKEN" \
			"http://localhost:8086/api/v2/write?org=k6org&bucket=k6"; \
		echo "Testing query endpoint..."; \
		curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" \
			-X POST -H "Authorization: Token $$TOKEN" \
			-H "Content-Type: application/json" \
			-d '{"query":"SELECT 1","type":"sql"}' \
			"http://localhost:8086/api/v2/query?org=k6org"; \
	else \
		echo "No token found in .env file"; \
	fi

# Health checks
health:
	@echo "Checking service health..."
	@curl -s http://localhost:3001/health | jq '.' || echo "Mock server not responding"
	@curl -s http://localhost:3000 > /dev/null && echo "Control panel is running" || echo "Control panel not responding"
	@curl -s http://localhost:3002/health > /dev/null && echo "K6 Runner v2 is running" || echo "K6 Runner v2 not responding"
	@curl -s http://localhost:8086/health | jq '.' && echo "InfluxDB 3.x is running" || echo "InfluxDB 3.x not responding"
	@curl -s http://localhost:5665 > /dev/null && echo "K6 Web Dashboard is running" || echo "K6 Web Dashboard not responding"

# Restart services
restart:
	@echo "Restarting all services..."
	docker compose restart

# Clean all (including images)
clean-all:
	@echo "Cleaning up everything (containers, volumes, and images)..."
	docker compose down -v --rmi all
	docker system prune -af

# Development database commands
db-migrate:
	@echo "Running database migrations..."
	docker compose exec control-panel npm run db:migrate

db-seed:
	@echo "Seeding database..."
	docker compose exec control-panel npm run db:seed

db-reset:
	@echo "Resetting database..."
	docker compose exec control-panel npm run db:reset

# Monitoring commands
monitor:
	@echo "Opening monitoring dashboards..."
	@echo "K6 Web Dashboard: http://localhost:5665"

##########################################################
# Kubernetes (Kind) Commands - Unified Manager
##########################################################
K8S_MGR := k8s/k8s-manager.sh

.PHONY: k8s
k8s: ## Show K8s manager help
	@$(K8S_MGR) help

.PHONY: k8s-install
k8s-install: ## Install kubectl, helm, kind on macOS
	@echo "📦 Installing K8s tools..."
	@$(K8S_MGR) install

.PHONY: k8s-all
k8s-all: ## 🚀 Complete K8s setup (setup + build + deploy)
	@echo "🎯 Complete K6 Platform Setup"
	@$(K8S_MGR) all

.PHONY: k8s-setup
k8s-setup: ## Create Kind cluster
	@echo "🌐 Creating Kind cluster..."
	@$(K8S_MGR) setup

.PHONY: k8s-build
k8s-build: ## Build Docker images for K8s
	@echo "🔨 Building images..."
	@$(K8S_MGR) build

.PHONY: k8s-load
k8s-load: ## Load images to Kind cluster
	@echo "📦 Loading images to cluster..."
	@$(K8S_MGR) load

.PHONY: k8s-deploy
k8s-deploy: ## Deploy all services to K8s
	@echo "🚢 Deploying services..."
	@$(K8S_MGR) deploy

.PHONY: k8s-status
k8s-status: ## Check K8s deployment status
	@$(K8S_MGR) status

.PHONY: k8s-logs
k8s-logs: ## View logs (use: make k8s-logs SERVICE=control-panel)
	@$(K8S_MGR) logs -s $(SERVICE)

.PHONY: k8s-test
k8s-test: ## Test service endpoints
	@echo "🧪 Testing services..."
	@$(K8S_MGR) test

.PHONY: k8s-forward
k8s-forward: ## Port forward all services
	@echo "🔌 Port forwarding..."
	@$(K8S_MGR) forward

.PHONY: k8s-clean
k8s-clean: ## Clean up deployments (keep cluster)
	@echo "🧹 Cleaning deployments..."
	@$(K8S_MGR) clean

.PHONY: k8s-destroy
k8s-destroy: ## Destroy Kind cluster completely
	@echo "💥 Destroying cluster..."
	@$(K8S_MGR) destroy

# Quick test commands
test-quick:
	@echo "Running quick smoke test with InfluxDB 3.x..."
	curl -X POST http://localhost:3002/api/test/start \
		-H "Content-Type: application/json" \
		-d '{"scenario": "smoke", "targetUrl": "http://mock-server:3001", "duration": "10s", "vus": 5}' | jq '.'

test-custom:
	@echo "Running custom test with parameters..."
	@read -p "Enter VUs (default 10): " vus; \
	read -p "Enter duration (default 30s): " duration; \
	curl -X POST http://localhost:3002/api/test/start \
		-H "Content-Type: application/json" \
		-d "{\"scenario\": \"custom\", \"vus\": $${vus:-10}, \"duration\": \"$${duration:-30s}\", \"targetUrl\": \"http://mock-server:3001\"}" | jq '.'

# Status commands
status:
	@echo "Checking test status..."
	@curl -s http://localhost:3002/api/test/status | jq '.' || echo "No test running"

stop-test:
	@echo "Stopping current test..."
	@curl -X POST http://localhost:3002/api/test/stop | jq '.'

# Environment setup
setup-env:
	@echo "Setting up environment files..."
	@test -f .env || cp .env.example .env
	@test -f apps/control-panel/.env || cp apps/control-panel/.env.example apps/control-panel/.env
	@test -f apps/mock-server/.env || cp apps/mock-server/.env.example apps/mock-server/.env
	@test -f apps/k6-runner-v2/.env || cp apps/k6-runner-v2/.env.example apps/k6-runner-v2/.env
	@echo "Environment files created. Please update them with your configuration."
	@echo "Note: InfluxDB 3.x uses token authentication (INFLUXDB_TOKEN)"

# Docker network management
network-create:
	@docker network create k6-network 2>/dev/null || echo "Network already exists"

network-inspect:
	@docker network inspect k6-network | jq '.'

# Logs for specific services
logs-control:
	docker compose logs -f control-panel

logs-mock:
	docker compose logs -f mock-server

logs-runner:
	docker compose logs -f k6-runner

logs-influx:
	docker compose logs -f influxdb

# Build with no cache
rebuild:
	@echo "Rebuilding all images without cache..."
	docker compose build --no-cache

# Run specific service
run-control:
	docker compose up control-panel

run-mock:
	docker compose up mock-server

run-runner:
	docker compose up k6-runner