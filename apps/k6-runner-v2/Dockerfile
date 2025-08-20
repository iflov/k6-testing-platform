# Multi-stage build for k6-runner-v2
FROM grafana/k6:0.52.0 AS k6-binary

FROM node:22-alpine

# k6 바이너리 복사
COPY --from=k6-binary /usr/bin/k6 /usr/bin/k6

# lsof 설치 (포트 체크를 위해 필요)
RUN apk add --no-cache lsof

WORKDIR /app

# 패키지 파일 복사 및 의존성 설치 (개발 의존성 포함)
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci

# 소스 코드 복사
COPY src ./src

# .env 파일 복사
COPY .env* ./

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