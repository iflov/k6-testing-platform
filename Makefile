.PHONY: help dev build test clean install up down logs build-control build-mock push-images

# Default target
help:
	@echo "K6 Testing Platform - Makefile Commands"
	@echo ""
	@echo "Development:"
	@echo "  make install       - Install all dependencies"
	@echo "  make dev          - Start all services in development mode"
	@echo "  make up           - Start all services in background"
	@echo "  make down         - Stop all services"
	@echo "  make logs         - Show logs from all services"
	@echo "  make clean        - Clean up containers and volumes"
	@echo ""
	@echo "Building:"
	@echo "  make build        - Build all Docker images"
	@echo "  make build-control - Build control panel image"
	@echo "  make build-mock   - Build mock server image"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run load test"
	@echo "  make test-stress  - Run stress test"
	@echo "  make test-spike   - Run spike test"
	@echo "  make test-soak    - Run soak test (long running)"
	@echo ""
	@echo "Deployment:"
	@echo "  make push-images  - Push images to registry"

# Install dependencies
install:
	@echo "Installing dependencies..."
	cd apps/control-panel && npm install
	cd apps/mock-server && npm install

# Development mode - all services with logs
dev:
	docker-compose up --build

# Start services in background
up:
	docker-compose up -d --build

# Stop services
down:
	docker-compose down

# Show logs
logs:
	docker-compose logs -f

# Clean up
clean:
	docker-compose down -v
	docker system prune -f

# Build all images
build: build-control build-mock

# Build control panel
build-control:
	@echo "Building Control Panel..."
	docker build -t k6-control-panel:latest ./apps/control-panel

# Build mock server
build-mock:
	@echo "Building Mock Server..."
	docker build -t k6-mock-server:latest ./apps/mock-server

# Run tests
test:
	@echo "Running load test..."
	docker-compose run --rm k6 run /scripts/scenarios/load-test.js \
		--out influxdb=http://influxdb:8086/k6 \
		-e TARGET_URL=http://mock-server:3001 \
		-e VUS=10 \
		-e DURATION=1m

test-stress:
	@echo "Running stress test..."
	docker-compose run --rm k6 run /scripts/scenarios/stress-test.js \
		--out influxdb=http://influxdb:8086/k6 \
		-e TARGET_URL=http://mock-server:3001

test-spike:
	@echo "Running spike test..."
	docker-compose run --rm k6 run /scripts/scenarios/spike-test.js \
		--out influxdb=http://influxdb:8086/k6 \
		-e TARGET_URL=http://mock-server:3001

test-soak:
	@echo "Running soak test (this will take a while)..."
	docker-compose run --rm k6 run /scripts/scenarios/soak-test.js \
		--out influxdb=http://influxdb:8086/k6 \
		-e TARGET_URL=http://mock-server:3001 \
		-e VUS=5 \
		-e DURATION=10m

# Push images to registry (configure REGISTRY variable)
REGISTRY ?= your-registry.com
push-images:
	@echo "Tagging and pushing images to $(REGISTRY)..."
	docker tag k6-control-panel:latest $(REGISTRY)/k6-control-panel:latest
	docker tag k6-mock-server:latest $(REGISTRY)/k6-mock-server:latest
	docker push $(REGISTRY)/k6-control-panel:latest
	docker push $(REGISTRY)/k6-mock-server:latest

# Development helpers
shell-control:
	docker-compose exec control-panel sh

shell-mock:
	docker-compose exec mock-server sh

influx-cli:
	docker-compose exec influxdb influx -database k6

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
	@curl -s http://localhost:8086/ping > /dev/null && echo "InfluxDB is running" || echo "InfluxDB not responding"
	@curl -s http://localhost:8888 > /dev/null && echo "Chronograf is running" || echo "Chronograf not responding"