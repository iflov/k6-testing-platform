# K6 Testing Platform - GKE 기반 포트폴리오 데모 배포 작업 계획서

> **문서 성격:** reviewed planning artifact
> **현재 참고 우선순위:** 구현 현황은 `docs/work-plan-gke-migration-implementation-status.md`, 운영 절차는 `docs/runbook/demo-gitops-runbook.md` 우선
> **버전:** v2-reviewed
> **작성일:** 2026-03-09
> **컨센서스:** Planner + Architect (GKE 리뷰) + Critic → 조건부 APPROVED
> **이전 문서:** `docs/work-plan-aws-migration.md` (AWS ECS 기반, 참고용 보존)
> **전환 근거:** ADR-001 참조 (GKE 클러스터 관리비는 free tier credit으로 상쇄 가능, $300 크레딧으로 초기 실험 비용 완충)

---

## RALPLAN-DR 요약

### 원칙 (Principles)

1. **비용 최적화 우선**: GCP $300 크레딧 + GKE free tier credit 활용, 초기 3개월 비용을 크레딧 범위 내로 유지
2. **실제 GKE 운영 경험**: Kind/Minikube가 아닌 GKE 실 클러스터에서 Helm, ArgoCD, RBAC, Workload Identity 운영
3. **GitOps 기반 배포**: GitHub Actions(CI) + ArgoCD(CD)로 선언적 배포 파이프라인
4. **멀티클라우드 인사이트**: GKE 실배포 + AWS EKS/ECS Terraform 모듈(문서용)로 클라우드 의사결정 역량 증명
5. **간헐적 운영 최적화**: 평소 로컬 Docker Compose, 이력서 제출 시에만 GKE 클러스터 가동

### 핵심 결정 동인 (Decision Drivers)

1. **비용**: GKE Standard 단일 zonal 클러스터는 관리비가 free tier credit으로 대부분 상쇄되며, EKS는 $73/월 고정
2. **K8s 네이티브 경험**: Helm + ArgoCD + Terraform이 실제 GKE에서 동작하는 포트폴리오
3. **크레딧 활용**: GCP 신규 가입 $300/90일 미사용 상태

### 비교 옵션 분석

| 항목 | GKE Standard Zonal (선택) | AWS EKS | AWS ECS Fargate |
|------|:---:|:---:|:---:|
| 컨트롤 플레인 비용 | **월간 net $0에 근접 (free tier credit 적용 시)** | $73/월 | N/A |
| K8s 네이티브 | **완전 K8s** | 완전 K8s | K8s 아님 |
| Helm/ArgoCD | **실무형 사용** | 실무형 사용 | 불가 |
| 3개월 총 비용 | **크레딧 내 상쇄 가능** | $220+ | $10-30 |
| Free Credits | **$300/90일** | 없음 | 없음 |
| Workload Identity | **네이티브** | IRSA (복잡) | Task Role |
| 포트폴리오 가치 | **최고 (K8s 풀스택)** | 최고 | 중간 |

**EKS 무효화 사유**: 컨트롤 플레인 $73/월 고정, 3개월 $220+로 GKE 대비 비용 부담이 큼
**ECS 무효화 사유**: K8s 아님, Helm/ArgoCD 불가, 포트폴리오 "K8s 운영 경험" 어필 불가

---

## ADR (Architecture Decision Records)

### ADR-001: 왜 GKE인가 (EKS/ECS 비용 분석 포함)

| 항목 | 내용 |
|------|------|
| **결정** | GKE Standard Zonal 클러스터를 포트폴리오 데모 배포 타겟으로 선택 |
| **동인** | GKE 관리비 free tier credit 상쇄, $300 크레딧 90일, 실 K8s 운영 경험 |
| **대안 1: AWS EKS** | K8s 동일 경험이나 컨트롤 플레인 $0.10/hr 고정. 간헐적 사용에서 크레딧 대비 비효율 |
| **대안 2: AWS ECS** | K8s 아님. Helm/ArgoCD 불가. "K8s 운영 경험" 어필 불가 |
| **대안 3: GKE Autopilot** | 노드 관리 불필요, Pod당 과금. 간헐적 사용에 유리할 수 있으나, 세밀한 리소스 제어 어려움. 노드 수준 커스터마이징(DaemonSet 등) 제한. 추후 재평가 가능 |
| **선택 사유** | 동일 K8s 경험을 EKS 대비 낮은 초기 비용으로 확보. GCP 크레딧으로 초기 시행착오 비용을 흡수 가능. 면접에서 "비용 분석 후 GKE 선택" = 실용적 의사결정 역량 증명 |
| **결과** | GCP 학습 곡선 발생, AWS 실배포 경험은 Terraform 모듈+ADR로만 보여줌 |
| **후속** | 90일 크레딧 만료 전 비용 알림, 크레딧 소진 후 클러스터 삭제 또는 최소 비용 유지 |

### ADR-002: InfluxDB 영속성 (GCE VM)

| 항목 | 내용 |
|------|------|
| **결정** | GCE e2-small 인스턴스에 Docker로 InfluxDB 배포, `--object-store file` 사용 |
| **동인** | InfluxDB 3.x는 공식 Helm 미제공, K8s StatefulSet 운영 복잡, 전용 VM이 가장 단순 |
| **대안 1: K8s StatefulSet** | PV/PVC 관리 + 노드 어피니티 복잡도 대비 이점 없음 |
| **대안 2: GCS object-store** | InfluxDB 3.x Core는 GCS 미지원 (Enterprise만) |
| **대안 3: CloudWatch/Timestream** | k6 xk6-output-influxdb 확장과 비호환 |
| **설정** | `--object-store file --data-dir /var/lib/influxdb3 --ram-pool-data-bytes 536870912` (512MB 캡) |
| **스케일업 트리거** | write latency p99 > 200ms → e2-medium 업그레이드 |

### ADR-003: CI/CD 파이프라인 (GitHub Actions + ArgoCD on GKE)

| 항목 | 내용 |
|------|------|
| **결정** | GitHub Actions(CI: 빌드/테스트/이미지 푸시) + ArgoCD(CD: GKE GitOps 배포) |
| **동인** | GitOps는 업계 표준, ArgoCD가 GKE에서 네이티브 동작, Makefile에 ArgoCD 타겟 기존재 |
| **대안 1: GitHub Actions만** | GitOps 아님, 상태 드리프트 감지 불가 |
| **대안 2: FluxCD** | ArgoCD 대비 시장 점유율 낮음, 이직 시 ArgoCD 경험이 더 인정 |
| **대안 3: Cloud Build** | GitHub Actions 대비 생태계 좁음 |
| **파이프라인** | Push → GitHub Actions: lint, test, build, Artifact Registry push → Helm values 업데이트 → ArgoCD auto-sync |

### ADR-004: Terraform 멀티클라우드 구조

| 항목 | 내용 |
|------|------|
| **결정** | GCP 모듈 실배포 + AWS 모듈 문서용(`terraform plan`까지만) |
| **동인** | IaC 역량 + 멀티클라우드 설계 능력 포트폴리오 증명 |
| **구조** | `terraform/modules/gcp/` (실배포) + `terraform/modules/aws/` (문서용, `# DOCUMENTATION ONLY` 표기) |
| **AWS 모듈 포함** | EKS, EC2-InfluxDB, RDS, VPC — `terraform validate` + `terraform plan` 통과 확인 |
| **면접 대응** | "왜 AWS도 설계?" → 동일 아키텍처의 멀티클라우드 설계, 비용/트레이드오프 분석 역량 |

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
IaC: 없음
K8s: 없음 (k8s/ 디렉토리 없음, Makefile 타겟만 존재)
```

### 식별된 기술 부채

| 항목 | 위치 | 설명 |
|------|------|------|
| docker.io 설치 | `apps/control-panel/Dockerfile:31` | 프로덕션 이미지 200MB+ 불필요 패키지 |
| npm install | `apps/mock-server/Dockerfile:9` | `npm ci` 사용해야 재현 가능 빌드 |
| 하드코딩 토큰 | `Makefile:424` | InfluxDB `apiv3_...` 토큰 |
| InfluxDB 비영속 | `docker-compose.yml:90` | `--object-store memory`, 재시작 시 데이터 소실 |
| 포트 불일치 | `init-influxdb.sh:9` vs `docker-compose.yml` | 8086 vs 8181 |
| 빈 디렉토리 | `k8s/`, `.github/workflows/` | Makefile 참조하나 파일 없음 |
| 디버그 문 | `process-manager.service.ts` | 30+ console.warn/error 잔류 |

---

## 목표 상태 (TO-BE)

### GKE 데모/스테이징 아키텍처

```
[Browser] → [kubectl port-forward / Ingress (데모 시)]
                └── [GKE Standard Zonal Cluster (asia-northeast3-a)]
                    ├── Namespace: k6-platform
                    │   ├── [Control Panel Deployment] → [Cloud SQL PostgreSQL]
                    │   ├── [K6 Runner Deployment]     → [GCE InfluxDB VM]
                    │   └── [Mock Server Deployment]
                    └── Namespace: argocd
                        └── [ArgoCD (server + repo-server + app-controller)]

[GCE e2-small VM] → InfluxDB 3.x (--object-store file + Persistent Disk 20GB SSD)

[GitHub Actions] → [Artifact Registry] → [ArgoCD auto-sync] → [GKE]
[Terraform]      → [VPC + GKE + Cloud SQL + GCE + Artifact Registry]
```

---

## Pod 리소스 제한 (Architect 권고 반영)

> **노드**: e2-medium (2 vCPU, 4GB RAM) — allocatable ~3.5GB after GKE system reservation

| Pod | CPU Request | CPU Limit | Memory Request | Memory Limit | 비고 |
|-----|:-----------:|:---------:|:--------------:|:------------:|------|
| ArgoCD server | 50m | 200m | 128Mi | 256Mi | UI + API |
| ArgoCD repo-server | 50m | 200m | 128Mi | 256Mi | Git clone + manifest 생성 |
| ArgoCD app-controller | 100m | 500m | 256Mi | 512Mi | reconciliation loop |
| control-panel | 200m | 500m | 256Mi | 512Mi | Next.js SSR + Prisma |
| k6-runner | 500m | 1000m | 256Mi | 768Mi | xk6 Go binary, VU당 메모리 증가 |
| mock-server | 100m | 300m | 64Mi | 256Mi | 경량 NestJS |
| **합계 (request)** | **1050m** | | **1088Mi** | | ~1.1GB, 여유 ~2.4GB |
| **합계 (limit)** | | **2900m** | | **2560Mi** | ~2.5GB, 여유 ~1GB |

> **k6 테스트 실행 시**: k6-runner가 VU당 10-20MB 추가 사용. 10 VUs = ~200MB 추가. e2-medium(4GB)으로 충분한 헤드룸 확보.

---

## Stage별 상세 작업 계획

### Stage 0: Docker 최적화 + 기술 부채 해결 (8-10시간, Week 1-2)

#### 태스크

**0-1. control-panel Dockerfile 최적화**
- `docker.io` 패키지 제거 (apps/control-panel/Dockerfile:31)
- multi-stage 빌드 프로덕션 스테이지 최적화
- **수용 기준**: 이미지 200MB 미만

**0-2. mock-server Dockerfile 수정**
- `npm install` → `npm ci` (재현 가능 빌드)
- **수용 기준**: `grep 'npm ci' apps/mock-server/Dockerfile` 확인

**0-3. InfluxDB 환경별 전략 확정**
- 로컬: `--object-store memory` 유지
- 프로덕션 GCE: `--object-store file --ram-pool-data-bytes 536870912`
- 포트 불일치 수정 (8086 vs 8181 통일)
- xk6-output-influxdb 토큰 인증 호환성 검증
- **수용 기준**: 로컬 `docker compose up` 정상, 토큰 인증 k6 write 성공

**0-4. 하드코딩 시크릿 감사**
- Makefile:424 InfluxDB 토큰 → `.env` + `.env.example`
- .env 파일 5개 변수별 시크릿 관리 매핑
- **수용 기준**: 하드코딩 시크릿 0건

#### 검증 명령어

```bash
# 이미지 크기 확인
docker build -t control-panel:opt ./apps/control-panel && \
  docker images control-panel:opt --format '{{.Size}}'

# npm ci 확인
grep 'npm ci' apps/mock-server/Dockerfile

# InfluxDB 포트 일관성
grep -rn "8086\|8181" docker-compose.yml scripts/

# 시크릿 스캔
grep -rn 'apT4C1M3RFAFzw\|password.*=.*[^$]' Makefile docker-compose.yml
```

---

### Stage 1: Helm 차트 + 로컬 Kind 검증 (14-18시간, Week 3-4)

#### 태스크

**1-1. Helm 차트 구조 생성**

```
helm/
└── k6-platform/
    ├── Chart.yaml
    ├── values.yaml               # 기본값 + 리소스 limits/requests
    ├── values-local.yaml         # Kind용 (NodePort, 낮은 리소스)
    ├── values-gke-dev.yaml       # GKE용 (Artifact Registry, Workload Identity)
    ├── templates/
    │   ├── _helpers.tpl
    │   ├── control-panel/
    │   │   ├── deployment.yaml
    │   │   ├── service.yaml
    │   │   └── hpa.yaml
    │   ├── k6-runner/
    │   │   ├── deployment.yaml
    │   │   ├── service.yaml
    │   │   └── serviceaccount.yaml
    │   ├── mock-server/
    │   │   ├── deployment.yaml
    │   │   ├── service.yaml
    │   │   └── hpa.yaml
    │   ├── postgresql/
    │   │   └── external-service.yaml    # Cloud SQL 연결
    │   ├── configmap.yaml
    │   ├── secrets.yaml
    │   ├── networkpolicy.yaml
    │   └── rbac.yaml
    └── tests/
        └── test-health.yaml
```

- Makefile의 Helm 타겟 경로(`k8s/helm/`)와 정합성 확인
- 동일 PR에서 Makefile/README의 기존 `k8s/helm/*`, `k8s/argocd/*` 참조를 새 경로로 일괄 정리
- **values.yaml에 Pod 리소스 limits/requests 명시** (위 테이블 기준)
- **수용 기준**: `helm lint` 통과, `helm template` 유효한 K8s YAML 출력

**1-2. Kind 로컬 통합 테스트**
- Kind 클러스터 생성 + 이미지 로드
- `helm install` → 모든 Pod Running
- k6 테스트 실행 → InfluxDB 데이터 수집 확인
- **수용 기준**: 전체 파이프라인 동작 (k6 실행 → InfluxDB → 결과 조회)

#### 검증 명령어

```bash
# Helm 검증
helm lint helm/k6-platform/
helm template k6-platform helm/k6-platform/ -f helm/k6-platform/values-local.yaml \
  | kubectl apply --dry-run=client -f -

# Kind 배포
kind create cluster --name k6-test
helm install k6-platform helm/k6-platform/ -f helm/k6-platform/values-local.yaml
kubectl get pods -n k6-platform -w

# 통합 테스트
helm test k6-platform -n k6-platform
```

---

### Stage 2: Terraform GCP 인프라 + CI/CD + ArgoCD (35-45시간, Week 5-8)

#### 태스크

**2-1. GCP 프로젝트 초기 설정**
- GCP 프로젝트 생성 + 빌링 ($300 크레딧 연결)
- API 활성화: GKE, Compute, Cloud SQL, Artifact Registry, IAM
- 서비스 어카운트: Terraform용, GitHub Actions용 (Workload Identity Federation)
- **수용 기준**: `gcloud projects describe` 성공, API 활성화

**2-2. Terraform GCP 모듈 작성**

```
terraform/
├── modules/
│   ├── gcp/
│   │   ├── vpc/                # VPC + 서브넷 + 방화벽 + Private Google Access
│   │   ├── gke/                # Standard Zonal, e2-medium 노드풀 (운영 시 min 1 / max 3)
│   │   ├── cloud-sql/          # PostgreSQL 16, shared-core (demo/staging), private IP
│   │   ├── gce-influxdb/       # e2-small, Docker + docker-compose, 영속 디스크
│   │   └── artifact-registry/  # Docker 레포지토리
│   └── aws/                    # 문서용 (# DOCUMENTATION ONLY)
│       ├── eks/                # EKS 클러스터
│       ├── ec2-influxdb/       # EC2 InfluxDB
│       ├── rds/                # RDS PostgreSQL
│       └── vpc/                # VPC
├── environments/
│   ├── gcp-dev/                # 실배포
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── terraform.tfvars
│   │   └── backend.tf          # GCS remote state
│   └── aws-dev/                # 문서용
│       ├── main.tf
│       └── README.md           # "왜 AWS도 설계했는가"
└── docs/
    ├── cost-comparison.md      # GKE vs EKS vs ECS 월별 비용 비교
    └── multi-cloud-tradeoffs.md
```

**GKE 모듈 핵심 설정:**
- **노드**: e2-medium (2 vCPU, **4GB RAM**) — ArgoCD + 3 app pods 안정 운영
- **노드풀**: 1-3 오토스케일링 (활성 운영 시 최소 1대 유지, 중지 스크립트는 autoscaling 비활성화 후 0으로 축소)
- **네트워크**: Private Google Access 활성화, v1은 노드 공인 egress 사용. private node hardening이 필요해질 때만 Cloud NAT 추가
- **노드 유형**: On-demand (**Preemptible 미사용** → k6 soak 테스트 중단 방지)
- **수용 기준**: `terraform plan` 성공

> **Preemptible/Spot 미사용 사유**: k6 soak 테스트(`constant-vus` executor)는 장시간 실행. Preemptible VM은 24시간 최대 수명 + 언제든 중단 가능하여 테스트가 중간에 실패함. On-demand e2-medium은 ~$25/월이나, 간헐적 사용(월 2-3일)시 ~$2-3/월 수준.

**2-3. Terraform 인프라 배포**
- `terraform apply` 실행
- GKE 클러스터 접속 확인 (`gcloud container clusters get-credentials`)
- Cloud SQL, InfluxDB VM 상태 확인
- **수용 기준**: 모든 리소스 Running, `kubectl get nodes` 성공

**2-4. GitHub Actions CI 파이프라인**

```
.github/
├── workflows/
│   ├── ci.yml              # PR: lint, test, docker build 검증
│   └── cd.yml              # main push: Artifact Registry push + Helm values 업데이트
└── actions/
    └── setup-gcp/
        └── action.yml      # Workload Identity Federation으로 GCP 인증
```

- Bitbucket Pipelines(`bitbucket-pipelines.yml`) → GitHub Actions 전환
- Docker Hub → Artifact Registry 전환
- **수용 기준**: PR → CI 자동 실행, main push → Artifact Registry 이미지 태그 확인

**2-5. ArgoCD 설치 및 GitOps CD**
- GKE에 ArgoCD Helm으로 설치 (argocd namespace)
- Application CR 생성 (k6-platform Helm 차트)
- 자동 Sync + Self-Heal 설정
- 기존 Makefile ArgoCD 타겟(518-668) 정합성 확인
- `helm/`, `argocd/` 기준으로 자동화 경로를 하나로 고정
- **수용 기준**: ArgoCD UI 접속 가능, Application Synced/Healthy

**2-6. AWS Terraform 모듈 (문서용)**
- EKS, EC2, RDS, VPC 모듈 작성
- 각 모듈 `# DOCUMENTATION ONLY - Not deployed` 헤더
- `terraform validate` 통과 확인
- README에 비용 비교 + "왜 AWS도 설계했는가" 포함
- **수용 기준**: `terraform validate` 통과, README 완성

#### 검증 명령어

```bash
# GCP 프로젝트
gcloud projects describe k6-testing-platform
gcloud services list --enabled | grep -E "container|compute|sqladmin|artifactregistry"

# Terraform
cd terraform/environments/gcp-dev
terraform init && terraform validate && terraform plan

# GKE 접속
gcloud container clusters get-credentials k6-gke --zone asia-northeast3-a
kubectl get nodes
kubectl get ns

# Cloud SQL
gcloud sql instances describe k6-postgres --format='value(state)'

# InfluxDB VM
gcloud compute ssh influxdb-vm -- "curl -sf http://localhost:8181/health"

# Artifact Registry
gcloud artifacts repositories list --location=asia-northeast3

# ArgoCD
kubectl get pods -n argocd
kubectl port-forward svc/argocd-server -n argocd 8080:443 &
# ArgoCD UI: https://localhost:8080

# GitHub Actions
gh run list --limit 5

# AWS 모듈 검증
cd terraform/modules/aws && terraform validate
```

---

### Stage 3: 보안 + 모니터링 + 운영 (16-20시간, Week 9-10)

#### 태스크

**3-1. Workload Identity 설정**
- GKE KSA ↔ GCP SA 바인딩
- Pod identity는 Cloud SQL, Secret Manager 등 애플리케이션 API 접근용으로 사용
- Artifact Registry pull 권한은 node service account / node access 구성으로 분리
- Cloud SQL Auth Proxy sidecar 또는 private IP 직접 연결
- **수용 기준**: Pod 내부에서 metadata server 기반 GCP SA 확인, Cloud SQL 연결 성공

**3-2. K8s RBAC + NetworkPolicy**
- 네임스페이스별 Role/RoleBinding (k6-platform, argocd)
- NetworkPolicy: control-panel → k6-runner 허용, mock-server → control-panel 차단
- Pod Security Standards: Restricted 프로필
- **수용 기준**: 불허 트래픽 차단 확인

**3-3. Secret 관리**
- GCP Secret Manager + External Secrets Operator 조합으로 시크릿 주입
- Helm values에는 시크릿 이름과 참조만 유지, 평문 값 금지
- `.env` 파일 Git 미포함 확인
- **수용 기준**: `ExternalSecret`/`Secret` 동기화 확인, Git에 평문 시크릿 없음

**3-4. 모니터링**
- GCP Cloud Monitoring (GKE 기본 모니터링, 무료)
- Grafana + InfluxDB 데이터소스 (k6 테스트 결과 시각화)
- Pod 리소스 사용량 알림
- **수용 기준**: Cloud Monitoring 대시보드에서 GKE 메트릭 확인

**3-5. 비용 관리 자동화**
- Budget Alert ($50, $100, $200, $300 단계)
- 노드풀 스케일 다운 스크립트:
  ```bash
  # scripts/cluster-stop.sh
  gcloud container node-pools update default-pool \
    --cluster k6-gke --zone asia-northeast3-a --no-enable-autoscaling -q
  gcloud container clusters resize k6-gke \
    --node-pool default-pool --num-nodes 0 --zone asia-northeast3-a -q
  gcloud compute instances stop influxdb-vm --zone asia-northeast3-a -q
  ```
- 클러스터 시작 스크립트:
  ```bash
  # scripts/cluster-start.sh
  gcloud container clusters resize k6-gke \
    --node-pool default-pool --num-nodes 1 --zone asia-northeast3-a -q
  gcloud container node-pools update default-pool \
    --cluster k6-gke --zone asia-northeast3-a --enable-autoscaling \
    --min-nodes 1 --max-nodes 3 -q
  gcloud compute instances start influxdb-vm --zone asia-northeast3-a -q
  ```
- **수용 기준**: Budget Alert 설정 확인, 스케일 다운/업 스크립트 동작

#### 검증 명령어

```bash
# Workload Identity
kubectl exec -n k6-platform deploy/control-panel -- \
  curl -sf -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email

# NetworkPolicy
kubectl exec -n k6-platform deploy/mock-server -- \
  curl -sf --connect-timeout 3 http://control-panel:3000 || echo "BLOCKED"

# Secret 확인
kubectl get externalsecret -n k6-platform
kubectl get secrets -n k6-platform
grep -rn 'password\|token\|secret' helm/ --include="*.yaml" | grep -v 'secretKeyRef\|secretName'

# Cloud Monitoring
gcloud monitoring dashboards list

# Budget Alert
gcloud billing budgets list --billing-account=$(gcloud billing accounts list --format='value(name)' --limit=1)

# 스케일 다운/업 테스트
./scripts/cluster-stop.sh
gcloud container node-pools describe default-pool --cluster k6-gke --zone asia-northeast3-a \
  --format='yaml(autoscaling)'
./scripts/cluster-start.sh
kubectl get nodes  # 1 node Ready
```

---

### Stage 4: 포트폴리오 문서화 + E2E 데모 (14-18시간, Week 11-12)

#### 태스크

**4-1. 멀티클라우드 비교 문서 (AWS 포트폴리오 콘텐츠)**
- `docs/architecture/cost-comparison.md`: GKE vs EKS vs ECS 월별 비용 비교 (실제 GCP 사용량 데이터 포함)
- `docs/architecture/multi-cloud-tradeoffs.md`: 기술적 트레이드오프 분석
- `docs/architecture/adr-001-why-gke.md`: 최종 ADR (면접용)
- **수용 기준**: 3개 문서 완성, 실 비용 데이터 포함

**4-2. 아키텍처 다이어그램**
- AS-IS: Docker Compose 아키텍처 (Mermaid)
- TO-BE: GKE + GCE + Cloud SQL 아키텍처
- CI/CD: GitHub Actions → Artifact Registry → ArgoCD → GKE 파이프라인 플로우
- **수용 기준**: 다이어그램 3종 README에 포함

**4-3. E2E 데모 시나리오**
- `scripts/demo.sh`: 클러스터 시작 → 앱 배포 확인 → k6 테스트 실행 → Grafana 결과 확인 → 스케일 다운
- 전체 과정 30분 이내 완료 가능
- 스크린샷/GIF 캡처
- **수용 기준**: 데모 시나리오 30분 이내, 스크린샷 포함

**4-4. README.md 최종 정비**
- 프로젝트 소개 (한국어 + 영어)
- 아키텍처 다이어그램
- 기술 스택 + 선택 이유 요약
- Quick Start (Docker Compose 로컬)
- GKE 배포 가이드
- 데모 URL/스크린샷
- ADR 목록 링크
- **포트폴리오 하이라이트 섹션**:
  - "EKS($73/월) vs GKE 관리비 free tier credit 상쇄 구조 분석 후 GKE 선택" = 비용 최적화 역량
  - "Terraform 멀티클라우드 모듈 (GCP 실배포 + AWS 문서)" = IaC + 설계 역량
  - "GitHub Actions + ArgoCD GitOps" = CI/CD 역량
  - "Helm + K8s RBAC + NetworkPolicy + Workload Identity" = K8s 운영 역량

**4-5. 면접 대비**
- `docs/interview-prep/`: 예상 질문 + 답변
  - "왜 EKS 대신 GKE?" → 비용 분석 + 동일 K8s 경험
  - "AWS 경험은?" → Terraform 모듈 + ADR + 비용 비교로 설계 능력 증명
  - "멀티클라우드?" → 동일 아키텍처 GCP/AWS 모듈 설계, 추상화 설명

#### 검증 명령어

```bash
# 문서 존재
ls docs/architecture/cost-comparison.md docs/architecture/multi-cloud-tradeoffs.md

# README 섹션 수
grep -c '^## ' README.md  # 최소 8개 섹션

# E2E 데모
./scripts/demo.sh  # 30분 이내 완료

# ArgoCD 롤백 테스트
git revert <bad-commit>
argocd app sync k6-platform
argocd app wait k6-platform --health
```

---

## 헥사고날 아키텍처 리팩토링

> **대상**: k6-runner-v2 (핵심 비즈니스 로직 집중)
> **원칙**: Ports & Adapters — 도메인은 외부를 모르고, 외부가 도메인에 의존
> **시기**: Stretch Goal. Stage 2 컷라인(GKE + CI/CD)을 해치면 Stage 3 이후로 이연

### 왜 헥사고날인가

| 문제 (AS-IS) | 원인 | 해결 (TO-BE) |
|---|---|---|
| `TestService`가 `writeFile`, `ChildProcess` 직접 사용 | 인프라와 도메인 결합 | Port 인터페이스로 분리 |
| `ProcessManagerService`에 k6 stdout 파싱 + spawn 혼재 | 단일 책임 위반 | `K6OutputParser`(도메인) + `K6ProcessAdapter`(인프라) 분리 |
| `CurrentTest` 타입에 `ChildProcess` 포함 | 도메인이 Node.js에 의존 | 도메인 모델에서 인프라 타입 제거 |
| DI Container가 구체 클래스만 주입 | 테스트 시 mock 어려움 | Port 인터페이스 기반 DI |
| 30+ `console.warn/error` 디버그 문 | 관찰 가능성 미분리 | `LoggerPort` 도입 |

### 아키텍처 비교

```
AS-IS (현재)                          TO-BE (헥사고날)

┌──────────────┐                    ┌────────────────────────────────────┐
│   Routes     │                    │         Driving Adapters           │
│   (Express)  │                    │   ┌──────────┐  ┌──────────────┐  │
└──────┬───────┘                    │   │ HTTP/REST │  │ CLI (future) │  │
       │                            │   └─────┬────┘  └──────┬───────┘  │
┌──────▼───────┐                    │         │              │          │
│  Controller  │                    ├─────────▼──────────────▼──────────┤
│  (req → res) │                    │                                    │
└──────┬───────┘                    │     ┌─── Inbound Ports ───┐       │
       │                            │     │ StartTestUseCase     │       │
┌──────▼───────┐                    │     │ StopTestUseCase      │       │
│   Service    │◄── 모든 것이 여기   │     │ GetStatusUseCase     │       │
│              │    에 집중됨        │     └──────────┬──────────┘       │
└──┬───┬───┬───┘                    │                │                  │
   │   │   │                        │     ┌──────────▼──────────┐       │
   │   │   │                        │     │   Domain Core       │       │
   │   │   │                        │     │   ├── TestRun       │       │
   │   │   │                        │     │   ├── Scenario      │       │
   │   │   │                        │     │   ├── K6Script      │       │
   │   │   │                        │     │   └── TestProgress  │       │
   ▼   ▼   ▼                        │     └──────────┬──────────┘       │
 k6  Influx  FS                     │                │                  │
(직접 의존)                          │     ┌─── Outbound Ports ──┐      │
                                    │     │ K6ProcessPort        │      │
                                    │     │ ScriptStoragePort    │      │
                                    │     │ MetricsStorePort     │      │
                                    │     │ LoggerPort           │      │
                                    │     └──────────┬──────────┘      │
                                    ├────────────────▼─────────────────┤
                                    │         Driven Adapters           │
                                    │   ┌────────┐ ┌────────┐ ┌─────┐  │
                                    │   │K6Spawn │ │InfluxDB│ │FS/  │  │
                                    │   │Adapter │ │Adapter │ │Tmp  │  │
                                    │   └────────┘ └────────┘ └─────┘  │
                                    └────────────────────────────────────┘
```

### 디렉토리 구조 (TO-BE)

```
apps/k6-runner-v2/src/
├── domain/                          # 순수 비즈니스 로직 (외부 의존성 0)
│   ├── model/
│   │   ├── test-run.ts              # TestRun 엔티티 (ChildProcess 없음)
│   │   ├── test-config.ts           # TestConfig 값 객체
│   │   ├── test-progress.ts         # TestProgress 값 객체
│   │   ├── scenario.ts              # Scenario 값 객체
│   │   └── k6-script.ts             # K6Script 생성 로직
│   ├── port/
│   │   ├── inbound/                 # Driving Ports (앱이 도메인에 요청)
│   │   │   ├── start-test.port.ts   # StartTestUseCase 인터페이스
│   │   │   ├── stop-test.port.ts    # StopTestUseCase 인터페이스
│   │   │   ├── get-status.port.ts   # GetStatusUseCase 인터페이스
│   │   │   └── get-scenarios.port.ts
│   │   └── outbound/               # Driven Ports (도메인이 외부에 요청)
│   │       ├── k6-process.port.ts   # k6 프로세스 실행/종료 인터페이스
│   │       ├── script-storage.port.ts # 스크립트 파일 저장/삭제
│   │       ├── metrics-store.port.ts  # 메트릭 저장소 (InfluxDB 추상화)
│   │       └── logger.port.ts       # 로깅 추상화
│   └── service/                     # 유스케이스 구현 (Port 인터페이스만 의존)
│       ├── test.service.ts          # StartTest, StopTest, GetStatus 구현
│       └── scenario.service.ts      # GetScenarios 구현
│
├── adapter/                         # 인프라 어댑터 (Port 구현체)
│   ├── inbound/                     # Driving Adapters
│   │   └── http/
│   │       ├── test.controller.ts   # Express 라우트 → UseCase 호출
│   │       ├── scenario.controller.ts
│   │       ├── middleware/
│   │       │   ├── validator.ts
│   │       │   └── sanitize-string.ts
│   │       └── dto/                 # HTTP 요청/응답 DTO
│   │           ├── start-test.dto.ts
│   │           └── test-status.dto.ts
│   └── outbound/                    # Driven Adapters
│       ├── k6-process.adapter.ts    # ChildProcess spawn + stdout 파싱
│       ├── fs-script-storage.adapter.ts  # /tmp 파일 저장
│       ├── influxdb-metrics.adapter.ts   # InfluxDB 연동 설정
│       └── console-logger.adapter.ts     # console.warn → 구조화 로깅
│
├── container/
│   └── container.ts                 # Port ↔ Adapter 바인딩 (DI)
│
├── routes/
│   └── route.ts                     # Express Router (변경 최소)
│
├── app.ts                           # Express 앱 진입점
└── types/                           # 공유 타입 (레거시 호환용, 점진적 제거)
```

### 핵심 Port 인터페이스 설계

**Outbound Ports (도메인 → 외부):**

```typescript
// domain/port/outbound/k6-process.port.ts
export interface K6ProcessHandle {
  readonly id: string;
  readonly isRunning: boolean;
  kill(signal?: 'SIGTERM' | 'SIGKILL'): void;
  onProgress(callback: (output: string) => void): void;
  onExit(callback: (code: number | null) => void): void;
}

export interface K6ProcessPort {
  spawn(config: {
    scriptPath: string;
    influxDbOutput: string;
    testId: string;
    env: Record<string, string>;
    dashboardConfig?: DashboardConfig;
  }): Promise<K6ProcessHandle>;
}

// domain/port/outbound/script-storage.port.ts
export interface ScriptStoragePort {
  save(testId: string, content: string): Promise<string>;  // returns path
  delete(path: string): Promise<void>;
}

// domain/port/outbound/metrics-store.port.ts
export interface MetricsStorePort {
  getConnectionString(): string;
  getCredentials(): { org: string; bucket: string; token: string };
}

// domain/port/outbound/logger.port.ts
export interface LoggerPort {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: unknown, context?: Record<string, unknown>): void;
}
```

**Inbound Ports (외부 → 도메인):**

```typescript
// domain/port/inbound/start-test.port.ts
export interface StartTestUseCase {
  execute(config: TestConfig): Promise<TestRunResult>;
}

// domain/port/inbound/stop-test.port.ts
export interface StopTestUseCase {
  execute(): Promise<TestStopResult>;
}

// domain/port/inbound/get-status.port.ts
export interface GetStatusUseCase {
  execute(): Promise<TestStatus>;
}
```

### 도메인 모델 리팩토링

```typescript
// domain/model/test-run.ts — 순수 도메인 (Node.js 의존성 없음)
export class TestRun {
  private constructor(
    public readonly testId: string,
    public readonly config: TestConfig,
    public readonly startTime: Date,
    private _status: TestRunStatus,
    private _progress: TestProgress,
  ) {}

  static create(testId: string, config: TestConfig): TestRun {
    return new TestRun(
      testId,
      config,
      new Date(),
      'starting',
      TestProgress.initial(),
    );
  }

  get status(): TestRunStatus { return this._status; }
  get progress(): TestProgress { return this._progress; }

  updateProgress(raw: string): TestRun {
    // 순수 함수: k6 stdout 문자열 → TestProgress 업데이트
    return new TestRun(
      this.testId,
      this.config,
      this.startTime,
      'running',
      this._progress.parseK6Output(raw, this.config.duration),
    );
  }

  complete(): TestRun {
    return new TestRun(
      this.testId, this.config, this.startTime,
      'completed',
      this._progress.withPercentage(100),
    );
  }

  stop(): TestRun {
    return new TestRun(
      this.testId, this.config, this.startTime,
      'stopped', this._progress,
    );
  }
}

export type TestRunStatus = 'starting' | 'running' | 'completed' | 'stopped' | 'failed';
```

```typescript
// domain/model/test-progress.ts — 순수 값 객체
export class TestProgress {
  private constructor(
    public readonly currentTime: string,
    public readonly currentVUs: number,
    public readonly totalVUs: number,
    public readonly completedIterations: number,
    public readonly interruptedIterations: number,
    public readonly percentage: number,
  ) {}

  static initial(): TestProgress {
    return new TestProgress('0s', 0, 0, 0, 0, 0);
  }

  parseK6Output(output: string, duration?: string): TestProgress {
    // AS-IS: ProcessManagerService.parseK6Progress (350줄 메서드)
    // TO-BE: 순수 함수로 이동, ChildProcess/Map 의존성 제거
    const running = output.match(/running \(([0-9hms.]+)\), (\d+)\/(\d+) VUs/);
    const iteration = output.match(/(\d+) complete and (\d+) interrupted/);
    const percent = output.match(/\[(=*)>?\s*\]\s*(\d+)%/);

    return new TestProgress(
      running ? running[1] : this.currentTime,
      running ? parseInt(running[2]) : this.currentVUs,
      running ? parseInt(running[3]) : this.totalVUs,
      iteration ? parseInt(iteration[1]) : this.completedIterations,
      iteration ? parseInt(iteration[2]) : this.interruptedIterations,
      percent ? parseInt(percent[2]) : this.percentage,
    );
  }

  withPercentage(pct: number): TestProgress {
    return new TestProgress(
      this.currentTime, this.currentVUs, this.totalVUs,
      this.completedIterations, this.interruptedIterations, pct,
    );
  }
}
```

### DI Container 리팩토링

```typescript
// container/container.ts — Port ↔ Adapter 바인딩
import { K6ProcessPort } from '../domain/port/outbound/k6-process.port';
import { K6ProcessAdapter } from '../adapter/outbound/k6-process.adapter';
import { ScriptStoragePort } from '../domain/port/outbound/script-storage.port';
import { FsScriptStorageAdapter } from '../adapter/outbound/fs-script-storage.adapter';
// ...

class Container {
  private static instance: Container | undefined;

  // Ports (인터페이스 타입으로 노출)
  public readonly k6Process: K6ProcessPort;
  public readonly scriptStorage: ScriptStoragePort;
  public readonly metricsStore: MetricsStorePort;
  public readonly logger: LoggerPort;

  // Use Cases
  public readonly startTest: StartTestUseCase;
  public readonly stopTest: StopTestUseCase;
  public readonly getStatus: GetStatusUseCase;

  // Controllers
  public readonly testController: TestController;
  public readonly scenariosController: ScenariosController;

  private constructor() {
    // 1. Outbound Adapters (인프라)
    const config = ConfigService.getInstance();
    this.logger = new ConsoleLoggerAdapter();
    this.k6Process = new K6ProcessAdapter(this.logger);
    this.scriptStorage = new FsScriptStorageAdapter();
    this.metricsStore = new InfluxDbMetricsAdapter(config);

    // 2. Domain Services (Use Cases)
    const scenarioService = new ScenarioService();
    const testService = new TestService(
      this.k6Process,         // Port 인터페이스
      this.scriptStorage,     // Port 인터페이스
      this.metricsStore,      // Port 인터페이스
      this.logger,            // Port 인터페이스
      scenarioService,
    );

    this.startTest = testService;
    this.stopTest = testService;
    this.getStatus = testService;

    // 3. Inbound Adapters (Controllers)
    this.testController = new TestController(testService);
    this.scenariosController = new ScenariosController(scenarioService);
  }

  // 테스트용: 커스텀 어댑터 주입 가능
  static createForTest(overrides: Partial<{
    k6Process: K6ProcessPort;
    scriptStorage: ScriptStoragePort;
    metricsStore: MetricsStorePort;
    logger: LoggerPort;
  }>) {
    // mock 어댑터 주입으로 단위 테스트 용이
  }
}
```

### 앱별 적용 범위

| 앱 | 적용 수준 | 근거 |
|---|---|---|
| **k6-runner-v2** | **전면 적용** | 핵심 도메인 로직 + 다수 외부 의존성 (k6, InfluxDB, FS) |
| **mock-server** | **NestJS 모듈 유지** | NestJS 자체가 DI + 모듈 패턴 제공, 추가 추상화 불필요 |
| **control-panel** | **경량 적용 (서비스 레이어만)** | Next.js App Router 특성상 완전 Hex Arch 부적합. API route에서 서비스 레이어 분리 정도 |

### control-panel 경량 구조 (참고)

```
apps/control-panel/
├── app/
│   └── api/
│       ├── tests/route.ts           # service 호출만 (로직 없음)
│       └── scenarios/route.ts
├── lib/
│   ├── prisma.ts                    # 기존 유지
│   └── k6-runner-client.ts          # k6-runner API 호출 추상화 (신규)
├── services/
│   ├── test.service.ts              # 테스트 CRUD 비즈니스 로직
│   └── scenario.service.ts          # 시나리오 조회 로직
└── tests/
    └── mocks/
        └── prisma.ts
```

### 마이그레이션 전략 (점진적 — Strangler Fig 패턴)

```
Phase 1: Port 인터페이스 정의 (코드 변경 없음)
  ├── outbound port 4개 인터페이스 파일 생성
  ├── inbound port 3개 인터페이스 파일 생성
  └── 기존 코드는 그대로

Phase 2: 도메인 모델 추출 (기존 동작 유지)
  ├── TestRun, TestProgress, K6Script 값 객체 생성
  ├── parseK6Progress → TestProgress.parseK6Output 이동
  └── 기존 Service에서 새 모델 사용하도록 점진 교체

Phase 3: Adapter 분리 (기존 동작 유지)
  ├── ProcessManagerService → K6ProcessAdapter + FsScriptStorageAdapter
  ├── ConfigService InfluxDB 부분 → InfluxDbMetricsAdapter
  └── console.warn/error → ConsoleLoggerAdapter

Phase 4: Container 교체 + 기존 코드 제거
  ├── Port 기반 DI Container 적용
  ├── 기존 modules/ 구조 → domain/ + adapter/ 이동
  └── 레거시 타입 (CurrentTest with ChildProcess) 제거
```

### TDD 연계: 헥사고날 리팩토링 테스트

| ID | 테스트 | 유형 | 검증 내용 |
|----|--------|------|-----------|
| TH-1 | TestProgress.parseK6Output | Unit | 순수 함수 k6 stdout 파싱 (mock 불필요) |
| TH-2 | TestRun 상태 전이 | Unit | create → running → completed/stopped |
| TH-3 | TestService + Mock Ports | Unit | K6ProcessPort mock으로 startTest 검증 |
| TH-4 | K6ProcessAdapter 통합 | Integration | 실제 k6 바이너리 spawn 검증 |
| TH-5 | Container.createForTest | Unit | mock 주입 후 전체 유스케이스 동작 |

**TH-1 예시 (순수 도메인 테스트 — mock 불필요):**

```typescript
// domain/model/__tests__/test-progress.spec.ts
describe('TestProgress', () => {
  it('should parse k6 running output', () => {
    const progress = TestProgress.initial();
    const updated = progress.parseK6Output(
      'running (10s), 5/10 VUs, 0 complete and 0 interrupted iterations'
    );

    expect(updated.currentTime).toBe('10s');
    expect(updated.currentVUs).toBe(5);
    expect(updated.totalVUs).toBe(10);
  });

  it('should parse percentage from progress bar', () => {
    const progress = TestProgress.initial();
    const updated = progress.parseK6Output(
      '[=====>               ] 25%'
    );

    expect(updated.percentage).toBe(25);
  });

  it('should be immutable', () => {
    const original = TestProgress.initial();
    const updated = original.parseK6Output('running (5s), 3/10 VUs');

    expect(original.currentVUs).toBe(0);  // 원본 불변
    expect(updated.currentVUs).toBe(3);   // 새 객체 반환
  });
});
```

### 시간 추정 (Stretch Goal)

| Phase | 작업 | 시간 | 비고 |
|:-----:|------|:---:|------|
| 1 | Port 인터페이스 정의 | 2-3h | 코드 변경 없음, 안전 |
| 2 | 도메인 모델 추출 + TDD | 6-8h | TestProgress 파싱 테스트가 핵심 |
| 3 | Adapter 분리 | 4-6h | 기존 동작 100% 유지 |
| 4 | Container 교체 + 정리 | 3-4h | 통합 테스트로 검증 |
| **합계** | | **15-21h** | 기본 마이그레이션 합계에는 미포함, 여유 시간에 수행 |

---

## TDD 기반 테스트 전략

> **원칙**: RED → GREEN → REFACTOR 사이클 준수, 각 Stage 작업 전 테스트 먼저 작성
> **목표 커버리지**: 80% (k6-runner-v2 jest.config.js에 이미 threshold 설정됨)

### 현재 테스트 현황 (AS-IS)

| 앱 | 테스트 파일 | 프레임워크 | 커버리지 | 상태 |
|---|---|---|---|---|
| k6-runner-v2 | 4개 (.spec.ts) | Jest 29.7 + ts-jest | 80% threshold 설정 | 부분 커버 |
| mock-server | 3개 (.spec.ts) | Jest 29.5 | 미설정 | 최소 수준 |
| control-panel | **0개** | **없음** | 미설정 | **테스트 부재** |

### 테스트 목표 (TO-BE)

| 계층 | 도구 | 대상 | 커버리지 목표 |
|------|------|------|:---:|
| **Unit** | Jest + ts-jest | 서비스 로직, 유틸리티, 설정 검증 | 80%+ |
| **Integration** | Jest + Supertest | API 엔드포인트, DB 연동, 서비스 간 통신 | 70%+ |
| **E2E** | Playwright / k6 | 전체 파이프라인 (UI → k6 실행 → 결과 조회) | Critical Path |
| **Infra** | Terratest / helm unittest | Terraform 모듈, Helm 차트 렌더링 | 핵심 리소스 |
| **Contract** | Pact / 수동 검증 | control-panel ↔ k6-runner API 스키마 | API 변경 감지 |

### Stage별 TDD 작업 계획

#### Stage 0 테스트: Docker 최적화 검증

```
TDD 사이클:
1. RED   — Dockerfile 최적화 검증 테스트 작성
2. GREEN — Dockerfile 수정하여 테스트 통과
3. REFACTOR — 불필요한 레이어 제거
```

| ID | 테스트 | 유형 | 파일 | 검증 내용 |
|----|--------|------|------|-----------|
| T0-1 | control-panel 이미지 크기 | Shell | `tests/docker/test-image-size.sh` | 빌드 후 이미지 < 200MB |
| T0-2 | mock-server 재현 가능 빌드 | Shell | `tests/docker/test-reproducible-build.sh` | `npm ci` 사용 확인 |
| T0-3 | InfluxDB 포트 일관성 | Unit | `tests/config/test-port-consistency.sh` | 8181 포트 통일 확인 |
| T0-4 | 시크릿 하드코딩 감사 | Shell | `tests/security/test-no-hardcoded-secrets.sh` | grep 결과 0건 |

**테스트 스크립트 예시 (T0-1):**
```bash
#!/bin/bash
# tests/docker/test-image-size.sh
# RED: 이 테스트가 먼저 실패해야 함 (현재 이미지 > 200MB)

set -euo pipefail
IMAGE_NAME="control-panel:test"
MAX_SIZE_MB=200

docker build -t "$IMAGE_NAME" ./apps/control-panel
SIZE_BYTES=$(docker image inspect "$IMAGE_NAME" --format='{{.Size}}')
SIZE_MB=$((SIZE_BYTES / 1048576))

if [ "$SIZE_MB" -gt "$MAX_SIZE_MB" ]; then
  echo "FAIL: Image size ${SIZE_MB}MB exceeds ${MAX_SIZE_MB}MB limit"
  exit 1
fi
echo "PASS: Image size ${SIZE_MB}MB within ${MAX_SIZE_MB}MB limit"
```

**테스트 스크립트 예시 (T0-4):**
```bash
#!/bin/bash
# tests/security/test-no-hardcoded-secrets.sh
# RED: Makefile:424에 하드코딩된 토큰이 있으므로 실패

set -euo pipefail
SECRETS_FOUND=$(grep -rn 'apT4C1M3RFAFzw\|sk-proj-\|password.*=.*[A-Za-z0-9]' \
  Makefile docker-compose.yml --include="*.yml" --include="Makefile" 2>/dev/null | wc -l)

if [ "$SECRETS_FOUND" -gt 0 ]; then
  echo "FAIL: Found $SECRETS_FOUND hardcoded secret(s)"
  grep -rn 'apT4C1M3RFAFzw\|sk-proj-\|password.*=.*[A-Za-z0-9]' \
    Makefile docker-compose.yml --include="*.yml" --include="Makefile" 2>/dev/null
  exit 1
fi
echo "PASS: No hardcoded secrets found"
```

---

#### Stage 1 테스트: Helm 차트 + K8s 매니페스트 검증

```
TDD 사이클:
1. RED   — helm unittest + kubeval 테스트 작성 (차트 미존재 → 실패)
2. GREEN — Helm 차트 작성하여 테스트 통과
3. REFACTOR — values 구조 정리
```

| ID | 테스트 | 유형 | 도구 | 검증 내용 |
|----|--------|------|------|-----------|
| T1-1 | Helm lint | Infra | `helm lint` | 차트 문법 유효성 |
| T1-2 | Helm template 렌더링 | Infra | `helm template` + `kubeval` | 유효한 K8s YAML 출력 |
| T1-3 | 리소스 limits 검증 | Unit | `helm unittest` | Pod 리소스 limits/requests 존재 |
| T1-4 | values-local 오버라이드 | Unit | `helm unittest` | Kind 환경 NodePort 설정 확인 |
| T1-5 | values-gke-dev 오버라이드 | Unit | `helm unittest` | Artifact Registry 이미지 경로 확인 |
| T1-6 | Kind 통합 테스트 | Integration | `helm test` | 모든 Pod Running + health check |

**helm unittest 예시 (T1-3):**
```yaml
# helm/k6-platform/tests/resource-limits_test.yaml
suite: resource limits validation
templates:
  - templates/k6-runner/deployment.yaml
  - templates/control-panel/deployment.yaml
  - templates/mock-server/deployment.yaml
tests:
  - it: should set resource limits for k6-runner
    template: templates/k6-runner/deployment.yaml
    asserts:
      - equal:
          path: spec.template.spec.containers[0].resources.limits.memory
          value: 768Mi
      - equal:
          path: spec.template.spec.containers[0].resources.limits.cpu
          value: "1000m"
      - equal:
          path: spec.template.spec.containers[0].resources.requests.memory
          value: 256Mi
      - equal:
          path: spec.template.spec.containers[0].resources.requests.cpu
          value: 500m

  - it: should set resource limits for control-panel
    template: templates/control-panel/deployment.yaml
    asserts:
      - equal:
          path: spec.template.spec.containers[0].resources.limits.memory
          value: 512Mi

  - it: should set resource limits for mock-server
    template: templates/mock-server/deployment.yaml
    asserts:
      - equal:
          path: spec.template.spec.containers[0].resources.limits.memory
          value: 256Mi
```

---

#### Stage 1 추가: 앱 Unit/Integration 테스트 보강

```
TDD 사이클 (control-panel — 현재 테스트 0건):
1. RED   — Jest 설정 + API route 테스트 작성
2. GREEN — 기존 코드가 테스트 통과하는지 확인, 필요 시 수정
3. REFACTOR — 테스트 커버리지 80% 달성
```

| ID | 테스트 | 앱 | 유형 | 검증 내용 |
|----|--------|-----|------|-----------|
| T1-A1 | Jest 환경 설정 | control-panel | Setup | jest.config.ts + ts-jest + 80% threshold |
| T1-A2 | API route 테스트 | control-panel | Unit | `/api/tests`, `/api/scenarios` 응답 스키마 |
| T1-A3 | Prisma 서비스 테스트 | control-panel | Unit | DB CRUD 로직 (mock Prisma Client) |
| T1-A4 | k6-runner API 호출 테스트 | control-panel | Integration | control-panel → k6-runner HTTP 통신 |
| T1-A5 | process-manager 테스트 보강 | k6-runner-v2 | Unit | k6 프로세스 생성/종료/타임아웃 |
| T1-A6 | InfluxDB 쿼리 서비스 테스트 | k6-runner-v2 | Unit | 결과 조회 로직 (mock InfluxDB client) |
| T1-A7 | form-data 업로드 테스트 | k6-runner-v2 | Integration | multipart/form-data 파싱 + 파일 저장 |
| T1-A8 | mock-server 엔드포인트 | mock-server | Unit | 성능 시뮬레이션 응답 (지연, 에러율) |

**control-panel Jest 설정 예시 (T1-A1):**
```typescript
// apps/control-panel/jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/app', '<rootDir>/lib', '<rootDir>/services', '<rootDir>/tests'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  collectCoverageFrom: [
    'app/**/*.ts',
    'lib/**/*.ts',
    'services/**/*.ts',
    'tests/**/*.ts',
    '!**/*.d.ts',
    '!**/*.spec.ts',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
export default config;
```

**API route 테스트 예시 (T1-A2):**
```typescript
// apps/control-panel/app/api/tests/__tests__/route.spec.ts
import { GET, POST } from '../route';
import { prismaMock } from '@/tests/mocks/prisma';

describe('GET /api/tests', () => {
  it('should return test list with pagination', async () => {
    // RED: 이 테스트를 먼저 작성
    prismaMock.test.findMany.mockResolvedValue([
      { id: '1', name: 'load-test', status: 'completed' },
    ]);

    const response = await GET(new Request('http://localhost/api/tests'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(1);
  });

  it('should handle empty results', async () => {
    prismaMock.test.findMany.mockResolvedValue([]);

    const response = await GET(new Request('http://localhost/api/tests'));
    const data = await response.json();

    expect(data.data).toHaveLength(0);
  });
});

describe('POST /api/tests', () => {
  it('should create a new test run', async () => {
    const body = { name: 'soak-test', scenarioId: 'sc-1' };
    prismaMock.test.create.mockResolvedValue({ id: '2', ...body, status: 'pending' });

    const request = new Request('http://localhost/api/tests', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
  });

  it('should reject invalid payload', async () => {
    const request = new Request('http://localhost/api/tests', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
```

---

#### Stage 2 테스트: Terraform + CI/CD 검증

```
TDD 사이클:
1. RED   — terraform validate 테스트 + CI workflow lint 작성
2. GREEN — Terraform 모듈 + GitHub Actions 작성
3. REFACTOR — 모듈 추출, 변수 정리
```

| ID | 테스트 | 유형 | 도구 | 검증 내용 |
|----|--------|------|------|-----------|
| T2-1 | Terraform validate (GCP) | Infra | `terraform validate` | 모든 GCP 모듈 문법 유효 |
| T2-2 | Terraform validate (AWS) | Infra | `terraform validate` | 문서용 AWS 모듈 문법 유효 |
| T2-3 | Terraform plan (GCP) | Infra | `terraform plan` | 리소스 수 예상 범위 내 |
| T2-4 | GH Actions workflow lint | CI | `actionlint` | ci.yml, cd.yml 문법 유효 |
| T2-5 | ArgoCD Application 유효성 | Infra | `kubectl apply --dry-run` | Application CR 스키마 유효 |
| T2-6 | CI 파이프라인 E2E | Integration | `act` (로컬 GH Actions) | PR → lint → test → build 성공 |

**Terraform 테스트 스크립트 예시 (T2-1):**
```bash
#!/bin/bash
# tests/terraform/test-gcp-modules.sh
set -euo pipefail

MODULES_DIR="terraform/modules/gcp"
FAILED=0

for module in "$MODULES_DIR"/*/; do
  MODULE_NAME=$(basename "$module")
  echo "Testing module: $MODULE_NAME"

  cd "$module"
  terraform init -backend=false > /dev/null 2>&1
  if ! terraform validate; then
    echo "FAIL: $MODULE_NAME"
    FAILED=$((FAILED + 1))
  else
    echo "PASS: $MODULE_NAME"
  fi
  cd - > /dev/null
done

if [ "$FAILED" -gt 0 ]; then
  echo "FAIL: $FAILED module(s) failed validation"
  exit 1
fi
echo "PASS: All GCP modules validated"
```

---

#### Stage 3 테스트: 보안 + 모니터링 검증

| ID | 테스트 | 유형 | 도구 | 검증 내용 |
|----|--------|------|------|-----------|
| T3-1 | NetworkPolicy 차단 검증 | Integration | `kubectl exec` + `curl` | 불허 트래픽 차단 |
| T3-2 | RBAC 권한 검증 | Integration | `kubectl auth can-i` | 최소 권한 확인 |
| T3-3 | Secret 평문 노출 검증 | Security | `gitleaks` | Git에 시크릿 없음 |
| T3-4 | Pod Security Standards | Infra | `kubectl apply --dry-run` | Restricted 프로필 준수 |
| T3-5 | Budget Alert 설정 확인 | Infra | `gcloud billing budgets list` | 4단계 알림 존재 |
| T3-6 | 클러스터 스케일 다운/업 | E2E | `scripts/cluster-stop.sh` + `scripts/cluster-start.sh` | autoscaling 비활성화 후 0↔1 전환 성공 |

---

#### Stage 4 테스트: E2E 데모 + 포트폴리오 검증

| ID | 테스트 | 유형 | 도구 | 검증 내용 |
|----|--------|------|------|-----------|
| T4-1 | 데모 시나리오 E2E | E2E | `scripts/demo.sh` | 30분 이내 전체 플로우 성공 |
| T4-2 | README 완성도 | Lint | Shell script | 필수 섹션 8개 이상 존재 |
| T4-3 | 아키텍처 다이어그램 | Lint | Shell script | Mermaid 문법 유효성 |
| T4-4 | GitOps 롤백 | E2E | `git revert` + `argocd app sync` | 이전 버전 정상 복원 |
| T4-5 | k6 부하 테스트 E2E | E2E | k6 + GKE | 10 VU 실행 → InfluxDB 데이터 확인 |

**k6 E2E 테스트 예시 (T4-5):**
```javascript
// tests/e2e/k6-gke-smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${__ENV.MOCK_SERVER_URL}/api/success`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

---

### 테스트 디렉토리 구조 (TO-BE)

```
k6-testing-platform/
├── tests/
│   ├── docker/
│   │   ├── test-image-size.sh              # T0-1
│   │   └── test-reproducible-build.sh      # T0-2
│   ├── config/
│   │   └── test-port-consistency.sh        # T0-3
│   ├── security/
│   │   └── test-no-hardcoded-secrets.sh    # T0-4
│   ├── terraform/
│   │   ├── test-gcp-modules.sh             # T2-1
│   │   └── test-aws-modules.sh             # T2-2
│   ├── ci/
│   │   └── test-workflow-lint.sh           # T2-4
│   ├── k8s/
│   │   ├── test-networkpolicy.sh           # T3-1
│   │   ├── test-rbac.sh                    # T3-2
│   │   └── test-pod-security.sh            # T3-4
│   └── e2e/
│       ├── k6-gke-smoke.js                 # T4-5
│       └── demo-validation.sh              # T4-1
├── apps/
│   ├── control-panel/
│   │   ├── jest.config.ts                  # T1-A1 (신규)
│   │   ├── tests/
│   │   │   └── mocks/
│   │   │       └── prisma.ts               # Prisma mock 설정
│   │   └── app/api/tests/
│   │       └── __tests__/
│   │           └── route.spec.ts           # T1-A2
│   ├── k6-runner-v2/
│   │   ├── jest.config.js                  # 기존 (80% threshold)
│   │   └── src/modules/
│   │       ├── config/config.service.spec.ts         # 기존
│   │       ├── process-manager/process-manager.service.spec.ts  # 기존 + 보강
│   │       ├── test/test.service.spec.ts             # 기존
│   │       └── scenarios/scenario.service.spec.ts    # 기존
│   └── mock-server/
│       └── src/
│           ├── app.controller.spec.ts                # 기존
│           ├── performance/performance.service.spec.ts  # 기존 + 보강
│           └── success/success.service.spec.ts       # 기존
└── helm/
    └── k6-platform/
        └── tests/
            ├── resource-limits_test.yaml    # T1-3
            ├── values-local_test.yaml       # T1-4
            └── test-health.yaml             # T1-6
```

### CI 파이프라인 테스트 통합

```yaml
# .github/workflows/ci.yml 테스트 단계 (Stage 2에서 구현)
jobs:
  unit-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [control-panel, k6-runner-v2, mock-server]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd apps/${{ matrix.app }} && npm ci && npm test -- --coverage
      - uses: codecov/codecov-action@v4
        with:
          directory: apps/${{ matrix.app }}/coverage

  helm-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/setup-helm@v3
      - run: helm lint helm/k6-platform/
      - run: helm plugin install https://github.com/helm-unittest/helm-unittest
      - run: helm unittest helm/k6-platform/

  terraform-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: bash tests/terraform/test-gcp-modules.sh
      - run: bash tests/terraform/test-aws-modules.sh

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: gitleaks/gitleaks-action@v2
      - run: bash tests/security/test-no-hardcoded-secrets.sh

  docker-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bash tests/docker/test-image-size.sh
      - run: bash tests/docker/test-reproducible-build.sh
```

### TDD 실행 순서 요약

```
각 Stage 작업 전:
  1. 해당 Stage 테스트 파일 먼저 작성 (RED)
  2. 테스트 실행 → 실패 확인 (예상된 실패)
  3. 구현 코드 작성 (GREEN)
  4. 테스트 실행 → 통과 확인
  5. 리팩토링 (REFACTOR)
  6. 커버리지 확인 → 80% 미달 시 테스트 추가
```

| Stage | RED (테스트 먼저) | GREEN (구현) | 검증 명령 |
|:-----:|---|---|---|
| **0** | T0-1~T0-4 작성 | Dockerfile 최적화, 시크릿 제거 | `bash tests/docker/*.sh && bash tests/security/*.sh` |
| **1** | T1-1~T1-6, T1-A1~A8 작성 | Helm 차트, Jest 설정, 앱 테스트 | `helm unittest && npm test --coverage` |
| **2** | T2-1~T2-6 작성 | Terraform 모듈, CI/CD | `bash tests/terraform/*.sh && actionlint` |
| **3** | T3-1~T3-6 작성 | 보안 설정, 모니터링 | `bash tests/k8s/*.sh && gitleaks detect` |
| **4** | T4-1~T4-5 작성 | 문서, 데모 시나리오 | `bash tests/e2e/demo-validation.sh` |

---

## 비용 분석 (Architect 권고 반영 최종)

### 월간 비용 (상시 운영 기준)

| 서비스 | 사양 | 월 비용 | 비고 |
|--------|------|--------:|------|
| GKE Cluster Management | Standard Zonal | **net ~$0** | 관리비는 발생하지만 free tier credit으로 상쇄 가능 |
| GKE Node | e2-medium on-demand x1 | ~$25 | 4GB RAM, k6 테스트 안정 |
| Cloud SQL | PostgreSQL 16 shared-core | ~$8-15 | demo/staging 용도, 사양/리전별 변동 |
| GCE InfluxDB | e2-small + 20GB SSD | ~$5 | VM 정지 시 디스크만 과금 |
| Artifact Registry | ~2GB 이미지 | ~$1 | |
| Private Google Access | | **$0** | Google APIs 접근용, 일반 인터넷 egress 대체 아님 |
| Load Balancer | | **$0** | port-forward 사용, LB 미생성 |
| **합계 (상시)** | | **~$39-46/월** | |

### 간헐적 사용 시 (이력서 제출 시에만, 월 2-3일)

| 항목 | 상시 | 간헐적 (월 2-3일) |
|------|-----:|------------------:|
| GKE Node (on-demand) | $25/월 | ~$2-3/월 |
| Cloud SQL | $8-15/월 | $8-15/월 (정지 불가) |
| GCE InfluxDB | $5/월 | ~$1/월 (정지 시 디스크만) |
| **합계** | $39-46/월 | **~$11-19/월** |

### 3개월 크레딧 기간 총 비용

| 시나리오 | 3개월 합계 | 크레딧 잔액 |
|----------|----------:|----------:|
| 상시 운영 | ~$117-138 | $162-183 남음 |
| 간헐적 사용 | ~$33-57 | **$243-267 남음** |

> **네트워크 가정**: v1은 노드 공인 egress를 사용하므로 Cloud NAT를 두지 않는다. Private Google Access는 Google APIs 접근용이며, GitHub 같은 일반 인터넷 egress 대체 수단으로 취급하지 않는다.
>
> **Preemptible → On-demand 전환 사유**: k6 soak 테스트는 장시간 실행. Preemptible VM은 24시간 최대 수명 + 언제든 중단 가능. 간헐적 사용 패턴에서 on-demand 비용 차이는 미미 ($2-3/월).

---

## 보안 체크리스트

- [ ] Makefile 하드코딩 InfluxDB 토큰 → GCP Secret Manager + External Secrets로 이전
- [ ] docker-compose.yml 하드코딩 자격증명 환경변수화
- [ ] control-panel Dockerfile에서 `docker.io` 패키지 제거
- [ ] Workload Identity: GKE SA ↔ GCP SA 바인딩
- [ ] RBAC: 네임스페이스별 최소 권한
- [ ] NetworkPolicy: 서비스 간 불필요 트래픽 차단
- [ ] Pod Security Standards: Restricted 프로필
- [ ] Artifact Registry: 이미지 취약점 스캔 활성화
- [ ] GitHub Actions: Workload Identity Federation (장기 키 사용 금지)
- [ ] Git 시크릿 방지: `.gitignore` + pre-commit hook (gitleaks)

## 롤백 전략

| 계층 | 방법 | 소요 시간 |
|------|------|:---------:|
| 앱 배포 | `git revert <bad-commit>` + `argocd app sync k6-platform` | 5-10분 |
| ArgoCD | `argocd app history k6-platform` + 필요 시 `argocd app rollback` | 3-5분 |
| Terraform | 인프라 코드 revert 후 `terraform apply` | 10-15분 |
| InfluxDB | GCE 영구 디스크 스냅샷 복원 | 15-30분 |
| Cloud SQL | 자동 백업 point-in-time 복원 | 30-60분 |

## 모니터링

| 계층 | 도구 | 메트릭 |
|------|------|--------|
| 인프라 | GCP Cloud Monitoring (무료) | CPU, Memory, Disk, Network |
| K8s | kube-state-metrics + Cloud Monitoring | Pod 상태, 재시작, HPA |
| 앱 | Grafana + InfluxDB | k6 RPS, 응답시간, 에러율 |
| CI/CD | ArgoCD + GitHub Actions | 배포 성공/실패, Sync 상태 |
| 비용 | GCP Budget Alert | 크레딧 사용량 ($50/$100/$200/$300) |

---

## Pre-mortem (실패 시나리오)

### 시나리오 1: GCP 크레딧 조기 소진
**원인**: Cloud SQL + 노드 상시 운영으로 예상보다 빠른 소모
**대응**:
- Budget Alert $50 단계에서 즉시 확인
- `scripts/cluster-stop.sh`로 autoscaling 해제 후 노드 0 + VM 정지
- Cloud SQL 대신 GCE VM에 PostgreSQL Docker 통합 시 $8/월 절감
- 최악: 로컬 Kind + 스크린샷/영상으로 포트폴리오 구성

### 시나리오 2: e2-medium에서 ArgoCD + k6 리소스 경합
**원인**: k6 테스트 중 VU 수 증가로 메모리 초과
**대응**:
- k6-runner Pod에 memory limit 768Mi 설정으로 OOMKilled 시 재시작
- 테스트 VU 수 제한 (max 20 VUs)
- 노드풀 2대로 확장 시 +$25/월 (크레딧 범위 내)
- ArgoCD 리소스 최소화 (server/repo-server 128Mi)

### 시나리오 3: InfluxDB 3.x GCE 메모리 부족
**원인**: e2-small(2GB)에서 Docker + InfluxDB 동시 실행 불안정
**대응**:
- `--ram-pool-data-bytes 536870912` (512MB 캡)
- swap 파일 2GB 설정
- write latency p99 > 200ms → e2-medium 업그레이드 (+$5/월)
- 최후 수단: InfluxDB Cloud Free Tier 사용

---

## 리스크 관리

| ID | 리스크 | 확률 | 영향 | 대응 | Stage |
|----|--------|:---:|:---:|------|:-----:|
| R1 | GCP 크레딧 조기 소진 | 중 | 높 | Budget Alert + 간헐적 운영 | 2-3 |
| R2 | GKE/Terraform 학습 곡선 | 중 | 중 | 공식 문서 + Terraform Registry 모듈 | 2 |
| R3 | InfluxDB GCE 메모리 부족 | 중 | 중 | RAM 캡 + swap + 업그레이드 옵션 | 2 |
| R4 | ArgoCD + 앱 리소스 경합 | 낮 | 중 | e2-medium(4GB) + limits 설정 | 2-3 |
| R5 | Cloud SQL Private IP 연결 | 낮 | 중 | Cloud SQL Auth Proxy + Workload Identity | 2 |
| R6 | GitHub Actions 무료 한도 | 낮 | 낮 | 2000분/월 충분, 빌드 캐싱 | 2 |
| R7 | GKE Zonal 업그레이드 중 다운타임 | 낮 | 낮 | 포트폴리오 프로젝트라 허용 가능 | - |
| R8 | 90일 후 유지 비용 | 높 | 중 | 스크린샷/영상 보존 + 클러스터 삭제 | 4 |

---

## 시간 추정 종합

| Stage | 내용 | 시간 | 기간 |
|-------|------|:---:|------|
| **Stage 0** | Docker 최적화 + 기술 부채 | 8-10h | Week 1-2 |
| **Stage 1** | Helm 차트 + Kind 검증 | 14-18h | Week 3-4 |
| **Stage 2** | Terraform + CI/CD + ArgoCD + AWS 모듈 | 35-45h | Week 5-8 |
| **Stage 3** | 보안 + 모니터링 + 운영 | 16-20h | Week 9-10 |
| **Stage 4** | 포트폴리오 문서화 + E2E | 14-18h | Week 11-12 |
| **합계** | | **87-111h** | **12주** |

> **시간 예산**: 평일 1-2시간 + 주말 8시간 = 주당 ~18-23.5시간
> **12주 가용**: 216-282시간 → **약 2배 버퍼 확보**
> **컷라인**: Stage 2 완료(GKE + CI/CD) = 최소 포트폴리오 제출 가능

## 마일스톤

| 마일스톤 | 핵심 산출물 | 체크포인트 | Week |
|----------|------------|-----------|:----:|
| **M0** | 최적화된 Dockerfile, 시크릿 감사 | `docker build` 성공, 시크릿 0건 | 2 |
| **M1** | Helm 차트, Kind 동작 | `helm test` 통과, 모든 Pod Running | 4 |
| **M2** | GKE 클러스터 + 앱 배포 | `kubectl get pods` 모두 Running | 6 |
| **M3** | GitOps CI/CD 완성 | Push → Build → ArgoCD Sync 자동화 | 8 |
| **M4** | 보안 + 모니터링 | 보안 체크리스트 완료, Grafana 동작 | 10 |
| **M5** | 포트폴리오 완성 | README 완성, 30분 데모 검증 | 12 |

---

## 산출물 디렉토리 구조 (최종)

```
k6-testing-platform/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                       # PR: lint, test, build
│   │   └── cd.yml                       # main: Artifact Registry push + Helm values update
│   └── actions/
│       └── setup-gcp/action.yml         # Workload Identity Federation
├── helm/
│   └── k6-platform/
│       ├── Chart.yaml
│       ├── values.yaml                  # 기본값 + 리소스 limits
│       ├── values-local.yaml            # Kind용
│       ├── values-gke-dev.yaml          # GKE용
│       └── templates/                   # K8s 매니페스트 템플릿
├── terraform/
│   ├── modules/
│   │   ├── gcp/                         # 실배포 (GKE, Cloud SQL, GCE, VPC, AR)
│   │   └── aws/                         # 문서용 (EKS, RDS, EC2, VPC)
│   ├── environments/
│   │   ├── gcp-dev/                     # 실배포 환경
│   │   └── aws-dev/                     # 문서용 환경
│   └── docs/                            # 비용 비교, 멀티클라우드 트레이드오프
├── argocd/
│   ├── applications/k6-platform.yaml    # ArgoCD Application CR
│   └── projects/k6-platform.yaml        # ArgoCD AppProject
├── scripts/
│   ├── cluster-start.sh                 # GKE 노드 + InfluxDB VM 시작
│   ├── cluster-stop.sh                  # 노드 0 + VM 정지 (비용 절감)
│   ├── local-setup.sh                   # Kind 로컬 환경
│   └── demo.sh                          # E2E 데모 시나리오
├── docs/
│   ├── architecture/                    # ADR, 다이어그램, 비용 비교
│   ├── runbook/                         # 배포, 롤백, 트러블슈팅
│   ├── interview-prep/                  # 면접 예상 Q&A
│   ├── work-plan-gke-migration-reviewed.md  # 리뷰 반영본
│   ├── work-plan-gke-migration.md       # 원본 계획서
│   └── work-plan-aws-migration.md       # AWS 계획 (참고용 보존)
├── apps/
│   ├── control-panel/                   # Next.js 15 (Dockerfile 최적화)
│   ├── k6-runner-v2/                    # Express + xk6
│   └── mock-server/                     # NestJS 10 (npm ci 적용)
├── docker-compose.yml                   # 로컬 개발 (현행 유지)
├── Makefile                             # Kind + ArgoCD + Helm 타겟
└── README.md                            # 포트폴리오 최종 README
```

---

## AWS 포트폴리오 콘텐츠 전략

### Terraform 모듈 (문서용)
- `terraform/modules/aws/eks/` — EKS 클러스터 정의
- `terraform/modules/aws/ec2-influxdb/` — InfluxDB EC2 인스턴스
- `terraform/modules/aws/rds/` — PostgreSQL RDS
- `terraform/modules/aws/vpc/` — VPC + 서브넷
- 각 모듈: `# DOCUMENTATION ONLY - Not deployed to production` 헤더
- `terraform validate` 통과 확인

### 비용 비교 문서
- GKE vs EKS vs ECS 3종 비교표
- 실제 GCP 비용 데이터 포함 (크레딧 사용 내역)
- "왜 GKE 선택?" 의사결정 과정 전체 문서화

### 면접 대비
- "왜 EKS 대신 GKE?" → 관리비 free tier credit 상쇄, 동일 K8s 경험, 비용 최적화
- "AWS 경험은?" → Terraform 모듈 설계 + 비용 분석으로 설계 능력 증명
- "멀티클라우드?" → 동일 아키텍처 GCP/AWS 모듈, 추상화 레이어 설명

---

## 미해결 사항 (Open Questions)

1. **GKE 리전**: asia-northeast3 (서울) vs us-central1 (비용 저렴) — 데모 레이턴시 vs 비용 트레이드오프
2. **InfluxDB 데이터 보존 기간**: 영구 디스크 크기 산정 기준 (20GB 기본)
3. **Cloud SQL 대안**: 비용 절감 위해 GCE VM에 PostgreSQL Docker 통합 가능 ($8/월 절감)
4. **도메인/TLS**: 포트폴리오용 커스텀 도메인 사용 여부 (Let's Encrypt + cert-manager)
5. **GKE Autopilot 재검토**: Zonal Standard 대비 간헐적 사용 시 Pod당 과금이 더 유리할 수 있음
