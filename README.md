# K6 Testing Platform

웹 기반 통합 부하 테스트 플랫폼 - K6와 웹 대시보드를 활용한 성능 테스트 솔루션

## 🎯 프로젝트 개요

K6 Testing Platform은 마이크로서비스 아키텍처 기반의 종합적인 부하 테스트 플랫폼입니다.
실시간 모니터링, 다양한 테스트 시나리오, 그리고 직관적인 웹 인터페이스를 제공합니다.

### 주요 특징

- **통합 웹 대시보드**: Next.js 기반 실시간 테스트 제어 및 모니터링
- **중앙 집중식 시나리오 관리**: 단일 소스로부터 모든 시나리오 설정 관리
- **다양한 테스트 시나리오**: Smoke, Load, Stress, Spike, Soak 등 7가지 내장 시나리오
- **실시간 메트릭 시각화**: K6 Web Dashboard를 통한 실시간 성능 지표 확인
- **유연한 테스트 타겟**: Mock 서버 제공 및 외부 서비스 테스트 지원
- **컨테이너 기반 아키텍처**: Docker Compose를 통한 쉬운 배포 및 확장

## 🏗️ 시스템 아키텍처

### 프로젝트 구조

```
k6-testing-platform/
├── apps/
│   ├── control-panel/      # Next.js 15 기반 웹 UI (React 19, TypeScript 5)
│   │   ├── lib/
│   │   │   └── scenario.ts    # 📌 중앙 시나리오 설정 (TypeScript)
│   │   └── components/
│   │       └── TestController.tsx  # 시나리오 설정 소비자
│   ├── mock-server/        # NestJS 10 기반 테스트 타겟 서버
│   └── k6-runner/          # Express 기반 K6 테스트 실행 서비스
│       └── scenario-config.js  # 📌 중앙 시나리오 설정 (JavaScript)
├── services/
│   └── influxdb/          # 시계열 메트릭 데이터베이스
├── docker-compose.yml      # 컨테이너 오케스트레이션
├── run-test-with-dashboard.sh  # 웹 대시보드 포함 테스트 실행
└── Makefile               # 빌드 및 배포 자동화
```

### 기술 스택

| 서비스             | 기술        | 버전   | 용도                 |
| ------------------ | ----------- | ------ | -------------------- |
| **Control Panel**  | Next.js     | 15.4.6 | 웹 UI 및 테스트 제어 |
|                    | React       | 19.1.0 | UI 컴포넌트          |
|                    | TypeScript  | 5.x    | 타입 안정성          |
|                    | TailwindCSS | 4.x    | 스타일링             |
| **Mock Server**    | NestJS      | 10.x   | RESTful API 모킹     |
|                    | TypeScript  | 5.x    | 타입 안정성          |
| **K6 Runner**      | Express     | 4.18.x | K6 실행 관리         |
|                    | Node.js     | 20+    | 런타임               |
| **Testing Engine** | K6          | Latest | 부하 테스트 엔진     |
| **Database**       | InfluxDB    | 1.8    | 메트릭 저장          |
| **Container**      | Docker      | 20+    | 컨테이너화           |

### 아키텍처 특징

#### 🎯 중앙 집중식 시나리오 관리

시나리오 설정이 중앙에서 관리되어 일관성과 유지보수성이 향상되었습니다:

- **단일 진실 공급원 (Single Source of Truth)**: 모든 시나리오 메타데이터가 한 곳에서 정의
- **타입 안정성**: TypeScript 인터페이스로 시나리오 설정 검증
- **동적 설정**: 실행 시간에 시나리오별 설정 동적 적용
- **코드 중복 제거**: ~200줄의 중복 코드 제거로 유지보수성 향상

```typescript
// apps/control-panel/lib/scenario.ts
export interface ScenarioMetadata {
  id: ScenarioId;
  name: string;
  description: string;
  defaultVus: number;
  defaultDuration: string;
  supportedModes: ExecutionModes;
  rampPattern?: RampPattern;
}
```

## 🚀 빠른 시작

### 사전 요구사항

- Docker & Docker Compose (필수)
- Node.js 20+ & npm 10+ (로컬 개발 시)
- Make (선택사항, 자동화 명령어용)
- 최소 4GB RAM (Docker Desktop)

### 1. 프로젝트 클론 및 설정

```bash
# 저장소 클론
git clone https://github.com/your-org/k6-testing-platform.git
cd k6-testing-platform

# 환경 변수 설정 (선택사항)
cp apps/control-panel/.env.example apps/control-panel/.env
cp apps/k6-runner/.env.example apps/k6-runner/.env
```

### 2. 서비스 시작

```bash
# 모든 서비스 시작 (포그라운드 - 로그 출력)
make dev

# 또는 백그라운드 실행
make up  # 또는 docker-compose up -d --build

# 백그라운드 실행 후 로그 확인
make logs  # 또는 docker-compose logs -f
```

### 3. 서비스 접속

| 서비스               | URL                   | 설명                               |
| -------------------- | --------------------- | ---------------------------------- |
| **Control Panel**    | http://localhost:3000 | 웹 기반 테스트 관리 UI             |
| **Mock Server**      | http://localhost:3001 | 테스트 타겟 API 서버               |
| **K6 Runner API**    | http://localhost:3002 | K6 실행 관리 API                   |
| **K6 Web Dashboard** | http://localhost:5665 | 실시간 메트릭 대시보드 (테스트 중) |
| **InfluxDB**         | http://localhost:8086 | 시계열 메트릭 DB                   |

### 4. 테스트 실행

#### 방법 1: Control Panel UI 사용 (권장)

1. http://localhost:3000 접속
2. 테스트 시나리오 선택
3. VU 수와 기간 설정
4. "Start Test" 클릭

#### 방법 2: Docker Compose 사용

```bash
# 환경 변수와 함께 실행
VUS=50 DURATION=5m docker-compose --profile test up k6
```

## 💻 개발 환경

### 로컬 개발 환경 설정

```bash
# 전체 프로젝트 의존성 설치
make install

# 개발 서버 시작 (모든 서비스)
make dev

# 서비스 상태 확인
docker-compose ps
```

### 개별 서비스 개발

#### Control Panel (Next.js)

```bash
cd apps/control-panel
npm install
npm run dev  # http://localhost:3000
```

#### Mock Server (NestJS)

```bash
cd apps/mock-server
npm install
npm run start:dev  # http://localhost:3001
```

#### K6 Runner (Express)

```bash
cd apps/k6-runner
npm install
npm run dev  # http://localhost:3002
```

### 코드 품질 관리

```bash
# Control Panel
cd apps/control-panel
npm run lint
npm run build

# Mock Server
cd apps/mock-server
npm run lint
npm run test
npm run test:cov  # 커버리지 확인
```

## 🧪 테스트 시나리오

플랫폼에서 제공하는 7가지 사전 정의된 테스트 시나리오:

### 시나리오 관리 시스템

모든 시나리오는 중앙 설정 파일에서 관리되며, 각 시나리오마다 다음 속성들이 정의됩니다:

- **기본 설정**: VUs 수, 실행 시간, 반복 횟수
- **실행 모드**: Duration, Iterations, Hybrid 지원 여부
- **Ramp 패턴**: none, standard, aggressive, gradual
- **Stage 사용**: 단계적 부하 증가 여부

### 📊 시나리오 비교표

| 시나리오       | 용도             | 기본 VUs | 기본 기간 | 실행 모드           | Ramp 패턴   |
| -------------- | ---------------- | -------- | --------- | ------------------- | ----------- |
| **Smoke**      | 기본 동작 확인   | 1        | 1m        | ✅ All              | none        |
| **Load**       | 일반 부하 테스트 | 20       | 5m        | Duration, Hybrid    | standard    |
| **Stress**     | 한계 테스트      | 50       | 10m       | Duration only       | gradual     |
| **Spike**      | 급증 대응        | 100      | 5m        | Duration only       | aggressive  |
| **Soak**       | 장기 안정성      | 30       | 30m       | ✅ All              | none        |
| **Breakpoint** | 최대 용량        | 100      | 20m       | Duration only       | gradual     |
| **Simple**     | 커스텀 테스트    | 10       | 2m        | ✅ All              | none        |

### 상세 시나리오 설명

#### 1. 🚬 Smoke Test

```javascript
// 최소 부하로 시스템 정상 작동 확인
executor: 'constant-vus',
vus: 1,
duration: '1m'
```

- **용도**: 배포 후 기본 기능 검증
- **실행 모드**: Duration, Iterations, Hybrid 모두 지원
- **성공 기준**: 에러율 0%, 응답시간 < 1초

#### 2. 📈 Load Test

```javascript
// 표준 ramp 패턴 적용 (15% up, 70% steady, 15% down)
executor: 'ramping-vus',
startVUs: 1,
stages: [
  { duration: '45s', target: 20 },  // Ramp-up (15%)
  { duration: '3m30s', target: 20 }, // Steady (70%)
  { duration: '45s', target: 0 }     // Ramp-down (15%)
]
```

- **용도**: 일상적인 트래픽 처리 능력 평가
- **실행 모드**: Duration, Hybrid (Iterations 미지원 - ramp 패턴 때문)
- **성공 기준**: 에러율 < 1%, P95 < 500ms

#### 3. 💪 Stress Test

```javascript
// 점진적(gradual) 부하 증가 패턴
executor: 'ramping-vus',
stages: [
  { duration: '2m', target: 12 },  // Step 1 (25%)
  { duration: '2m', target: 25 },  // Step 2 (50%)
  { duration: '2m', target: 37 },  // Step 3 (75%)
  { duration: '2m', target: 50 },  // Step 4 (100%)
  { duration: '2m', target: 0 }    // Ramp-down
]
```

- **용도**: Breaking point 발견 및 복구 능력 테스트
- **실행 모드**: Duration만 지원 (단계적 부하 증가 필요)
- **관찰 포인트**: CPU/메모리 사용률, 에러 발생 시점

#### 4. ⚡ Spike Test

```javascript
// 공격적(aggressive) 스파이크 패턴
executor: 'ramping-vus',
startVUs: 10,  // 기본 VUs의 10%에서 시작
stages: [
  { duration: '1m30s', target: 20 },   // 평상시 (20%)
  { duration: '15s', target: 100 },    // 급증! (5%)
  { duration: '1m30s', target: 100 },  // 스파이크 유지 (30%)
  { duration: '15s', target: 20 },     // 급감! (5%)
  { duration: '1m30s', target: 20 }    // 평상시 복귀 (30%)
]
```

- **용도**: 블랙프라이데이, 이벤트 트래픽 대응 능력
- **실행 모드**: Duration만 지원 (정밀한 타이밍 제어 필요)
- **성공 기준**: 복구 시간 < 1분, 데이터 무결성 유지

#### 5. 🏊 Soak Test

```javascript
// 장시간 일정 부하 유지
executor: 'constant-vus',
vus: 30,
duration: '30m'  // 기본 30분, 최대 24시간까지 확장 가능
```

- **용도**: 메모리 누수, 리소스 고갈 검증
- **실행 모드**: Duration, Iterations, Hybrid 모두 지원
- **관찰 포인트**: 메모리 사용 추세, 응답시간 변화

#### 6. 🎯 Breakpoint Test

```javascript
// 점진적(gradual) 부하 증가로 한계점 탐색
executor: 'ramping-vus',
stages: [
  { duration: '4m', target: 25 },   // Step 1 (25%)
  { duration: '4m', target: 50 },   // Step 2 (50%)
  { duration: '4m', target: 75 },   // Step 3 (75%)
  { duration: '4m', target: 100 },  // Step 4 (100%)
  { duration: '4m', target: 0 }     // Ramp-down
]
```

- **용도**: 최대 처리 용량 확인
- **실행 모드**: Duration만 지원 (연속적인 부하 증가 필요)
- **중단 조건**: 에러율 > 5% 또는 P95 > 2초

#### 7. 🎯 Simple Test

```javascript
// 사용자 정의 가능한 기본 테스트
executor: 'constant-vus',
vus: 10,
duration: '2m'
```

- **용도**: 커스터마이징 가능한 기본 부하 테스트
- **실행 모드**: Duration, Iterations, Hybrid 모두 지원
- **특징**: 가장 유연한 설정 가능

## ⚙️ 설정 및 환경 변수

### 서비스별 환경 변수

#### Control Panel (.env)

```env
# K6 Runner 연결
K6_RUNNER_BASE_URL=http://k6-runner:3002

# Mock Server URL
MOCK_SERVER_URL=http://mock-server:3001

# K6 Dashboard URL
K6_DASHBOARD_URL=http://localhost:5665

# InfluxDB 설정
K6_INFLUXDB_URL=http://influxdb:8086
K6_INFLUXDB_DB=k6
```

#### K6 Runner (.env)

```env
# 서비스 포트
PORT=3002

# InfluxDB 설정
INFLUXDB_URL=http://influxdb:8086

# K6 Dashboard 설정
K6_DASHBOARD_PORT=5665
K6_DASHBOARD_HOST=0.0.0.0

# Mock Server URL
MOCK_SERVER_URL=http://mock-server:3001
```

#### Mock Server 환경 변수

```env
# 서비스 포트
PORT=3001

# 응답 지연 시뮬레이션
ENABLE_DELAY=true          # 응답 지연 활성화
MIN_DELAY=0                # 최소 지연 (ms)
MAX_DELAY=100              # 최대 지연 (ms)

# 에러 시뮬레이션
ENABLE_ERROR_SIMULATION=true  # 에러 시뮬레이션
ERROR_RATE=5               # 에러 발생률 (%)

# 리소스 제한 시뮬레이션
ENABLE_RATE_LIMIT=false    # Rate limiting
RATE_LIMIT_MAX=100         # 분당 최대 요청 수
```

### K6 테스트 환경 변수

| 변수명                  | 설명               | 기본값                  | 예시                    |
| ----------------------- | ------------------ | ----------------------- | ----------------------- |
| `VUS`                   | Virtual Users 수   | 10                      | 50, 100, 500            |
| `DURATION`              | 테스트 기간        | 1m                      | 30s, 5m, 1h             |
| `TARGET_URL`            | 테스트 대상 URL    | http://mock-server:3001 | http://api.example.com  |
| `ENDPOINT`              | 테스트 엔드포인트  | /                       | /api/health, /api/users |
| `K6_WEB_DASHBOARD`      | 웹 대시보드 활성화 | true                    | true, false             |
| `K6_WEB_DASHBOARD_PORT` | 대시보드 포트      | 5665                    | 5665, 8080              |
| `THINK_TIME`            | 요청 간 대기 시간  | 1s                      | 0s, 500ms, 2s           |

## 📊 K6 웹 대시보드

### 실시간 모니터링 기능

K6 Web Dashboard는 테스트 실행 중 실시간으로 성능 메트릭을 시각화합니다.

#### 주요 기능

- **🔴 실시간 메트릭 업데이트**: 1초 단위 실시간 갱신
- **📈 인터랙티브 차트**: 줌, 패닝 가능한 시계열 그래프
- **🎯 임계값 모니터링**: Pass/Fail 상태 실시간 표시
- **💾 리포트 저장**: HTML/JSON 형식 내보내기
- **⏸️ 테스트 제어**: 일시정지/재개/중지 기능

#### 대시보드 섹션

| 섹션           | 내용             | 주요 지표                         |
| -------------- | ---------------- | --------------------------------- |
| **Overview**   | 테스트 요약 정보 | VUs, RPS, Error Rate, Duration    |
| **Timings**    | 응답 시간 분해   | DNS, TCP, TLS, Waiting, Receiving |
| **Thresholds** | 성공 기준 상태   | Pass/Fail 상태, 임계값            |
| **HTTP**       | HTTP 메트릭      | Status Codes, Request Rate        |
| **Checks**     | 검증 결과        | Pass Rate, Failed Checks          |

### 메트릭 상세 설명

#### 핵심 성능 지표

| 메트릭                | 설명             | 정상 범위  | 경고 수준 |
| --------------------- | ---------------- | ---------- | --------- |
| **http_req_duration** | 전체 요청 시간   | < 500ms    | > 1s      |
| **http_req_waiting**  | 서버 처리 시간   | < 200ms    | > 500ms   |
| **http_req_failed**   | 실패율           | < 1%       | > 5%      |
| **http_reqs**         | 초당 요청 수     | 시나리오별 | -         |
| **vus**               | 활성 가상 사용자 | 설정값     | -         |
| **data_received**     | 수신 데이터양    | -          | -         |
| **data_sent**         | 송신 데이터양    | -          | -         |

#### 백분위수 지표

```javascript
// K6 임계값 설정 예시
export let options = {
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    http_req_failed: ["rate<0.1"],
    http_reqs: ["rate>100"],
  },
};
```

- **P50 (Median)**: 중간값, 일반적인 사용자 경험
- **P90**: 상위 10% 느린 요청
- **P95**: 상위 5% 느린 요청 (SLA 기준)
- **P99**: 상위 1% 느린 요청 (극단적 케이스)

## 🛠️ CLI 명령어

### Makefile 명령어

```bash
# 기본 명령어
make help          # 사용 가능한 명령어 목록
make dev           # 개발 모드 시작 (포그라운드)
make up            # 백그라운드 실행
make down          # 서비스 중지
make restart       # 서비스 재시작
make logs          # 실시간 로그 확인
make ps            # 서비스 상태 확인

# 빌드 명령어
make build         # 모든 이미지 빌드
make build-control # Control Panel 빌드
make build-mock    # Mock Server 빌드
make build-runner  # K6 Runner 빌드

# 테스트 명령어
make test          # 기본 테스트 실행
make test-load     # Load 테스트 실행
make test-stress   # Stress 테스트 실행

# 정리 명령어
make clean         # 컨테이너 및 볼륨 정리
make clean-all     # 이미지 포함 전체 정리
```

## 📝 API 명세

### Control Panel API

| 엔드포인트        | 메소드 | 설명             | 요청 본문                              |
| ----------------- | ------ | ---------------- | -------------------------------------- |
| `/api/k6/run`     | POST   | 테스트 시작      | `{scenario, vus, duration, targetUrl}` |
| `/api/k6/stop`    | POST   | 테스트 중지      | -                                      |
| `/api/k6/status`  | GET    | 테스트 상태 조회 | -                                      |
| `/api/k6/metrics` | GET    | 메트릭 조회      | -                                      |

#### 테스트 시작 예시

```bash
curl -X POST http://localhost:3000/api/k6/run \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "load-test",
    "vus": 50,
    "duration": "5m",
    "targetUrl": "http://api.example.com"
  }'
```

### Mock Server API

| 엔드포인트       | 메소드 | 설명                 | 응답 시간 |
| ---------------- | ------ | -------------------- | --------- |
| `/health`        | GET    | 헬스 체크            | 즉시      |
| `/api/users`     | GET    | 사용자 목록 (페이징) | 0-100ms   |
| `/api/users/:id` | GET    | 사용자 상세          | 0-100ms   |
| `/api/products`  | GET    | 제품 목록            | 0-100ms   |
| `/api/orders`    | POST   | 주문 생성            | 100-500ms |
| `/api/heavy`     | GET    | CPU 집약 작업        | 1-3s      |
| `/api/slow`      | GET    | 느린 응답 시뮬레이션 | 3-5s      |
| `/api/error`     | GET    | 에러 시뮬레이션      | 5% 실패율 |

### K6 Runner API

| 엔드포인트     | 메소드 | 설명                  |
| -------------- | ------ | --------------------- |
| `/test/start`  | POST   | K6 테스트 시작        |
| `/test/stop`   | POST   | 실행 중인 테스트 중지 |
| `/test/status` | GET    | 테스트 상태 확인      |
| `/health`      | GET    | 서비스 헬스 체크      |
| `/config`      | GET    | 현재 설정 확인        |

### InfluxDB 데이터 쿼리

```sql
-- 평균 응답 시간 조회
SELECT mean("value") FROM "http_req_duration"
WHERE time > now() - 1h
GROUP BY time(10s)

-- 에러율 계산
SELECT sum("value") FROM "http_req_failed"
WHERE time > now() - 1h
```

## 🐛 문제 해결

### 일반적인 문제와 해결법

#### 1. Docker 권한 오류

```bash
# 해결법 1: Docker 그룹에 사용자 추가
sudo usermod -aG docker $USER
newgrp docker

# 해결법 2: Docker 소켓 권한 변경
sudo chmod 666 /var/run/docker.sock
```

#### 2. 포트 충돌

```bash
# 사용 중인 포트 확인
lsof -i :3000
netstat -tulpn | grep 3000

# docker-compose.yml에서 포트 변경
ports:
  - "3001:3000"  # 호스트:컨테이너
```

#### 3. 메모리 부족

- Docker Desktop: Preferences → Resources → Memory를 4GB 이상으로 설정
- Linux: `/etc/docker/daemon.json` 수정

#### 4. 네트워크 연결 실패

```bash
# 네트워크 재생성
docker-compose down
docker network prune
docker-compose up -d
```

#### 5. K6 Dashboard 접속 불가

```bash
# 포트 확인
docker-compose logs k6-runner | grep "Dashboard"

# 방화벽 규칙 확인
sudo ufw allow 5665/tcp
```

### 성능 최적화 팁

1. **Docker 리소스 할당**: CPU 4코어, 메모리 8GB 권장
2. **InfluxDB 튜닝**: Write buffer 크기 증가
3. **K6 최적화**: `--no-thresholds --no-summary` 옵션으로 오버헤드 감소

## 📚 추가 리소스

### 공식 문서

- [K6 Documentation](https://k6.io/docs/)
- [Next.js Documentation](https://nextjs.org/docs)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Docker Documentation](https://docs.docker.com/)

### 관련 프로젝트

- [K6 Examples](https://github.com/grafana/k6-examples)
- [K6 Extensions](https://k6.io/docs/extensions/)

### 튜토리얼

- [K6 Performance Testing Guide](https://k6.io/docs/testing-guides/)
- [Load Testing Best Practices](https://k6.io/docs/testing-guides/load-testing-websites/)

<div align="center">
  <strong>Built with ❤️ for Performance Testing</strong>
  <br>
  <sub>Making load testing accessible and powerful</sub>
</div>
