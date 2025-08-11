# K6 Testing Platform

K6 웹 대시보드를 활용한 범용 부하 테스트 플랫폼

## 🎯 목적

- 사내 모든 서비스에 대한 범용적인 부하 테스트 도구
- K6 웹 대시보드를 통한 실시간 모니터링
- 프로메테우스/그라파나 연동을 위한 기반 구축
- 다양한 부하 시나리오 실행 및 분석

## 🏗️ Architecture

```
k6-testing-platform/
├── apps/
│   ├── control-panel/      # Next.js 컨트롤 패널
│   ├── mock-server/        # Express Mock 서버
│   └── k6-runner/          # K6 테스트 실행 서비스
├── k6-scripts/             # K6 테스트 시나리오
├── grafana/                # Grafana 설정
├── docker-compose.yml      # 로컬 개발 환경
└── Makefile               # 자동화 스크립트
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (로컬 개발시)
- Make (선택사항)

### 1. 프로젝트 시작

```bash
# 모든 서비스 시작 (포그라운드 - 로그 출력)
make dev

# 또는 백그라운드 실행
make up  # 또는 docker-compose up -d --build

# 백그라운드 실행 후 로그 확인
make logs  # 또는 docker-compose logs -f
```

### 2. 서비스 접속

- **Control Panel**: http://localhost:3000 - 테스트 실행 UI
- **Mock Server**: http://localhost:3001 - 테스트 타겟 서버
- **K6 Runner API**: http://localhost:3002 - K6 테스트 실행 서비스
- **K6 Web Dashboard**: http://localhost:5665 - 실시간 테스트 모니터링 (테스트 실행 시)
- **InfluxDB**: http://localhost:8086 - 메트릭 저장소

### 3. 테스트 실행 (K6 웹 대시보드 포함)

```bash
# Web Dashboard와 함께 테스트 실행
./run-test-with-dashboard.sh simple-load-test.js 50 5m

# 또는 docker-compose 사용
docker-compose --profile test up k6

# Docker로 직접 실행 (Web Dashboard 포함)
docker run --rm -it \
  --network k6-testing-platform_k6-network \
  -p 5665:5665 \
  -e VUS=50 \
  -e DURATION=5m \
  -e TARGET_URL=http://mock-server:3001 \
  -e K6_WEB_DASHBOARD=true \
  -e K6_WEB_DASHBOARD_HOST=0.0.0.0 \
  -e K6_WEB_DASHBOARD_PORT=5665 \
  -v $(pwd)/k6-scripts:/scripts:ro \
  -v $(pwd)/reports:/reports \
  grafana/k6:latest run \
  --out influxdb=http://influxdb:8086/k6 \
  --out web-dashboard \
  /scripts/scenarios/simple-load-test.js
```

테스트 실행 후 http://localhost:5665 에서 K6 웹 대시보드를 확인할 수 있습니다.

## 💻 Development

### 로컬 개발 환경 설정

```bash
# 의존성 설치
make install

# 개발 서버 시작
make dev
```

### 개별 서비스 개발

```bash
# Control Panel 개발
cd apps/control-panel
npm run dev

# Mock Server 개발
cd apps/mock-server
npm run dev
```

## 📦 Build & Deploy

### Docker 이미지 빌드

```bash
# 모든 이미지 빌드
make build

# 개별 빌드
make build-control  # Control Panel만
make build-mock     # Mock Server만
```

### 이미지 배포

```bash
# Registry 설정 후 푸시
REGISTRY=your-registry.com make push-images
```

### Kubernetes 배포 예시

각 서비스를 독립적으로 배포:

```yaml
# control-panel-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: k6-control-panel
spec:
  replicas: 1
  selector:
    matchLabels:
      app: control-panel
  template:
    metadata:
      labels:
        app: control-panel
    spec:
      containers:
      - name: control-panel
        image: your-registry.com/k6-control-panel:latest
        ports:
        - containerPort: 3000
```

## 🧪 테스트 시나리오

### 1. Simple Load Test
가장 기본적인 부하 테스트. VU 수와 기간을 자유롭게 설정 가능.

```bash
docker run --rm \
  --network k6-testing-platform_k6-network \
  -e VUS=100 \
  -e DURATION=10m \
  -e TARGET_URL=http://your-service:port \
  -e ENDPOINT=/api/endpoint \
  -v $(pwd)/k6-scripts:/scripts:ro \
  grafana/k6:latest run /scripts/scenarios/simple-load-test.js \
  --out influxdb=http://influxdb:8086/k6
```

### 2. Breakpoint Test
시스템 최대 처리 능력 찾기
- Duration: 20분
- VUs: 100 → 1000 (단계적 증가)
- 목적: 시스템이 정상 작동하는 최대 동시 사용자 수 확인

### 3. Smoke Test
최소 부하로 시스템 기본 동작 확인
- Duration: 1분
- VUs: 1
- 목적: 스크립트 검증, 기본 동작 확인

### 4. Load Test
일반적인 예상 부하 테스트
- Duration: 9분 (ramp-up/steady/ramp-down)
- VUs: 20 (조절 가능)
- 목적: 정상 운영 부하 시뮬레이션

### 5. Stress Test
시스템 한계점 찾기
- Duration: 25분
- VUs: 최대 300
- 목적: Breaking point 발견

### 6. Spike Test
갑작스러운 트래픽 증가 대응
- Duration: 13분
- VUs: 10 → 200 → 300 → 10
- 목적: 스파이크 대응 및 회복 능력

### 7. Soak Test
장시간 안정성 테스트
- Duration: 4시간+
- VUs: 30-50
- 목적: 메모리 누수, 성능 저하 감지

## 🎛️ Configuration

### Mock Server 환경변수

```env
PORT=3001
ENABLE_DELAY=true          # 응답 지연 활성화
MIN_DELAY=0                # 최소 지연 (ms)
MAX_DELAY=100              # 최대 지연 (ms)
ENABLE_ERROR_SIMULATION=true  # 에러 시뮬레이션
ERROR_RATE=5               # 에러 발생률 (%)
```

### 환경 변수

| 변수명 | 설명 | 기본값 | 예시 |
|--------|------|--------|------|
| `VUS` | Virtual Users 수 | 10 | 50, 100, 500 |
| `DURATION` | 테스트 기간 | 1m | 30s, 5m, 1h |
| `TARGET_URL` | 테스트 대상 URL | http://mock-server:3001 | http://api.example.com |
| `ENDPOINT` | 테스트 엔드포인트 | / | /api/health, /api/users |

## 📊 K6 웹 대시보드

### 주요 기능
- **실시간 메트릭**: 테스트 진행 중 실시간으로 성능 지표 확인
- **상세 차트**: Response Time, Request Rate, Error Rate 등 다양한 차트
- **테스트 컨트롤**: 테스트 일시정지, 재시작 가능
- **리포트 엑스포트**: HTML 형식으로 테스트 결과 저장

### 접속 방법
1. 테스트 실행 (`./run-test-with-dashboard.sh` 또는 `docker-compose --profile test up k6`)
2. 브라우저에서 http://localhost:5665 접속
3. 실시간 메트릭 확인

### 대시보드 탭
- **Overview**: 전체 테스트 요약
- **Timings**: 응답 시간 분석 (DNS, TCP, TLS, Request, Response)
- **Thresholds**: 성공/실패 기준 표시

## 📊 주요 메트릭

### 기본 메트릭
- `http_req_duration`: 응답 시간
- `http_req_failed`: 실패한 요청
- `http_reqs`: 초당 요청 수
- `vus`: 활성 가상 사용자
- `iterations`: 완료된 반복 수

### 성능 지표
- **P95/P99**: 95/99 백분위 응답 시간
- **RPS**: 초당 요청 수
- **Error Rate**: 에러율
- **Throughput**: 처리량

## 🛠️ Makefile Commands

```bash
make help          # 도움말 표시
make dev           # 개발 모드 시작
make up            # 백그라운드 실행
make down          # 서비스 중지
make logs          # 로그 확인
make clean         # 정리
make build         # 이미지 빌드
make test          # 테스트 실행
```

## 📝 API Endpoints

### Control Panel API

- `POST /api/k6/run` - 테스트 시작
- `POST /api/k6/stop` - 테스트 중지
- `GET /api/k6/metrics` - 메트릭 조회

### Mock Server API

- `GET /health` - 헬스 체크
- `GET /api/users` - 사용자 목록
- `GET /api/products` - 제품 목록
- `POST /api/orders` - 주문 생성
- `GET /api/heavy` - CPU 집약적 작업
- `GET /api/slow` - 느린 응답

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License

## 🆘 Troubleshooting

### Docker 권한 문제

```bash
# Docker 소켓 권한 부여
sudo chmod 666 /var/run/docker.sock
```

### 포트 충돌

기본 포트:
- 3000: Control Panel
- 3001: Mock Server  
- 5665: K6 Web Dashboard
- 8086: InfluxDB

필요시 docker-compose.yml에서 포트 변경

### 메모리 부족

Docker Desktop 설정에서 메모리 할당 증가 (최소 4GB 권장)

## 📞 Support

이슈나 질문이 있으시면 GitHub Issues를 통해 문의해주세요.