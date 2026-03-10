# K6 Testing Platform - AWS 프로덕션 배포 작업 계획서

> **문서 성격:** legacy planning artifact
> **현재 상태:** 기본 방향은 GKE 기준으로 전환되었으며, 이 문서는 AWS 대안 검토 이력으로 보존
> **현재 참고 우선순위:** 현재 구현/운영 기준은 `docs/work-plan-gke-migration-implementation-status.md` 및 `docs/runbook/demo-gitops-runbook.md`
> **버전:** v3-final (Ralplan Consensus)
> **작성일:** 2026-03-09
> **컨센서스:** Planner (3 iterations) + Architect (3 reviews) + Critic (2 reviews) → APPROVED
> **원본 스펙:** `.omc/specs/deep-interview-k6-platform-upgrade.md`

---

## RALPLAN-DR 요약

### 원칙 (Principles)

1. **Docker-first 이식성**: 모든 서비스는 최적화된 Docker 이미지로 패키징. control-panel에서 `docker.io` 패키지 제거 (200MB+ 절감, 보안 위험 제거)
2. **IaC 전면 적용**: 모든 AWS 인프라는 Terraform으로 관리. 수동 콘솔 작업 금지
3. **Makefile 타겟 존재, 참조 파일은 신규 생성**: `k8s/`, `Helm`, `ArgoCD` 관련 파일은 모두 처음부터 작성. Makefile 타겟과의 정합성 확인 필수
4. **비밀 정보 외부화**: Makefile의 하드코딩된 InfluxDB 토큰 등 모든 시크릿은 AWS Secrets Manager / SSM Parameter Store로 이전
5. **InfluxDB 환경별 object-store 전략**:
   - 로컬 개발: `--object-store memory` 유지 (현행 docker-compose.yml)
   - 프로덕션 EC2: `--object-store file` + `--ram-pool-data-bytes 512000000` (512MB 메모리 캡)

### 핵심 결정 동인 (Decision Drivers)

1. **월 예산 $20-30 제약** → EKS($113+/월) 불가, ECS Fargate Spot이 유일한 현실적 선택
2. **K8s/DevOps 역량 증명** → Kind + Helm + ArgoCD(선택) + Terraform으로 로컬에서 증명
3. **기존 코드베이스 기술 부채** → control-panel Dockerfile `docker.io`, 빈 `k8s/` 디렉토리, 하드코딩 시크릿 우선 해결

### 비교 옵션 분석

| 기준 | Option A: 하이브리드 (선택) | Option B: EKS Only | Option C: ECS Only |
|------|:---:|:---:|:---:|
| 월 비용 | ~$27-34 | ~$113+ | ~$15-25 |
| K8s 역량 증명 | Kind + Helm 로컬 시연 | 실제 EKS 클러스터 | 불가 |
| Terraform 역량 | ECS 실배포 + EKS 문서화 | EKS 실배포 | ECS만 |
| 포트폴리오 인상 | 높음 (실용성 + 기술폭) | 최고 (비용 무시 시) | 보통 |
| 실현 가능성 | **높음** | 낮음 (예산 3.7x 초과) | 높음 |

**Option B 무효화 사유**: EKS control plane $73/월 고정 + Fargate pods ~$40/월 = 최소 $113/월, 예산의 3.7배 초과
**Option C 무효화 사유**: K8s/Helm/ArgoCD 역량을 전혀 증명 불가, 포트폴리오 목적에 부합하지 않음

---

## 현재 상태 (AS-IS)

### 아키텍처

```
[Browser] → [Control Panel (Next.js 15, React 19, Prisma)]
                ├── [K6 Runner v2 (Express + TypeScript + xk6)]
                ├── [Mock Server (NestJS 10)]
                ├── [PostgreSQL 16]
                └── [InfluxDB 3.x Core (--object-store memory)]

오케스트레이션: Docker Compose (단일 docker-compose.yml)
CI/CD: 없음 (.github/workflows/ 비어있음)
IaC: 없음 (Terraform 파일 없음)
K8s: 없음 (k8s/ 디렉토리 없음, Makefile 타겟만 존재)
```

### 서비스 구성

| 서비스 | 기술 스택 | 역할 |
|--------|-----------|------|
| control-panel | Next.js 15 + React 19 + Prisma + Tailwind 4 | UI + API (BFF 패턴) |
| k6-runner-v2 | Express + TypeScript + xk6 (InfluxDB + Dashboard) | K6 테스트 실행 |
| mock-server | NestJS 10 | 부하 테스트 대상 서버 |
| postgres | PostgreSQL 16 Alpine | 테스트 기록 저장 |
| influxdb | InfluxDB 3.x Core | 메트릭 시계열 저장 |

### 식별된 기술 부채

| 항목 | 위치 | 설명 |
|------|------|------|
| docker.io 설치 | `apps/control-panel/Dockerfile:31` | 프로덕션 이미지에 불필요한 200MB+ 패키지, 보안 위험 |
| npm install | `apps/mock-server/Dockerfile:9` | `npm ci` 사용해야 재현 가능한 빌드 |
| 하드코딩 토큰 | `Makefile:424` | InfluxDB `apiv3_...` 토큰 하드코딩 |
| InfluxDB 비영속 | `docker-compose.yml:90` | `--object-store memory` 모드, 재시작 시 데이터 소실 |
| 포트 불일치 | `init-influxdb.sh:9` vs `docker-compose.yml` | 기본 포트 8086 vs 실제 사용 8181 |
| 빈 디렉토리 | `k8s/`, `.github/workflows/` | Makefile이 참조하나 실제 파일 없음 |
| 디버그 문 | `process-manager.service.ts` | 30+ console.warn/error 프로덕션 코드 잔류 |

---

## 목표 상태 (TO-BE)

### 프로덕션 아키텍처 (ECS Fargate)

```
[Browser] → [ALB (HTTPS/ACM)]
                └── [AWS ECS Fargate Cluster]
                    ├── [Control Panel Task (Spot)] → [RDS PostgreSQL]
                    ├── [K6 Runner Task (Spot)]    → [EC2 InfluxDB]
                    └── [Mock Server Task (Spot)]

[EC2 t4g.micro] → InfluxDB 3.x (--object-store file + EBS gp3 8GB)

[GitHub Actions] → [ECR] → [ECS Service Update]
[Terraform]      → [VPC + ECS + EC2 + RDS + ALB + Secrets]
```

### 로컬 K8s 아키텍처 (Kind - 포트폴리오 시연용)

```
[Kind Cluster]
    ├── [Control Panel Pod]
    ├── [K6 Runner Pod]
    ├── [Mock Server Pod]
    ├── [PostgreSQL StatefulSet]
    └── [InfluxDB StatefulSet]

배포: Helm Charts (k8s/helm/)
GitOps: ArgoCD (선택적, Stage 4)
```

---

## ADR (Architecture Decision Records)

### ADR-001: 배포 전략 - EKS vs ECS (하이브리드 접근)

| 항목 | 내용 |
|------|------|
| **결정** | Kind(로컬 K8s) + ECS Fargate(프로덕션) + EKS Terraform(문서화된 목표 아키텍처) |
| **동인** | 월 $20-30 예산 제약, K8s 역량 포트폴리오 증명, 기존 Makefile Kind/ArgoCD 자산 활용 |
| **대안 1: EKS Only** | 최소 $113/월, 예산 3.7x 초과로 불가 |
| **대안 2: ECS Only** | K8s 역량 증명 불가, 포트폴리오 차별화 어려움 |
| **선택 사유** | 비용 제약 내 최대 기술 스택 시연. Kind에서 K8s+Helm 검증, ECS로 실배포, Terraform EKS 모듈로 IaC 역량 문서화 |
| **결과** | Kind와 ECS 간 배포 설정 이원화, EKS는 `terraform plan`까지만 검증 |
| **후속** | 예산 확대 시 EKS 마이그레이션 가이드 작성, 비용 분석 ADR 업데이트 |

### ADR-002: InfluxDB 영속성 전략

| 항목 | 내용 |
|------|------|
| **결정** | 프로덕션에서 EC2 t4g.micro에 InfluxDB 배포 (~$3.64/월) |
| **동인** | InfluxDB 3.x `--object-store memory`는 비영속, Fargate는 EBS 직접 마운트 불가 |
| **대안 1: EFS 마운트** | 높은 latency, 시계열 write 성능에 악영향 |
| **대안 2: Amazon Timestream** | API 호환성 없음, xk6-output-influxdb 확장이 InfluxDB Line Protocol 전용 |
| **대안 3: CloudWatch Metrics** | k6 출력 형식 불일치, 커스텀 변환 필요 |
| **선택 사유** | t4g.micro($3.07/월) + EBS gp3 8GB($0.64/월)로 Line Protocol 완전 호환 유지 |
| **메모리 가드** | `--ram-pool-data-bytes 512000000` (512MB 캡), OOM 시 t4g.small($7.30/월)로 업그레이드 |
| **스케일업 트리거** | write latency p99 > 200ms 시 인스턴스 사이즈 업그레이드 |

### ADR-003: CI/CD 전략 - ArgoCD + GitHub Actions 역할 분담

| 항목 | 내용 |
|------|------|
| **결정** | ArgoCD(Kind 로컬 GitOps 시연, 선택적) + GitHub Actions(ECS 프로덕션 CD) |
| **동인** | Makefile에 ArgoCD 인프라 150+ lines 존재, ArgoCD는 K8s 전용이라 ECS 비호환 |
| **대안 1: ArgoCD Only** | ECS와 호환 불가 |
| **대안 2: GitHub Actions Only** | 기존 ArgoCD 코드 폐기, GitOps 역량 미증명 |
| **선택 사유** | 각 도구의 적합한 환경에서 사용. ArgoCD로 GitOps 패턴 시연(Kind), GitHub Actions로 실제 프로덕션 CD(ECS) |

---

## Stage별 상세 작업 계획

### Stage 0: Docker 이미지 최적화 및 기반 정리 (15-20시간)

#### 목표
프로덕션 배포를 위한 Docker 이미지 품질 확보 및 환경별 전략 확정

#### 태스크

**0-1. InfluxDB object-store 전략 확정 및 포트 통일**
- 로컬: `--object-store memory` (현행 유지)
- 프로덕션: `--object-store file --ram-pool-data-bytes 512000000`
- init-influxdb.sh 포트(8086) ↔ docker-compose 포트(8181) 통일
- xk6-output-influxdb 토큰 인증 모드 호환성 검증
- **수용 기준**: 로컬 `docker compose up` 정상, 토큰 인증으로 k6 데이터 쓰기 성공

**0-2. control-panel Dockerfile 최적화**
- `docker.io` 패키지 제거 (apps/control-panel/Dockerfile:31)
- multi-stage 빌드에서 프로덕션 스테이지 최적화
- **수용 기준**: 이미지 크기 200MB 미만

**0-3. mock-server Dockerfile 수정**
- `npm install` → `npm ci` 변경 (재현 가능한 빌드)
- **수용 기준**: 동일 package-lock.json으로 항상 동일 결과

**0-4. 비밀 정보 감사**
- Makefile 내 하드코딩된 InfluxDB 토큰 식별 (Makefile:424)
- docker-compose.yml 내 하드코딩된 자격증명 식별
- .env 파일 5개 (root + 4 apps) 변수별 시크릿 관리 방식 매핑
- 프로덕션용 시크릿 관리 방안 문서화 (AWS Secrets Manager)
- **수용 기준**: 하드코딩된 시크릿 목록 + 대체 방안 문서 작성 완료

#### 검증 명령어

```bash
# 0-1: InfluxDB 포트 일관성
grep -rn "8086\|8181" docker-compose.yml scripts/ | head -20

# 0-2: control-panel 이미지 크기 확인
docker build -t control-panel:optimized ./apps/control-panel && \
docker images control-panel:optimized --format '{{.Size}}'  # < 200MB

# 0-3: mock-server 재현 가능 빌드
grep 'npm ci' apps/mock-server/Dockerfile  # npm ci 사용 확인

# 0-4: 하드코딩 시크릿 검출
grep -rn 'token\|password\|secret' Makefile docker-compose.yml \
  --include='*.yml' --include='Makefile' | grep -v '#'
```

---

### Stage 1: K8s 매니페스트 및 Helm 차트 신규 생성 (45-55시간)

#### 목표
Makefile 타겟이 참조하는 k8s 디렉토리 구조와 Helm 차트를 **처음부터 생성**. Kind 클러스터에서 전체 플랫폼 동작 검증.

> **참고**: `k8s/` 디렉토리는 현재 존재하지 않음. Makefile의 Kind 타겟(374-512), Helm 타겟, ArgoCD 타겟(518-668)이 참조하는 경로와 일치하도록 생성해야 함.

#### 태스크

**1-1. 디렉토리 구조 생성**

```
k8s/
├── kind/
│   └── cluster-config.yaml       # Makefile:390 참조
├── manifests/
│   ├── namespace.yaml
│   ├── postgres.yaml             # StatefulSet + PVC
│   └── influxdb-deployment.yaml
└── helm/
    ├── control-panel/            # Makefile helm 타겟 참조
    │   ├── Chart.yaml
    │   ├── values.yaml
    │   └── templates/
    ├── k6-runner/
    │   ├── Chart.yaml
    │   ├── values.yaml
    │   └── templates/
    └── mock-server/
        ├── Chart.yaml
        ├── values.yaml
        └── templates/
```

- **수용 기준**: `make kind-create` 실행 시 파일 참조 에러 없음

**1-2. Helm 차트 작성 (K8s-ready 배포 매니페스트)**
- 각 서비스별 Deployment, Service, ConfigMap 템플릿
- InfluxDB: StatefulSet + PVC (로컬은 emptyDir)
- `values.yaml`에 환경별 오버라이드 지원
- **Helm values → ECS task definition 매핑 문서** 작성 (Stage 3 연계)
  - 매핑 대상: 이미지, CPU/Memory, 환경변수, 포트, 헬스체크
  - 수동 매핑 (자동 변환 도구 구축은 스코프 외)
- **수용 기준**: `helm template` 렌더링 성공, `helm lint` 경고 0건

**1-3. Kind 클러스터 통합 테스트**
- Kind 클러스터 생성 및 이미지 로드
- 전체 서비스 배포 및 헬스체크
- k6 테스트 실행 → InfluxDB 데이터 수집 확인
- **수용 기준**: Kind에서 전체 파이프라인 (k6 실행 → InfluxDB 저장 → 결과 조회) 동작

> **ArgoCD는 Stage 4 선택사항으로 이연.** Stage 1에서는 ArgoCD 관련 파일을 생성하지 않음.

#### 검증 명령어

```bash
# 1-1: 디렉토리 구조 확인
ls -la k8s/kind/ k8s/manifests/ k8s/helm/control-panel/templates/

# 1-2: Helm 템플릿 유효성
helm template k6-platform k8s/helm/control-panel \
  | kubectl apply --dry-run=client -f -
helm lint k8s/helm/control-panel k8s/helm/k6-runner k8s/helm/mock-server

# 1-3: Kind 전체 동작 검증
kubectl get pods -n k6-platform                    # 모든 Pod Running
kubectl exec -n k6-platform deploy/control-panel \
  -- curl -sf http://localhost:3000/health         # 헬스체크
```

---

### Stage 2: AWS 인프라 Terraform 구성 (35-45시간)

#### 목표
ECS Fargate 기반 프로덕션 인프라를 Terraform으로 프로비저닝

#### 태스크

**2-1. Terraform 프로젝트 구조 설정**

```
infrastructure/
└── terraform/
    ├── environments/
    │   └── dev/
    │       ├── main.tf
    │       ├── variables.tf
    │       ├── terraform.tfvars
    │       └── backend.tf          # S3 + DynamoDB state
    ├── modules/
    │   ├── vpc/                    # VPC + Subnets + NAT/VPC Endpoints
    │   ├── ecr/                    # ECR repositories (3개)
    │   ├── ecs/                    # ECS Cluster + Services + Task Definitions
    │   ├── ec2-influxdb/           # t4g.micro for InfluxDB
    │   ├── alb/                    # ALB + HTTPS + ACM
    │   ├── rds/                    # RDS PostgreSQL
    │   ├── secrets/                # Secrets Manager
    │   ├── monitoring/             # CloudWatch (free tier)
    │   └── eks/                    # TO-BE (plan only, 실배포 안 함)
    └── docs/
        ├── cost-analysis.md
        └── eks-migration.md
```

- **수용 기준**: `terraform init` + `terraform validate` 성공

**2-2. ECS Fargate 서비스 정의**
- control-panel: Fargate Spot task (256 CPU, 512 MiB)
- mock-server: Fargate Spot task (256 CPU, 512 MiB)
- k6-runner: Fargate Spot task (512 CPU, 1024 MiB)
- ALB: HTTPS 리스너 + ACM 인증서 + 경로 기반 라우팅
- ECS Deployment Circuit Breaker 활성화 (롤백 자동화)
- **수용 기준**: ECS 서비스 RUNNING, ALB 헬스체크 통과

**2-3. InfluxDB EC2 인스턴스 (프로덕션 전용)**
- t4g.micro (2 vCPU, 1GB RAM) + EBS gp3 8GB
- `--object-store file --ram-pool-data-bytes 512000000`
- 보안 그룹: ECS 서비스에서만 8086 접근 허용
- xk6-output-influxdb 토큰 인증 호환성 검증
- **스케일업 트리거**: write latency p99 > 200ms → t4g.small($7.30/월)로 업그레이드
- **수용 기준**: InfluxDB 8086 포트 응답, ECS에서 토큰 인증 쓰기 성공

**2-4. RDS PostgreSQL 프로비저닝**
- db.t4g.micro (dev)
- control-panel Prisma 데이터 저장용
- 자동 백업 활성화 (7일 보존)
- Private 서브넷 배치, ECS 보안 그룹에서만 접근
- **수용 기준**: control-panel DB 마이그레이션 (`npx prisma migrate deploy`) 성공

**2-5. 시크릿 관리**
- AWS Secrets Manager 또는 SSM Parameter Store SecureString
- InfluxDB 토큰, DB 비밀번호, API 키 저장
- ECS task role에 읽기 권한
- IAM 최소 권한 원칙
- **수용 기준**: ECS 태스크가 환경변수로 시크릿 주입받아 정상 기동

**2-6. 모니터링 및 알람 (CloudWatch Free Tier)**
- CloudWatch Logs: ECS 서비스 + InfluxDB EC2 로그
- CloudWatch Metrics: CPU, Memory, ALB 5xx rate
- CloudWatch Alarms: CPU > 80%, Memory > 85%, 5xx rate > 5%
- **수용 기준**: 알람 설정 확인, 테스트 알림 수신

**2-7. EKS 목표 아키텍처 Terraform 모듈 (문서용)**
- EKS 모듈 작성 (실배포 하지 않음, `terraform plan`까지만)
- Fargate Profile 설정 (k6-platform namespace)
- 비용 분석 문서:
  - EKS control plane: $73/월
  - Fargate pods (5개, Spot): ~$40/월
  - 기타 (ALB, NAT, ECR): ~$15/월
  - 합계: ~$128/월
- **수용 기준**: `terraform plan` 성공 (apply 안 함), cost-analysis.md 작성 완료

#### 검증 명령어

```bash
# 2-1: Terraform 유효성
cd infrastructure/terraform/environments/dev && \
  terraform validate && terraform plan -out=plan.out

# 2-2: ECS 서비스 상태
aws ecs describe-services --cluster k6-platform \
  --services control-panel mock-server k6-runner \
  --query 'services[].{name:serviceName,status:status,running:runningCount}'

# 2-3: InfluxDB EC2 상태
curl -sf http://{INFLUXDB_PRIVATE_IP}:8086/health  # healthy 응답

# 2-4: RDS 접속
aws rds describe-db-instances --db-instance-identifier k6-platform-db \
  --query 'DBInstances[].{Status:DBInstanceStatus}'

# 2-5: 시크릿 존재 확인
aws secretsmanager list-secrets --filters Key=name,Values=k6-platform

# 2-6: 알람 상태
aws cloudwatch describe-alarms --alarm-name-prefix k6-platform \
  --query 'MetricAlarms[].{Name:AlarmName,State:StateValue}'
```

---

### Stage 3: CI/CD 파이프라인 + 프로덕션 배포 (35-45시간)

#### 목표
코드 푸시부터 프로덕션 배포까지 자동화. `.github/` 디렉토리를 **처음부터 생성**.

#### 태스크

**3-1. GitHub Actions 워크플로우 구조**

```
.github/
├── workflows/
│   ├── ci.yml              # PR: lint, test, build
│   ├── build-push.yml      # main merge: ECR push
│   └── deploy.yml          # ECR push → ECS deploy
└── actions/
    └── setup-aws/
        └── action.yml      # 재사용 가능 AWS 설정 (OIDC)
```

- **수용 기준**: 3개 워크플로우 파일 존재

**3-2. CI 파이프라인 (ci.yml)**
- PR 이벤트 트리거
- Docker 이미지 빌드 테스트 (빌드만, 푸시 안 함)
- 유닛 테스트 실행
- Dockerfile lint (hadolint)
- **수용 기준**: PR 생성 시 CI 자동 실행

**3-3. Build & Push 파이프라인 (build-push.yml)**
- main 브랜치 push 트리거
- 서비스별 Docker 이미지 빌드
- ECR 푸시 (태그: git SHA + latest)
- Helm values → ECS task definition 매핑 적용 (Stage 1 문서 기반, 수동 매핑)
- **수용 기준**: main 푸시 후 ECR에 새 이미지 태그 존재

**3-4. Deploy 파이프라인 (deploy.yml)**
- build-push 완료 후 자동 트리거
- ECS 서비스 업데이트 (새 task definition 배포)
- 배포 후 헬스체크 대기 (5분 타임아웃)
- ECS Deployment Circuit Breaker: 헬스체크 실패 시 자동 롤백
- **수용 기준**: main 푸시 → ECR → ECS 자동 배포, 헬스체크 통과

**3-5. 도메인 및 SSL 설정**
- ACM 인증서 발급 + ALB HTTPS 리스너
- HTTP → HTTPS 리다이렉트
- Route 53 (자체 도메인 사용 시) 또는 ALB DNS 직접 사용
- **수용 기준**: `curl -sf https://{DOMAIN}/health` 200 응답

#### 검증 명령어

```bash
# 3-1: 워크플로우 파일 존재
ls -la .github/workflows/ci.yml .github/workflows/build-push.yml .github/workflows/deploy.yml

# 3-3: ECR 이미지 태그 확인
aws ecr describe-images --repository-name k6-platform/control-panel \
  --query 'imageDetails | sort_by(@, &imagePushedAt) | [-1].imageTags'

# 3-4: ECS 배포 + 롤백 설정 확인
aws ecs describe-services --cluster k6-platform --services control-panel \
  --query 'services[].deploymentConfiguration.deploymentCircuitBreaker'

# 3-5: HTTPS 동작 확인
curl -sf https://{ALB_DNS}/health                                    # HTTP 200
curl -sf -o /dev/null -w '%{http_code}' http://{ALB_DNS}/health      # 301 (redirect)
```

---

### Stage 4: 문서화 + 포트폴리오 정리 + 선택적 확장 (20-30시간)

#### 목표
포트폴리오로서의 완성도 확보. ArgoCD 등 선택적 기능 추가.

#### 태스크

**4-1. 아키텍처 문서 (필수)**
- AS-IS 아키텍처 다이어그램 (Docker Compose, Mermaid)
- TO-BE 아키텍처 다이어그램:
  - 현재 프로덕션: ECS Fargate + EC2
  - 목표 프로덕션: EKS + Fargate (비용 분석 포함)
- 인프라 비용 비교표 (ECS vs EKS vs EC2 직접 배포)
- 산출물: `docs/architecture/`

**4-2. README 최종 정리 (필수)**
- 프로젝트 소개 (한국어 + 영어)
- 아키텍처 다이어그램 (AS-IS → TO-BE 변천)
- 기술 스택 및 선택 이유 요약
- 로컬 개발 가이드 (Docker Compose)
- Kind K8s 로컬 테스트 가이드
- 프로덕션 배포 가이드 (Terraform + GitHub Actions)
- 데모 URL 및 스크린샷
- ADR 목록 및 링크

**4-3. 포트폴리오 핵심 포인트 정리 (필수)**
- "왜 EKS가 아니라 ECS인가" → 비용 분석 + 실용적 의사결정 역량 시연
- "왜 하이브리드인가" → Kind(K8s역량) + ECS(비용최적화) + Terraform(IaC역량) 통합
- GitOps 패턴: ArgoCD(로컬) + GitHub Actions CD(프로덕션) 이원화 전략

**4-4. ArgoCD 설정 (선택)**
- `k8s/argocd/applications/` 디렉토리 생성
- ArgoCD Application 매니페스트
- Makefile ArgoCD 타겟(518-668)과 정합성 확인
- Kind 클러스터에서 ArgoCD sync 시연
- **수용 기준**: ArgoCD UI에서 애플리케이션 Synced 상태

**4-5. 오토스케일링 정책 (선택)**
- ECS Service Auto Scaling (CPU/Memory 기반)
- **수용 기준**: 부하 테스트 시 ECS 태스크 수 자동 증가

#### 검증 명령어

```bash
# 4-1: 문서 존재 확인
ls docs/architecture/as-is.md docs/architecture/to-be-ecs.md docs/architecture/to-be-eks.md

# 4-2: README 핵심 섹션 확인
grep -c '## ' README.md  # 최소 8개 섹션

# 4-4: ArgoCD (적용 시)
kubectl get applications -n argocd
```

---

## 비용 추정 (월간, v2 최적화 기준)

| 서비스 | 사양 | 월 비용 |
|--------|------|---------|
| ECS Fargate (3 services, **Spot**) | 1 vCPU / 2GB total | ~$8-12 |
| EC2 t4g.micro (InfluxDB) | 2 vCPU / 1GB + 8GB EBS gp3 | ~$3.64 |
| RDS db.t4g.micro (PostgreSQL) | | ~$6.50 |
| ALB | 1개 | ~$5-7 |
| NAT Gateway (단일 AZ) 또는 VPC Endpoints | | ~$3-4 |
| ECR | ~2GB 이미지 스토리지 | ~$0.50 |
| CloudWatch | Free Tier 활용 | ~$0 |
| SSM Parameter Store | SecureString 5-10개 | ~$0.50 |
| **합계** | | **~$27-34/월** |

> **비용 절감 옵션**: NAT Gateway 대신 VPC Endpoints(S3, ECR, CloudWatch) 사용 시 $3-4 추가 절감
> **스케일업 트리거**: InfluxDB write latency p99 > 200ms → t4g.small($7.30/월)로 업그레이드

---

## 보안 체크리스트

- [ ] Makefile 하드코딩 InfluxDB 토큰 → AWS Secrets Manager/SSM 이전
- [ ] docker-compose.yml 하드코딩 자격증명 환경변수화
- [ ] control-panel Dockerfile에서 `docker.io` 패키지 제거
- [ ] ECS task role: 최소 권한 원칙 (Secrets 읽기만)
- [ ] 보안 그룹: InfluxDB EC2는 ECS에서만 접근 (8086 포트)
- [ ] ALB: HTTPS 강제, HTTP → HTTPS 리다이렉트
- [ ] ECR 이미지 스캔 활성화
- [ ] GitHub Actions: AWS OIDC 인증 (장기 Access Key 사용 금지)

## 롤백 전략

| 계층 | 방법 | 소요 시간 |
|------|------|-----------|
| ECS 서비스 | Deployment Circuit Breaker 자동 롤백 | 3-5분 |
| ECS 수동 | `aws ecs update-service --task-definition {이전버전}` | 5-10분 |
| Terraform | `terraform plan` 확인 후 이전 상태 apply | 10-15분 |
| InfluxDB | EBS 스냅샷 복원 | 15-30분 |
| RDS | 자동 백업 point-in-time 복원 | 30-60분 |

## 모니터링

- **CloudWatch Dashboard**: ECS CPU/Memory, ALB 요청수/지연/에러율, InfluxDB 디스크/메모리
- **CloudWatch Alarms**: CPU > 80%, Memory > 85%, 5xx rate > 5%
- **알람 채널**: SNS → 이메일 (또는 Slack/Discord)
- **Grafana (자체)**: k6 테스트 결과, 시계열 데이터 시각화

---

## Pre-mortem (실패 시나리오)

### 시나리오 1: NAT Gateway 비용 초과
NAT Gateway 트래픽이 예상보다 많아 월 $10+ 추가 과금. 전체 비용 $40/월 초과.
- **예방**: VPC Endpoints(S3, ECR, CloudWatch)를 NAT Gateway 대신 사용
- **완화**: Terraform에서 NAT Gateway를 조건부 리소스로 설정, 비용 알람 $35에서 트리거

### 시나리오 2: Helm/ECS 설정 괴리
Helm 차트(Kind용)와 ECS task definition이 완전히 다른 구조라 이중 유지보수 발생.
- **예방**: Stage 1에서 Helm values → ECS 매핑 문서 작성 (수동 매핑, 자동화 도구 미구축)
- **완화**: 공통 설정(이미지, 환경변수, 포트) 추출하여 `.env.production` 파일로 단일 소스화

### 시나리오 3: InfluxDB OOM on t4g.micro
EC2 t4g.micro(1GB RAM)에서 InfluxDB가 메모리 부족으로 OOM 발생.
- **예방**: `--ram-pool-data-bytes 512000000` 메모리 캡, swap 파일 1GB 설정
- **완화**: t4g.small($7.30/월)로 업그레이드, write latency p99 > 200ms가 트리거
- **최후 수단**: CloudWatch Metrics + k6 JSON output으로 InfluxDB 대체

---

## 리스크 관리

| 리스크 | 확률 | 영향 | 완화 전략 |
|--------|:---:|:---:|-----------|
| ECS Fargate Spot 중단 | 중 | 중 | InfluxDB는 EC2 분리라 데이터 무손실. ECS 자동 재배포 |
| InfluxDB EC2 장애 | 낮 | 높 | EBS 스냅샷 자동화, CloudWatch 모니터링 |
| 월 비용 $30 초과 | 중 | 중 | VPC Endpoints 전환, 비용 알람 설정 |
| Kind ↔ ECS 설정 괴리 | 중 | 낮 | Helm values + ECS 매핑 문서로 관리 |
| Terraform 학습 곡선 | 높 | 중 | 공식 모듈(terraform-aws-modules) 활용 |
| xk6-output-influxdb 토큰 인증 실패 | 낮 | 높 | Stage 0에서 사전 검증 |

---

## 시간 추정 종합

| Stage | 작업 내용 | 시간 | 누적 |
|-------|-----------|:---:|:---:|
| **Stage 0** | Docker 최적화 + 기반 정리 | 15-20h | 15-20h |
| **Stage 1** | K8s/Helm 신규 생성 + Kind 검증 | 45-55h | 60-75h |
| **Stage 2** | Terraform + AWS 인프라 | 35-45h | 95-120h |
| **Stage 3** | CI/CD + 프로덕션 배포 | 35-45h | 130-165h |
| **Stage 4** | 문서화 + 포트폴리오 + 선택 확장 | 20-30h | 150-195h |
| | | | |
| **필수 (Stage 0-3)** | | **130-165h** | |
| **전체 (Stage 4 포함)** | | **150-195h** | |

> **시간 예산**: 평일 1-2시간 + 주말 8시간 = 주당 ~18-23.5시간
> **예상 기간**: 필수 7-9주, 전체 8-11주 (12주 이내)
> **컷라인**: Stage 2 완료(K8s + Terraform) = 최소 포트폴리오 제출 가능

---

## 마일스톤 체크포인트

| 마일스톤 | 주차 | 핵심 산출물 | 체크포인트 |
|----------|:---:|------------|-----------|
| M0: 기술 부채 해소 | Week 1 | 최적화된 Dockerfile, 시크릿 감사 보고 | `docker build` 성공, 이미지 < 200MB |
| M1: Kind 동작 | Week 4 | Helm 차트, Kind 배포 | `kubectl get pods` 모두 Running |
| M2: AWS 인프라 | Week 6-7 | Terraform 코드, ECS/EC2/RDS | `terraform apply` 성공, 비용 $30/월 이하 |
| M3: CI/CD 완성 | Week 8-9 | GitHub Actions, 자동 배포 | PR → CI → merge → 자동 배포 |
| M4: 포트폴리오 완성 | Week 10-11 | README, 아키텍처 다이어그램, ADR | 면접 대비 문서 완성 |

### 주간 루틴
- **매주 일요일**: 주간 진행 상황 정리, 다음 주 태스크 확인
- **격주**: AWS Billing 점검, 일정 대비 진행률 점검

---

## 산출물 디렉토리 구조 (최종)

```
k6-testing-platform/
├── apps/                              # 기존 애플리케이션
│   ├── control-panel/                 # Next.js (Dockerfile 최적화)
│   ├── k6-runner-v2/                  # Express + xk6
│   └── mock-server/                   # NestJS (npm ci 적용)
├── k8s/                               # [신규] K8s 매니페스트
│   ├── kind/                          # Kind 클러스터 설정
│   ├── manifests/                     # 기본 K8s 매니페스트
│   ├── helm/                          # Helm 차트 (3 서비스)
│   └── argocd/                        # [선택] ArgoCD 설정
├── infrastructure/                    # [신규] 인프라 코드
│   └── terraform/
│       ├── environments/dev/          # 실배포 환경 (ECS)
│       ├── modules/                   # Terraform 모듈
│       └── docs/                      # 비용 분석, EKS 마이그레이션 가이드
├── .github/                           # [신규] CI/CD
│   ├── workflows/                     # GitHub Actions
│   └── actions/                       # 재사용 가능 액션
├── docs/                              # [신규/확장] 문서
│   ├── architecture/                  # AS-IS, TO-BE 다이어그램
│   ├── adr/                           # ADR 문서 (3-5개)
│   └── work-plan-aws-migration.md     # 이 문서
├── docker-compose.yml                 # 로컬 개발 (현행 유지)
├── Makefile                           # Kind + Helm 명령어 (기존 보강)
└── README.md                          # 최종 정리 (포트폴리오)
```

---

## 미해결 사항 (Open Questions)

1. **도메인**: 자체 도메인 사용 여부 → SSL 인증서 발급 방식에 영향
2. **InfluxDB 데이터 보존 기간**: EBS 볼륨 크기 산정 기준 (30일? 90일?)
3. **멀티 환경**: dev/staging/production 모두 필요한지, production only로 충분한지
4. **GitHub Actions 러너**: GitHub-hosted vs self-hosted, Docker 빌드 캐시 전략
5. **Bitbucket → GitHub 전환**: 현재 Bitbucket Pipelines 흔적이 있는데 GitHub Actions로 전환 근거 ADR 필요 여부
