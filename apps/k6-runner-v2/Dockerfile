# Multi-stage build for k6-runner-v2 with xk6-output-influxdb extension

# Stage 1: Build custom k6 with xk6-output-influxdb extension
FROM golang:1.23-alpine AS xk6-builder

# Install build dependencies
RUN apk add --no-cache git

# Install xk6 (use a specific version that works with Go 1.23)
RUN go install go.k6.io/xk6/cmd/xk6@v0.14.0

# Build k6 with InfluxDB 3.x output extension and dashboard
RUN xk6 build \
    --with github.com/grafana/xk6-output-influxdb@latest \
    --with github.com/grafana/xk6-dashboard@latest \
    --output /k6

# Stage 2: Node.js application
FROM node:22-alpine

# Copy custom k6 binary from builder
COPY --from=xk6-builder /k6 /usr/bin/k6
RUN chmod +x /usr/bin/k6

# lsof와 curl 설치 (포트 체크와 헬스체크를 위해 필요)
RUN apk add --no-cache lsof curl

WORKDIR /app

# 패키지 파일 복사 및 의존성 설치 (개발 의존성 포함)
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci

# 소스 코드 복사
COPY src ./src

# TypeScript 빌드
RUN npm run build

# 포트 노출
# 3002: API 서버
# 5665: K6 Web Dashboard
EXPOSE 3002 5665

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# 실행 (빌드된 파일 실행)
CMD ["node", "dist/app.js"]