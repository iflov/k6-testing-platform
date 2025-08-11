FROM grafana/k6:0.52.0 AS k6-binary

FROM node:18-alpine

# k6 바이너리 복사
COPY --from=k6-binary /usr/bin/k6 /usr/bin/k6

WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./
RUN npm ci --only=production

# 소스 코드 복사
COPY index.js ./
# k6 스크립트 복사
COPY k6-scripts ./k6-scripts

# k6가 Web Dashboard를 위해 사용할 포트
EXPOSE 3002 5665

CMD ["node", "index.js"]