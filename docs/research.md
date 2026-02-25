# 조사: K6 Testing Platform - 전체 프로젝트 구조 조사

_생성일: 2026-02-25 | 범위: 3개 애플리케이션, 인프라 설정, CI/CD 파이프라인 포함 56개 이상의 파일_

---

## 1. 시스템 개요

K6 Testing Platform은 웹 UI를 통해 K6 성능 테스트를 관리하는 **마이크로서비스 기반 부하 테스트 플랫폼**입니다. 시스템은 3계층 아키텍처를 따릅니다:

```
[브라우저] --> [Control Panel (Next.js 15)] --> [K6 Runner (Express)] --> [K6 바이너리]
                      |                              |
                      v                              v
               [PostgreSQL 16]              [InfluxDB 3.x Core]
                      |                              |
                      v                              v
              (테스트 이력)               (실시간 메트릭)
                                                     |
                                                     v
                                          [K6 Web Dashboard :5665]

[Mock Server (NestJS 10)] <--- 카오스 엔지니어링을 지원하는 테스트 대상 서버
```

### 주요 아키텍처 결정 사항

- **워크스페이스 매니저 없는 모노레포**: `apps/` 내 각 앱은 독립적 (자체 `package.json`, turborepo/nx 미사용)
- **싱글톤 패턴** 적극 사용: `Config`, `ConfigService`, `Container` 모두 싱글톤 적용
- **수동 DI 컨테이너**: K6 Runner는 프레임워크 대신 직접 구현한 DI 컨테이너 (`container.ts`) 사용
- **InfluxDB 3.x Core**: InfluxQL 대신 최신 SQL 기반 쿼리 API (`/api/v3/query_sql`) 사용
- **xk6 커스텀 빌드**: K6 바이너리를 `xk6-output-influxdb` 및 `xk6-dashboard` 확장과 함께 커스텀 빌드
- **Prisma ORM**: Control Panel에서 PostgreSQL 접근에 Prisma 사용 (마이그레이션 생성 포함)
- **공유 패키지 없음**: 시나리오 설정이 Control Panel (`lib/scenario.ts`)과 K6 Runner (`utils/constants.ts`) 사이에 중복 정의됨

---

## 2. 프로젝트 파일 구조

```
k6-testing-platform/
├── .env                          # 루트 환경 변수 (DB 인증정보, InfluxDB, 포트)
├── .env.example                  # .env 템플릿
├── docker-compose.yml            # 5개 서비스: control-panel, mock-server, influxdb, k6-runner, postgres
├── Makefile                      # ~800줄, 빌드/배포/테스트 자동화
├── bitbucket-pipelines.yml       # CI/CD: 테스트 -> Docker 빌드/푸시 -> IAC 저장소 업데이트
├── deploy-to-k8s.sh              # K8s 배포 (Kind 로컬 / ArgoCD / EKS)
│
├── apps/
│   ├── control-panel/            # Next.js 15, React 19, TypeScript 5, Prisma 6
│   │   ├── app/                  # Next.js App Router
│   │   │   ├── page.tsx          # 메인 대시보드 (테스트 제어 + 메트릭)
│   │   │   ├── layout.tsx        # 루트 레이아웃 (Navigation 포함)
│   │   │   ├── history/page.tsx  # 테스트 이력 페이지
│   │   │   ├── globals.css       # Tailwind CSS
│   │   │   └── api/
│   │   │       ├── k6/
│   │   │       │   ├── run/route.ts       # POST: 테스트 시작, GET: 상태, DELETE: 중지
│   │   │       │   ├── stop/route.ts      # POST: 테스트 중지 + DB 업데이트
│   │   │       │   ├── status/route.ts    # GET: 경량 상태 확인
│   │   │       │   ├── metrics/route.ts   # GET: InfluxDB 3.x SQL 메트릭 쿼리
│   │   │       │   └── progress/
│   │   │       │       ├── route.ts           # GET: 현재 진행 상황
│   │   │       │       └── [testId]/route.ts  # GET: testId별 진행 상황
│   │   │       ├── tests/
│   │   │       │   ├── route.ts           # GET: 페이지네이션된 테스트 이력
│   │   │       │   ├── [id]/route.ts      # GET: id 또는 testId로 단일 테스트 조회
│   │   │       │   └── complete/route.ts  # POST: 테스트 결과 저장
│   │   │       ├── health/route.ts        # GET: 헬스 체크 (설정 확인만)
│   │   │       └── ready/route.ts         # GET: 준비 상태 (실제 연결 확인)
│   │   ├── components/
│   │   │   ├── TestController.tsx    # 테스트 설정 폼 (~1007줄)
│   │   │   ├── TestResults.tsx       # 실시간 메트릭 표시
│   │   │   ├── TestProgress.tsx      # 원형 인디케이터가 있는 진행률 바
│   │   │   ├── TestStatus.tsx        # 상태 배지 + K6 대시보드 링크
│   │   │   ├── TestHistory.tsx       # 필터/정렬/검색 기능이 있는 이력 테이블
│   │   │   └── Navigation.tsx        # 반응형 모바일 메뉴가 있는 상단 네비게이션
│   │   ├── lib/
│   │   │   ├── scenario.ts           # 시나리오 타입 정의 및 설정 (프론트엔드)
│   │   │   └── config.ts             # 환경 감지 기능이 있는 싱글톤 Config (K8s 인식)
│   │   ├── src/lib/prisma.ts         # Prisma 클라이언트 싱글톤
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # TestRun + TestResult 모델
│   │   │   └── migrations/           # PostgreSQL 마이그레이션
│   │   └── Dockerfile                # 멀티 스테이지: node:22-slim, Prisma + Docker CLI
│   │
│   ├── k6-runner-v2/                 # Express 4.18, TypeScript 5, Jest
│   │   ├── src/
│   │   │   ├── app.ts                # Express 앱, health/ready/config 엔드포인트, 그레이스풀 셧다운
│   │   │   ├── routes/route.ts       # API 라우트: /api/test/start|stop|status|progress, /api/scenarios
│   │   │   ├── container/container.ts # 수동 DI 컨테이너 (싱글톤)
│   │   │   ├── modules/
│   │   │   │   ├── test/
│   │   │   │   │   ├── test.controller.ts  # HTTP 핸들러 (시작, 중지, 상태, 진행률)
│   │   │   │   │   ├── test.service.ts     # 비즈니스 로직: K6 생성, currentTest 관리
│   │   │   │   │   └── test.service.spec.ts
│   │   │   │   ├── scenarios/
│   │   │   │   │   ├── scenario.service.ts      # K6 스크립트 생성, 실행기 설정, URL 구성
│   │   │   │   │   ├── scenarios.controller.ts
│   │   │   │   │   └── scenario.service.spec.ts
│   │   │   │   ├── process-manager/
│   │   │   │   │   ├── process-manager.service.ts  # K6 프로세스 생성, stdout/stderr 파싱, 진행률 추적
│   │   │   │   │   └── process-manager.service.spec.ts
│   │   │   │   └── config/
│   │   │   │       ├── config.service.ts     # 환경 변수 관리 (싱글톤, K8s 인식)
│   │   │   │       └── config.service.spec.ts
│   │   │   ├── middleware/
│   │   │   │   ├── validator.ts        # 요청 유효성 검사 미들웨어
│   │   │   │   └── sanitizeString.ts   # 입력 살균 미들웨어
│   │   │   ├── types/
│   │   │   │   ├── test.types.ts       # TestConfig, CurrentTest, TestProgress, TestStatus
│   │   │   │   └── scenario.types.ts   # Scenario, RampPattern
│   │   │   └── utils/
│   │   │       ├── constants.ts        # CONSTANTS, HTTP_STATUS, SCENARIO 정의
│   │   │       ├── validation.ts       # URL, 기간, HTTP 메서드, 시나리오 유효성 검사기
│   │   │       ├── string.ts           # 문자열 유틸리티
│   │   │       ├── time.ts             # 기간 파싱
│   │   │       └── index.ts            # 배럴 익스포트
│   │   └── Dockerfile                  # 멀티 스테이지: Go 1.24 (xk6 빌드) + Node 22 Alpine
│   │
│   └── mock-server/                    # NestJS 10, TypeScript 5
│       ├── src/
│       │   ├── main.ts                 # NestFactory 부트스트랩
│       │   ├── app.module.ts           # ChaosMiddleware가 포함된 모듈
│       │   ├── app.controller.ts       # 루트 헬스 엔드포인트
│       │   ├── app.service.ts
│       │   ├── middleware/
│       │   │   └── chaos.middleware.ts  # 쿼리 파라미터 + 헤더 기반 에러 주입
│       │   ├── success/                # 단순 성공 응답 엔드포인트
│       │   ├── performance/            # 느린 응답, 타임아웃, 가변 지연, 동시성 엔드포인트
│       │   ├── chaos/                  # 랜덤 에러, 설정, 셧다운 엔드포인트
│       │   └── common/types/           # 공유 응답 타입
│       └── Dockerfile                  # 멀티 스테이지: node:22-slim
│
└── services/
    ├── postgres/
    │   └── init.sql              # 스키마: test_runs, test_results, 인덱스, 트리거
    └── influxdb/
        └── init-influxdb.sh      # InfluxDB 초기화 스크립트
```

---

## 3. 서비스별 상세 조사 결과

### 3.1 Control Panel (Next.js 15 + React 19)

**목적**: K6 부하 테스트의 설정, 실행, 모니터링을 위한 웹 기반 UI. K6 Runner로의 요청을 프록시하는 API 게이트웨이 역할도 수행.

#### 주요 함수

| 파일 | 함수 | 동작 |
|------|------|------|
| `page.tsx` | `Home()` | 메인 대시보드. `testStatus` (idle/running), `testId`, `metrics` 상태를 관리. 안정적인 폴링 참조를 위해 `useRef` 사용. `setInterval` 대신 `setTimeout` 재귀 방식으로 2초마다 상태 및 메트릭 폴링. 완료 시 `/api/tests/complete`를 통해 결과 저장. |
| `page.tsx` | `checkStatus()` | 에러 카운터가 있는 재귀 폴링 (10회 연속 에러 시 폴링 중지). 테스트 완료 시 최종 메트릭을 가져와 `saveTestResults()` 호출. |
| `TestController.tsx` | `handleStart()` | 전체 설정 (시나리오, VUs, 기간, 실행 모드, 대상 URL, 에러 시뮬레이션 등)을 `/api/k6/run`으로 전송. 카오스/셧다운 경고 확인 처리. |
| `TestController.tsx` | `handleStop()` | testId와 함께 `/api/k6/stop` 호출. 에러가 발생해도 UI 상태 업데이트 (낙관적 UI 업데이트). |
| `TestHistory.tsx` | `TestHistory()` | `/api/tests?limit=100`에서 데이터 조회. 필터 (상태), 검색 (testId, 시나리오, URL, 메서드), 정렬 (날짜, 시나리오, 상태) 지원. 설정 + 결과가 포함된 상세 모달 표시. |

#### API 라우트 (BFF 패턴 - Backend for Frontend)

| 라우트 | 메서드 | 설명 | 다운스트림 |
|--------|--------|------|-----------|
| `/api/k6/run` | POST | 테스트 시작, DB에 저장 | `K6_RUNNER/api/test/start` |
| `/api/k6/run` | GET | 활성 테스트 조회 | `K6_RUNNER/api/test/status` |
| `/api/k6/run` | DELETE | 테스트 중지 | `K6_RUNNER/api/test/stop` |
| `/api/k6/stop` | POST | 테스트 중지 + DB 업데이트 | `K6_RUNNER/api/test/stop` |
| `/api/k6/status` | GET | 경량 상태 확인 | `K6_RUNNER/api/test/status` |
| `/api/k6/metrics` | GET | InfluxDB 3.x SQL 쿼리 | InfluxDB `/api/v3/query_sql` |
| `/api/k6/progress` | GET | 현재 테스트 진행률 | `K6_RUNNER/api/test/progress` |
| `/api/k6/progress/[testId]` | GET | testId별 진행률 | `K6_RUNNER/api/test/progress/:testId` |
| `/api/tests` | GET | 테스트 이력 (페이지네이션) | PostgreSQL via Prisma |
| `/api/tests/[id]` | GET | 단일 테스트 상세 정보 | PostgreSQL via Prisma |
| `/api/tests/complete` | POST | 테스트 결과 저장 | PostgreSQL via Prisma |
| `/api/health` | GET | 설정 기반 헬스 체크 | 로컬 |
| `/api/ready` | GET | 실제 연결 확인 | DB + K6 Runner + Mock Server |

#### Config (`lib/config.ts`)

- `getInstance()`를 통한 싱글톤 패턴
- Kubernetes 인식: `KUBERNETES_SERVICE_HOST`를 감지하여 서비스 URL을 자동 조정
- 3단계 URL 해석 전략: 환경 변수 > K8s 서비스 DNS > Docker Compose 서비스명
- 프로덕션 로그에서 보안을 위해 URL 마스킹
- 능동적 헬스 체크를 위한 `validateConnections()` 메서드

#### 데이터 모델 (Prisma 스키마)

```
TestRun (1) ----> (0..1) TestResult
  - id (UUID, 자동 생성)
  - testId (고유, K6 Runner에서 생성)
  - scenario, vus, duration, iterations
  - executionMode, targetUrl, urlPath, httpMethod
  - requestBody (JSONB)
  - status (열거형: running, completed, failed, cancelled)
  - startedAt, completedAt, 타임스탬프

TestResult
  - totalRequests, failedRequests
  - avgResponseTime, minResponseTime, maxResponseTime
  - p95ResponseTime, p99ResponseTime
  - avgRequestRate, errorRate
  - dataReceived, dataSent (BigInt)
  - maxVus, avgIterationDuration
  - metricsJson (JSONB - 원본 메트릭 스냅샷)
```

---

### 3.2 K6 Runner v2 (Express + TypeScript)

**목적**: 핵심 테스트 실행 엔진. 테스트 설정을 수신하여 K6 스크립트를 동적으로 생성하고, K6 프로세스를 생성하며, stdout 파싱을 통해 진행률을 추적하고, InfluxDB에 메트릭을 보고.

#### 아키텍처

```
TestController --> TestService --> ScenarioService (스크립트 생성)
                               --> ProcessManagerService (프로세스 생명주기)
                               --> ConfigService (환경 설정)
```

모두 수동 DI 컨테이너 (`container.ts`)를 통해 연결.

#### 주요 함수

| 파일 | 함수 | 동작 |
|------|------|------|
| `test.service.ts` | `startTest()` | 동시 실행 중인 테스트가 없는지 검증. UUID testId 생성. ScenarioService에서 실행기 설정 조회. K6 스크립트 생성. `/tmp/k6-test-{testId}.js`에 파일 저장. K6 프로세스 생성. 종료 핸들러 등록 (스크립트 정리, 타임아웃 해제, 대시보드 포트 해제). |
| `test.service.ts` | `stopTest()` | K6 프로세스에 SIGTERM 전송. 5초 후 SIGKILL로 폴백. currentTest 상태 초기화. |
| `scenario.service.ts` | `getExecutorConfig()` | 시나리오 + 실행 모드를 K6 실행기 설정에 매핑. 패턴에 따라 램프 스테이지 계산 (standard/aggressive/gradual). iterations, hybrid, constant-vus 모드 처리. |
| `scenario.service.ts` | `generateK6Script()` | 완전한 K6 JavaScript 테스트 스크립트 생성. 모든 HTTP 메서드 처리. `useHeaderForChaos`가 true일 때 카오스 헤더 추가. 메서드별 성공 상태 코드 검증 추가. `/chaos/shutdown` 엔드포인트에 대한 특별 처리. |
| `scenario.service.ts` | `buildUrl()` | 에러 시뮬레이션이 활성화되고 대상이 Mock 서버인 경우 카오스 쿼리 파라미터 (`?chaos=true&errorRate=X&statusCodes=Y`) 추가. |
| `process-manager.service.ts` | `spawnProcess()` | InfluxDB 출력이 포함된 K6 명령 인자 구성 (`xk6-influxdb=URL`). 테스트별 격리된 환경 변수 설정. 포트가 사용 가능한 경우 대시보드 구성. K6 자식 프로세스 생성. 진행률을 위한 stdout/stderr 파싱. |
| `process-manager.service.ts` | `parseK6Progress()` | K6 stdout 정규식 파싱: `running (Xm30s), Y/Z VUs`, `N complete and M interrupted iterations`, `[===>  ] 45%`. K6 출력에서 사용 불가능한 경우 기간으로부터 진행률 계산. |
| `process-manager.service.ts` | `setupTimeout()` | 최대 실행 시간 = 기간 + 30초 버퍼 설정. 초과 시 SIGTERM 후 SIGKILL. |
| `config.service.ts` | 생성자 | K8s 인식 설정. 개발 모드에서는 기본값 사용. 프로덕션 모드에서는 필수 환경 변수 검증. |

#### 시나리오 램프 패턴

| 패턴 | 설명 | 분포 |
|------|------|------|
| `none` | 일정한 VUs, 스테이지 없음 | 수평선 |
| `standard` | 15% 램프 업, 70% 안정 상태, 15% 램프 다운 | 사다리꼴 |
| `aggressive` | 30% 정상 상태(VUs 20%), 5% 스파이크 업, 30% 유지(100%), 5% 다운, 30% 정상 | 스파이크 패턴 |
| `gradual` | 4단계 균등 증가 (25%, 50%, 75%, 100%), 이후 램프 다운 | 계단식 |

#### 단일 테스트 제약

K6 Runner는 `this.currentTest` 필드를 통해 **한 번에 하나의 테스트만** 실행을 강제합니다. 테스트가 실행 중이면 `startTest()`가 `'Another test is already running'` 에러를 발생시킵니다. 이는 제한이 아닌 의도적인 설계 결정입니다.

#### 미들웨어 파이프라인

```
POST /api/test/start --> validateTestRequest --> sanitizeString --> testController.startTest
```

- `validateTestRequest`: VUs (1-1000), 기간 형식, 반복 횟수 (1-100000), URL 유효성, HTTP 메서드, 시나리오, 에러 비율 유효성 검사
- `sanitizeString`: 인젝션 방지를 위한 `urlPath` 및 `requestBody` 살균

---

### 3.3 Mock Server (NestJS 10)

**목적**: 현실적인 부하 테스트를 위해 카오스 엔지니어링 기능을 갖춘 제어 가능한 테스트 대상 엔드포인트 제공.

#### 모듈

| 모듈 | 엔드포인트 | 동작 |
|------|-----------|------|
| **Success** | `GET/POST /success` | 항상 200과 타임스탬프 반환. POST는 요청 본문을 에코. |
| **Performance** | `GET /performance/slow` | 설정 가능한 지연 (기본값 3초) |
| | `GET /performance/timeout` | 설정 가능한 타임아웃 (기본값 30초) |
| | `GET /performance/variable-latency` | min/max 사이의 랜덤 지연 (기본값 100ms-3초) |
| | `GET /performance/concurrency-issue` | 공유 카운터에 대한 의도적인 경합 조건 |
| **Chaos** | `GET/POST /chaos/random` | errorRate와 statusCodes에 기반한 랜덤 에러 주입 |
| | `GET/POST /chaos/config` | 런타임에 카오스 설정 조회/변경 |
| | `GET /chaos/shutdown` | 1초 지연 후 서버 프로세스 종료 |

#### ChaosMiddleware

`/health`, `/success`, `/performance/*`에 적용 (이중 카오스 방지를 위해 `/chaos/*`는 제외).

두 가지 활성화 모드 지원:
1. **쿼리 파라미터**: `?chaos=true&errorRate=0.1&statusCodes=400,500,503`
2. **HTTP 헤더**: `X-Chaos-Enabled`, `X-Chaos-Error-Rate`, `X-Chaos-Status-Codes`

쿼리 파라미터가 헤더보다 우선 적용.

---

### 3.4 인프라 서비스

#### PostgreSQL 16 Alpine

- 데이터베이스: `k6_test_history`
- 초기화 스크립트가 생성하는 것: `uuid-ossp` 확장, `test_status` 열거형, `test_runs` + `test_results` 테이블, 인덱스, `updated_at` 트리거
- Prisma 스키마가 `@@map` 어노테이션으로 SQL 스키마를 정확히 미러링

#### InfluxDB 3.x Core

- 이미지: `quay.io/influxdb/influxdb3-core:latest`
- 포트 8181에서 실행 (비표준)
- `--without-auth` 플래그 사용 (인증 비활성화)
- 오브젝트 스토어: 메모리 (기본적으로 비영속적, 다만 볼륨은 마운트됨)
- Control Panel의 메트릭 라우트에서 SQL (`/api/v3/query_sql`)로 쿼리

---

## 4. 데이터 흐름

### 테스트 실행 흐름

```
1. 사용자가 TestController UI에서 테스트 설정
2. UI가 POST /api/k6/run 호출 (Control Panel API)
3. Control Panel이 K6 Runner POST /api/test/start로 프록시
4. K6 Runner:
   a. 요청 유효성 검사 (미들웨어)
   b. 실행기 설정 생성 (ScenarioService)
   c. 필요 시 카오스 파라미터가 포함된 대상 URL 구성
   d. K6 JavaScript 스크립트 생성
   e. 스크립트를 /tmp/k6-test-{uuid}.js에 저장
   f. 실행: k6 run --out xk6-influxdb=URL --out dashboard=... --tag testId=X script.js
   g. testId를 Control Panel에 반환
5. Control Panel이 PostgreSQL에 TestRun 저장 (status: running)
6. UI 폴링 시작:
   - /api/k6/status 2초마다 (상태 확인)
   - /api/k6/metrics 2초마다 (InfluxDB SQL 쿼리)
   - /api/k6/progress 1초마다 (K6 stdout 파싱)
7. K6 프로세스가 실행되며 InfluxDB에 메트릭 기록, stdout이 진행률을 위해 파싱됨
8. K6 프로세스 종료 -> ProcessManager 정리 -> currentTest = null
9. UI가 running=false 감지 -> 최종 메트릭 조회 -> POST /api/tests/complete
10. Control Panel이 PostgreSQL에 TestResult 저장 (status: completed)
```

### 메트릭 쿼리 흐름

```
브라우저 --> GET /api/k6/metrics?testId=X
  --> Control Panel API 라우트
    --> 6개의 병렬 InfluxDB SQL 쿼리:
        - http_req_duration (AVG, MIN, MAX)
        - http_reqs (COUNT, AVG rate)
        - vus (LIMIT 1로 현재값, MAX로 최대값)
        - http_req_failed (COUNT, AVG rate)
        - iteration_duration (AVG, MIN, MAX)
        - data_sent + data_received (SUM)
    --> 집계 후 JSON 반환
```

---

## 5. CI/CD 파이프라인 (Bitbucket Pipelines)

### 파이프라인 단계

```
모든 브랜치 (main 제외):
  - K6 Runner 테스트 (npm ci, lint, test)

main 브랜치:
  1. K6 Runner 테스트 (병렬)
  2. 프로덕션 배포 (스테이지):
     a. Control Panel Docker 이미지 빌드 (멀티 아키텍처 amd64/arm64)
     b. K6 Runner Docker 이미지 빌드
     c. Mock Server Docker 이미지 빌드
     d. IAC 저장소 업데이트 (새 이미지 태그로 Helm values.yaml 수정)
```

### IAC 통합 (GitOps)

- SSH를 통해 별도의 IAC 저장소 클론
- `yq`를 사용하여 Helm values 파일의 `image.tag` 업데이트
- ArgoCD 동기화를 트리거하기 위해 변경사항 커밋 및 푸시
- Docker Hub 이미지: `leehyeontae/k6-testing-platform-{서비스}:{커밋해시|latest}`

### Kubernetes 배포

- `deploy-to-k8s.sh`는 3가지 모드 지원: 로컬 Kind, 로컬 Kind + ArgoCD, 원격 EKS
- 네임스페이스: `k6-platform`
- 로컬 접근을 위한 포트 포워딩
- Makefile 타겟: `k8s-setup`, `k8s-load`, `k8s-deploy`, `k8s-forward`, `k8s-logs`, `k8s-status`

---

## 6. 관계 및 의존성

### 서비스 간 통신

```
Control Panel (3000) --HTTP--> K6 Runner (3002)
Control Panel (3000) --HTTP--> Mock Server (3001) [헬스 체크만]
Control Panel (3000) --HTTP--> InfluxDB (8181) [메트릭 쿼리]
Control Panel (3000) --TCP-->  PostgreSQL (5432) [Prisma ORM]

K6 Runner (3002) --> K6 프로세스 생성
  K6 프로세스 --HTTP--> Mock Server (3001) [테스트 대상]
  K6 프로세스 --HTTP--> InfluxDB (8181) [xk6-output-influxdb]
  K6 프로세스 --> K6 Dashboard (5665) [xk6-dashboard]
```

### 공유 상태

- **K6 Runner `currentTest`**: 활성 테스트를 추적하는 단일 가변 필드. 이것이 중앙 조정 포인트; 한 번에 하나의 테스트만 실행 가능.
- **K6 Runner `testProgress` Map**: testId별 진행률을 추적하는 인메모리 맵. 테스트 완료 시 정리됨.
- **Mock Server `concurrentCounter`**: 동시성 테스트를 위한 의도적으로 경합이 발생하는 공유 카운터.
- **Mock Server `ChaosConfig`**: 런타임에 변경 가능한 카오스 설정.

### 결합 포인트

1. **시나리오 설정 중복**: `apps/control-panel/lib/scenario.ts`와 `apps/k6-runner-v2/src/utils/constants.ts`가 시나리오를 독립적으로 정의. 수동으로 동기화해야 함. K6 Runner에는 Control Panel에 없는 추가 `custom` 시나리오가 있음.
2. **URL 구성**: Control Panel과 K6 Runner 모두 Mock 서버 URL 패턴 (포트 3001, Docker 서비스명)을 인식. 환경 변수로 설정되지만 폴백 기본값이 있음.
3. **InfluxDB 쿼리 형식**: Control Panel이 SQL로 InfluxDB 3.x를 직접 쿼리. InfluxDB 버전이 변경되면 이 쿼리들도 업데이트해야 함.

---

## 7. 발견된 잠재적 문제점

### 보안

1. **InfluxDB 쿼리의 SQL 인젝션** (`apps/control-panel/app/api/k6/metrics/route.ts:99`): `testId`가 파라미터화 없이 SQL 문자열에 직접 삽입됨:
   ```typescript
   const testIdFilter = testId ? `AND "testId" = '${testId}'` : "";
   ```
   InfluxDB SQL이 전통적인 SQL만큼 취약하지 않을 수 있지만, 여전히 코드 스멜(code smell)임.

2. **`.env` 파일이 저장소에 커밋됨** (루트 및 여러 앱 디렉토리에 `.env` 존재): 루트 `.env`에 `POSTGRES_PASSWORD=testpassword`와 `INFLUXDB_TOKEN=dev-token-for-testing`이 포함. 개발용 기본값이지만, `.gitignore`에 포함되어야 함 (`**/.env`로 `.gitignore`에 IS 포함되어 있으나, 루트 `.env`는 여전히 저장소에 존재).

3. **CORS 와일드카드** (`apps/k6-runner-v2/src/app.ts:14`): `origin: '*'`가 모든 출처에서 K6 Runner API에 접근 허용. 내부 서비스로는 허용 가능하지만 외부 노출 시 위험.

4. **InfluxDB에서 `--without-auth`** (`docker-compose.yml:94`): InfluxDB가 인증 없이 실행됨. 개발 환경에서는 괜찮으나 프로덕션에서는 변경 필수.

5. **Docker 소켓 마운트** (`docker-compose.yml:36`): Control Panel이 호스트의 Docker 소켓 (`/var/run/docker.sock`)에 접근 가능하여 호스트에 대한 root 동등 권한 부여. 현재 코드베이스에서는 사용되지 않는 것으로 보임.

### 버그 / 에지 케이스

6. **중복된 중지 엔드포인트**: `/api/k6/run` (DELETE 메서드)과 `/api/k6/stop` (POST 메서드) 모두 테스트를 중지함. 구현이 다름 - DELETE는 DB 상태를 업데이트하지 않지만 POST는 업데이트함. 이로 인해 일관성 없는 상태가 발생할 수 있음.

7. **테스트 완료 시 경합 조건**: `page.tsx`에서 테스트가 완료되면 `checkStatus()`가 최종 메트릭을 가져와 결과를 저장. 하지만 `pollMetrics()`는 독립적으로 2초마다 실행됨. 폴링 주기 사이에 테스트가 완료되면 마지막 메트릭이 오래된 것일 수 있음.

8. **BigInt 직렬화**: `serializeBigInt()`가 `apps/control-panel/app/api/tests/route.ts`와 `apps/control-panel/app/api/tests/[id]/route.ts` 모두에 중복 구현됨. 공유 유틸리티로 추출되어야 함.

9. **프로덕션 코드의 console.log 문**: 코드베이스 전체에 다수의 `console.log` 및 `console.warn` 문이 존재 (특히 `process-manager.service.ts`의 `[DEBUG]` 접두사 로그). 로그 레벨로 제어되어야 함.

10. **TestController.tsx가 1007줄**: 이 컴포넌트가 너무 많은 책임을 처리 (시나리오 선택, 실행 모드, 대상 서버 설정, 엔드포인트 선택, 요청 본문, 에러 시뮬레이션). 더 작은 컴포넌트로 분리되어야 함.

11. **run 라우트의 `requestBody` JSON.parse** (`apps/control-panel/app/api/k6/run/route.ts:75`): `JSON.parse(requestBody)`가 `requestBody`가 유효한 JSON이 아닌 경우 예외를 발생시켜, 외부 try/catch에도 불구하고 요청 핸들러가 충돌할 수 있음 (Prisma는 JSON 호환 값을 기대).

12. **진행률 폴링 1초 vs 상태/메트릭 폴링 2초**: TestProgress 컴포넌트는 1초마다 폴링하고 부모 페이지는 상태와 메트릭을 2초마다 폴링. 불필요한 부하를 생성하며 간격을 통일할 수 있음.

13. **InfluxDB p95/p99가 항상 0**: 메트릭 라우트가 "InfluxDB 3.x SQL에서 지원되지 않음"이라는 주석과 함께 `p95: 0, p99: 0`을 반환. 이 0 값이 UI에 그대로 표시되어 오해를 유발.

### 아키텍처

14. **서비스 간 공유 타입 없음**: Control Panel과 K6 Runner가 독립적으로 타입을 정의. K6 Runner API 계약 변경 시 Control Panel을 수동으로 업데이트해야 함.

15. **API 버전 관리 없음**: 모든 API 엔드포인트가 버전 없음. 하위 호환성을 깨는 변경이 모든 소비자에게 동시에 영향.

16. **단일 인스턴스 K6 Runner**: 한 번에 하나의 K6 테스트만 실행 가능 (`currentTest` 필드로 강제). 다중 사용자 시나리오에서의 강한 제약.

17. **인메모리 진행률 추적**: 테스트 진행률이 `ProcessManagerService` 내부의 `Map`에 저장됨. K6 Runner가 테스트 중 재시작되면 모든 진행률 데이터가 손실.

18. **InfluxDB 쓰기에 대한 재시도 로직 없음**: K6 프로세스가 `xk6-output-influxdb`를 통해 InfluxDB에 쓰기를 수행. InfluxDB가 일시적으로 사용 불가능하면 메트릭이 손실될 수 있음.

---

## 8. 기술 스택 요약

| 구성 요소 | 기술 | 버전 |
|-----------|------|------|
| **Control Panel** | Next.js (App Router) | 15.4.6 |
| | React | 19.1.0 |
| | TypeScript | 5.x |
| | Prisma ORM | 6.14.0 |
| | TailwindCSS | 4.x |
| **K6 Runner** | Express | 4.18.2 |
| | TypeScript | 5.3.2 |
| | Jest | 29.7.0 |
| | uuid | 9.0.0 |
| **Mock Server** | NestJS | 10.x |
| | TypeScript | 5.x |
| **테스트 엔진** | K6 (커스텀 xk6 빌드) | latest |
| | xk6-output-influxdb | latest |
| | xk6-dashboard | latest |
| | Go (xk6 빌드용) | 1.24 |
| **데이터베이스** | PostgreSQL | 16 Alpine |
| | InfluxDB 3.x Core | latest |
| **인프라** | Docker / Docker Compose | - |
| | Kubernetes (Kind/EKS) | - |
| | ArgoCD | - |
| | Bitbucket Pipelines | - |
| **컨테이너 베이스** | node:22-slim / node:22-alpine | - |

---

## 9. 미해결 질문

1. **Control Panel에 Docker 소켓이 마운트된 이유는?** Docker API를 직접 사용하는 코드가 없음. 향후 컨테이너 관리를 위한 것인지?
2. **`apps/control-panel/.env`의 `INFLUXDB_BUCKET`이 루트 `.env`와 다른 이유는?** 환경 변수 오버라이드 충돌 가능성.
3. **시나리오 설정을 통합할 계획이 있는지?** Control Panel과 K6 Runner 간의 중복은 유지보수 위험 요소.
4. **의도된 확장 전략은?** 한 번에 하나의 테스트만 실행 가능한 제약이 플랫폼을 단일 사용자 용도로 제한.
5. **ProcessManagerService의 `[DEBUG]` 로그가 프로덕션용으로 의도된 것인지?** 테스트 ID 및 진행률 세부 정보를 포함한 상세 데이터를 stderr로 출력.
6. **Makefile이 ~800줄인 이유는?** 여러 배포 전략 (Docker Compose, Kind, EKS, ArgoCD)에 대한 타겟을 포함하고 있는 것으로 보임. 관심사별로 분리하는 것을 고려.
7. **`bitbucket-pipelines.yml.backup`이 의도적으로 추적되고 있는지?** 이전 파이프라인 설정의 백업인 것으로 보임.
