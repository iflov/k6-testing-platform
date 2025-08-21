.PHONY: help dev build test clean install up down logs build-control build-mock build-runner-v2 \
	push push-control push-mock push-runner pull version \
	shell-control shell-mock shell-runner shell-postgres influx-cli grafana-url chronograf-url influx-ui \
	health restart clean-all test-stress test-spike test-soak test-quick test-custom status stop-test \
	setup-env network-create network-inspect logs-control logs-mock logs-runner logs-influx rebuild \
	run-control run-mock run-runner db-migrate db-seed db-reset monitor

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
	@echo "  make build        - Build all Docker images"
	@echo "  make rebuild      - Rebuild without cache"
	@echo "  make build-control - Build control panel image"
	@echo "  make build-mock   - Build mock server image"
	@echo "  make build-runner-v2 - Build K6 runner v2 image"
	@echo ""
	@echo "🧪 Testing:"
	@echo "  make test         - Run load test"
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
	@echo "  make influx-cli   - Access InfluxDB CLI"
	@echo "  make influx-ui    - Open Chronograf UI"
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
	@echo "💡 Tips:"
	@echo "  - Use 'make setup-env' first to create .env files"
	@echo "  - Run 'make health' to verify all services are running"
	@echo "  - Access Control Panel at http://localhost:3000"
	@echo "  - Access K6 Dashboard at http://localhost:5665"

# Install dependencies
install:
	@echo "Installing dependencies..."
	cd apps/control-panel && npm install
	cd apps/mock-server && npm install
	cd apps/k6-runner-v2 && npm install
	cd apps/k6-runner && npm install

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

# Build all images
build: build-control build-mock build-runner-v2

# Build control panel
build-control:
	@echo "Building Control Panel..."
	docker build -t k6-control-panel:latest ./apps/control-panel

# Build mock server
build-mock:
	@echo "Building Mock Server..."
	docker build -t k6-mock-server:latest ./apps/mock-server

# Build k6 runner v2
build-runner-v2:
	@echo "Building K6 Runner v2..."
	docker build -t k6-runner:latest ./apps/k6-runner-v2

# Run tests
test:
	@echo "Running load test..."
	docker compose run --rm k6 run /scripts/scenarios/load-test.js \
		--out influxdb=http://influxdb:8086/k6 \
		-e TARGET_URL=http://mock-server:3001 \
		-e VUS=10 \
		-e DURATION=1m

test-stress:
	@echo "Running stress test..."
	docker compose run --rm k6 run /scripts/scenarios/stress-test.js \
		--out influxdb=http://influxdb:8086/k6 \
		-e TARGET_URL=http://mock-server:3001

test-spike:
	@echo "Running spike test..."
	docker compose run --rm k6 run /scripts/scenarios/spike-test.js \
		--out influxdb=http://influxdb:8086/k6 \
		-e TARGET_URL=http://mock-server:3001

test-soak:
	@echo "Running soak test (this will take a while)..."
	docker compose run --rm k6 run /scripts/scenarios/soak-test.js \
		--out influxdb=http://influxdb:8086/k6 \
		-e TARGET_URL=http://mock-server:3001 \
		-e VUS=5 \
		-e DURATION=10m

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

influx-cli:
	docker compose exec influxdb influx -database k6

grafana-url:
	@echo "Grafana URL: http://localhost:3002 (admin/admin123)"

chronograf-url:
	@echo "Chronograf URL: http://localhost:8888"
	@echo "InfluxDB Web UI for viewing K6 metrics directly"

influx-ui:
	@echo "Opening Chronograf (InfluxDB Web UI)..."
	@echo "URL: http://localhost:8888"
	@command -v open >/dev/null 2>&1 && open http://localhost:8888 || echo "Please open http://localhost:8888 in your browser"

# Health checks
health:
	@echo "Checking service health..."
	@curl -s http://localhost:3001/health | jq '.' || echo "Mock server not responding"
	@curl -s http://localhost:3000 > /dev/null && echo "Control panel is running" || echo "Control panel not responding"
	@curl -s http://localhost:3002/health > /dev/null && echo "K6 Runner v2 is running" || echo "K6 Runner v2 not responding"
	@curl -s http://localhost:8086/ping > /dev/null && echo "InfluxDB is running" || echo "InfluxDB not responding"
	@curl -s http://localhost:8888 > /dev/null && echo "Chronograf is running" || echo "Chronograf not responding"
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
	@echo "Chronograf (InfluxDB): http://localhost:8888"
	@echo "Control Panel: http://localhost:3000"

# Quick test commands
test-quick:
	@echo "Running quick smoke test..."
	curl -X POST http://localhost:3000/api/k6/run \
		-H "Content-Type: application/json" \
		-d '{"scenario": "smoke", "target": "http://mock-server:3001"}' | jq '.'

test-custom:
	@echo "Running custom test with parameters..."
	@read -p "Enter VUs (default 10): " vus; \
	read -p "Enter duration (default 30s): " duration; \
	curl -X POST http://localhost:3000/api/k6/run \
		-H "Content-Type: application/json" \
		-d "{\"scenario\": \"custom\", \"vus\": $${vus:-10}, \"duration\": \"$${duration:-30s}\", \"target\": \"http://mock-server:3001\"}" | jq '.'

# Status commands
status:
	@echo "Checking test status..."
	@curl -s http://localhost:3000/api/k6/status | jq '.' || echo "No test running"

stop-test:
	@echo "Stopping current test..."
	@curl -X DELETE http://localhost:3000/api/k6/run | jq '.'

# Environment setup
setup-env:
	@echo "Setting up environment files..."
	@test -f apps/control-panel/.env || cp apps/control-panel/.env.example apps/control-panel/.env
	@test -f apps/mock-server/.env || cp apps/mock-server/.env.example apps/mock-server/.env
	@test -f apps/k6-runner-v2/.env || cp apps/k6-runner-v2/.env.example apps/k6-runner-v2/.env
	@echo "Environment files created. Please update them with your configuration."

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