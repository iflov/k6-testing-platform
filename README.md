# K6 Testing Platform

웹 기반 부하 테스트 플랫폼. Control Panel UI에서 테스트를 설정하고, K6 엔진으로 실행하며, 실시간 메트릭을 모니터링합니다.

## 아키텍처

```
┌─────────────────┐     ┌─────────────┐     ┌──────────────────┐
│  Control Panel  │────▶│  K6 Runner  │────▶│   Target Server  │
│  (Next.js 15)   │     │  (Express)  │     │  (Mock or Custom)│
│  :3000          │     │  :3002      │     │  :3001           │
└────────┬────────┘     └──────┬──────┘     └──────────────────┘
         │                     │
    ┌────▼────┐          ┌─────▼──────┐
    │ Postgres│          │ InfluxDB 3 │
    │ :5432   │          │ :8181      │
    └─────────┘          └────────────┘
```

| 서비스 | 기술 | 역할 |
|--------|------|------|
| **Control Panel** | Next.js 15, Prisma, TailwindCSS | 테스트 제어 UI + API |
| **K6 Runner** | Express, TypeScript, xk6 | K6 스크립트 생성 및 실행 |
| **Mock Server** | NestJS | 부하 테스트 타겟 (샌드박스) |
| **PostgreSQL** | 16-alpine | 테스트 이력 저장 |
| **InfluxDB** | 3.x Core | 시계열 메트릭 저장 |

### Mock Server 역할

Mock Server는 **실서버를 대체하는 것이 아니라, 플랫폼 자체의 동작을 검증하는 샌드박스**입니다.
외부 서버 없이도 파이프라인(K6 실행 → 메트릭 수집 → 대시보드 표시)이 정상 동작하는지 확인할 수 있습니다.
실제 부하 테스트 시에는 Control Panel에서 `targetUrl`을 실서버 주소로 지정합니다.

## 빠른 시작

### 사전 요구사항

- Docker Engine 또는 Docker Desktop (Compose v2 포함)
- 최소 4GB RAM

### 실행

```bash
# 1. 로컬 Docker 실행 준비
make local-setup

# 2. 로컬 Docker 스택 시작
make local-up

# 3. 상태 확인
make local-health

# 필요하면 로그 확인 / 종료
make local-logs
make local-down
```

### 접속

| 서비스 | URL | 설명 |
|--------|-----|------|
| Control Panel | http://localhost:3000 | 테스트 관리 UI |
| Test History | http://localhost:3000/history | 테스트 이력 조회 |
| Mock Server | http://localhost:3001 | 테스트 타겟 서버 |
| K6 Runner API | http://localhost:3002 | K6 실행 관리 |
| K6 Dashboard | http://localhost:5665 | 실시간 메트릭 (테스트 중) |
| InfluxDB | http://localhost:8181 | 시계열 DB |

> 포트는 `.env`에서 변경 가능합니다.
> Kubernetes를 쓰지 않고 **최소 로컬 Docker로만** 실행하려면 `make local-up` 경로만 사용하면 됩니다.

## 테스트 실행

### UI (권장)

1. http://localhost:3000 접속
2. Target Server 선택 (Mock Server 또는 Custom URL 입력)
3. 시나리오, VU 수, 기간 설정
4. "Start Test" 클릭

### CLI

```bash
make local-test-quick              # 로컬 Docker smoke 테스트
make local-status                  # 로컬 Docker 테스트 상태 확인
make local-stop                    # 로컬 Docker 테스트 중지

# 기존 target도 계속 사용 가능
make test-quick                    # Smoke 테스트 (10s, 5 VUs)
make test                          # Load 테스트 (30s, 10 VUs)
make test-stress                   # Stress 테스트 (2m, 50 VUs)
```

### API

```bash
curl -X POST http://localhost:3000/api/k6/run \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "load",
    "vus": 20,
    "duration": "5m",
    "targetUrl": "https://api.example.com",
    "urlPath": "/v1/products",
    "httpMethod": "GET"
  }'
```

## 테스트 시나리오

| 시나리오 | 용도 | 기본 VUs | 기본 기간 | 패턴 |
|----------|------|----------|-----------|------|
| **Smoke** | 기본 동작 확인 | 1 | 1m | 일정 부하 |
| **Load** | 일반 부하 테스트 | 20 | 5m | Ramp up → Steady → Ramp down |
| **Stress** | 한계 테스트 | 50 | 10m | 단계적 증가 |
| **Spike** | 급증 대응 | 100 | 5m | 급격한 스파이크 |
| **Soak** | 장기 안정성 | 30 | 30m | 일정 부하 (장시간) |
| **Breakpoint** | 최대 용량 탐색 | 100 | 20m | 단계적 증가 |
| **Simple** | 커스텀 테스트 | 10 | 2m | 일정 부하 |

각 시나리오는 Duration, Iterations, Hybrid 실행 모드를 지원합니다 (일부 제한 있음).

## Mock Server API

테스트 타겟으로 사용되는 엔드포인트:

| 엔드포인트 | 설명 |
|------------|------|
| `GET /health` | 헬스 체크 |
| `GET /ready` | 준비 상태 확인 |
| `GET /success` | 200 정상 응답 |
| `POST /success` | 201 정상 응답 |
| `GET /performance/slow?delay=3000` | 지연 응답 시뮬레이션 |
| `GET /performance/timeout?timeout=30000` | 타임아웃 시뮬레이션 |
| `GET /performance/variable-latency?min=100&max=3000` | 랜덤 지연 |
| `GET /performance/concurrency-issue` | 동시성 문제 시뮬레이션 |
| `GET /chaos/random?errorRate=0.1` | 랜덤 에러 주입 |
| `POST /chaos/config` | Chaos 설정 변경 |

Chaos Middleware를 통해 모든 엔드포인트에 헤더 기반 에러 주입도 가능합니다:
```
x-chaos-enabled: true
x-chaos-error-rate: 0.2
x-chaos-status-codes: 500,503
```

## 프로젝트 구조

```
k6-testing-platform/
├── apps/
│   ├── control-panel/        # Next.js 15 UI + API (Prisma/PostgreSQL)
│   ├── mock-server/          # NestJS 테스트 타겟 서버
│   └── k6-runner-v2/         # Express K6 실행 서비스 (xk6 확장)
├── services/
│   ├── influxdb/             # InfluxDB 초기화 스크립트
│   └── postgres/             # PostgreSQL init SQL
├── helm/k6-platform/         # Helm 차트 (Kind/GKE)
├── argocd/                   # ArgoCD GitOps 매니페스트
├── docs/                     # 아키텍처/운영 문서
├── docker-compose.yml
└── Makefile
```

## 배포

### 로컬 (Docker Compose)

```bash
make local-setup
make local-up
make local-health
```

### Kubernetes (Kind)

```bash
make k8s-install    # kubectl, helm, kind 설치
make k8s-all        # 클러스터 생성 → 빌드 → 배포
make k8s-forward    # 포트 포워딩
make k8s-status     # 상태 확인
make k8s-destroy    # 클러스터 삭제
```

### GKE (GitOps)

```
GitHub Push → GitHub Actions CI/CD → Artifact Registry → ArgoCD auto-sync → GKE
```

관련 파일:
- `helm/k6-platform/` — Helm 차트
- `argocd/` — ArgoCD Application/Project 매니페스트
- `.github/workflows/cd.yml` — CI/CD 파이프라인
- `scripts/setup-argocd.sh` — ArgoCD 설치 스크립트

ArgoCD 명령어:
```bash
make argocd-full-deploy   # ArgoCD 설치 + 앱 배포
make argocd-status        # 앱 상태 확인
make argocd-sync          # 수동 싱크
```

## 로컬 개발

```bash
# 전체 스택
make local-setup
make local-dev

# 개별 서비스 실행
cd apps/control-panel && npm install && npm run dev   # :3000
cd apps/mock-server && npm install && npm run start:dev  # :3001
cd apps/k6-runner-v2 && npm install && npm run dev    # :3002
```

## 환경 변수

루트 `.env`에서 전체 스택을 설정합니다 (`.env.example` 참조):

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `POSTGRES_USER` | `test_admin` | PostgreSQL 사용자 |
| `POSTGRES_PASSWORD` | `testpassword` | PostgreSQL 비밀번호 |
| `POSTGRES_DB` | `k6_test_history` | 데이터베이스 이름 |
| `INFLUXDB_TOKEN` | `dev-token-for-testing` | InfluxDB 인증 토큰 |
| `INFLUXDB_ORG` | `k6org` | InfluxDB 조직 |
| `INFLUXDB_BUCKET` | `k6` | InfluxDB 버킷 |
| `CONTROL_PANEL_PORT` | `3000` | Control Panel 포트 |
| `MOCK_SERVER_PORT` | `3001` | Mock Server 포트 |
| `K6_RUNNER_PORT` | `3002` | K6 Runner 포트 |
| `K6_DASHBOARD_PORT` | `5665` | K6 Web Dashboard 포트 |

Make 명령어에서 포트 오버라이드:
```bash
make test CONTROL_PANEL_PORT=3100
make test-quick CONTROL_PANEL_BASE_URL=http://localhost:3100
```

## API 요약

### Control Panel

| 엔드포인트 | 메서드 | 설명 |
|------------|--------|------|
| `/api/k6/run` | POST | 테스트 시작 |
| `/api/k6/stop` | POST | 테스트 중지 |
| `/api/k6/status` | GET | 테스트 상태 |
| `/api/k6/metrics` | GET | 메트릭 조회 |
| `/api/tests` | GET | 테스트 이력 |

### K6 Runner

| 엔드포인트 | 메서드 | 설명 |
|------------|--------|------|
| `/api/test/start` | POST | K6 테스트 시작 |
| `/api/test/stop` | POST | 테스트 중지 |
| `/api/test/status` | GET | 테스트 상태 |
| `/api/test/progress/:testId?` | GET | 진행률 |
| `/api/scenarios` | GET | 시나리오 목록 |
| `/health` | GET | 헬스 체크 |

## 문제 해결

| 문제 | 해결 |
|------|------|
| 포트 충돌 | `.env`에서 포트 변경 또는 `make test CONTROL_PANEL_PORT=3100` |
| 메모리 부족 | Docker Desktop에서 RAM 4GB 이상 할당 |
| 네트워크 오류 | `docker compose down && docker network prune && docker compose up -d` |
| K6 Dashboard 안 뜸 | 테스트 실행 중에만 접속 가능. `docker compose logs k6-runner` 확인 |
| DB 마이그레이션 실패 | `make db-migrate` 또는 `docker compose exec control-panel npm run db:migrate` |

## 문서

자세한 아키텍처 및 운영 문서는 `docs/` 디렉토리를 참조하세요:

- `docs/architecture/` — ADR, 비용 비교, 멀티클라우드 분석
- `docs/runbook/` — GitOps 데모 런북
- `docs/interview-prep/` — 포트폴리오 Q&A

## Known Issues

| 이슈 | 설명 | 우선순위 |
|------|------|----------|
| 공유 타입 없음 | Control Panel과 K6 Runner가 타입을 독립 정의. API 변경 시 수동 동기화 필요 | Medium |
| 단일 인스턴스 K6 Runner | 동시에 하나의 테스트만 실행 가능 | Low |
| 인메모리 진행률 추적 | K6 Runner 재시작 시 진행률 데이터 소실 | Medium |
| InfluxDB 무인증 모드 | 개발 환경에서 `--without-auth`로 실행. 프로덕션에서는 인증 필수 | High (prod) |
