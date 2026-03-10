# 데모 / GitOps 런북

> 범위: `docs/work-plan-gke-migration-reviewed.md`에 맞춘 **간단한 데모 절차**만 정리한다.
> 주의: 저장소 산출물은 준비되어 있지만, 아래 절차 중 `gcloud`, `kubectl`, `argocd` 단계는 **실클라우드 접속 권한이 있을 때 최종 검증**해야 한다.

## 1. 데모 전에 로컬에서 확인할 것

### 로컬에서 검증한 명령

```bash
make help
helm template k6-platform ./helm/k6-platform -f ./helm/k6-platform/values-gke-dev.yaml >/tmp/k6-helm-gke.yaml
terraform fmt -check -recursive
```

- `make help` → 로컬에서 성공
- `helm template ...` → 로컬에서 성공
- `terraform fmt -check -recursive` → 로컬에서 성공

### 로컬에서 완전 검증하지 못한 항목

- `gcloud ...` 계열: **로컬에 gcloud CLI가 없음**
- `argocd ...` 계열: **로컬에 argocd CLI가 없음**
- `kubectl get ...` 실클러스터 확인: **클라우드/클러스터 접근 권한이 필요**
- `terraform -chdir=terraform/environments/gcp-dev validate`: **현재 로컬 provider/plugin 상태 문제로 실패**
- `./scripts/cluster-start.sh`, `./scripts/cluster-stop.sh`, `./scripts/configure-budget-alerts.sh`: **스크립트는 추가됐지만 실제 GCP 계정/과금 계정이 필요**

## 2. 데모 스토리

1. **아키텍처 설명**: GKE + Cloud SQL + GCE InfluxDB + Artifact Registry
2. **비용 설명**: GKE vs EKS vs ECS 비교와 GKE 선택 근거
3. **배포 설명**: GitHub Actions가 이미지를 만들고, ArgoCD가 GKE에 동기화하는 목표 흐름
4. **운영 설명**: 평소에는 내리고, 데모 시점에만 올리는 간헐 운영 패턴

## 3. 데모 직전 확인 체크리스트

- GKE용 values 파일 존재 확인

```bash
ls helm/k6-platform/values-gke-dev.yaml
```

- GCP Terraform 환경 존재 확인

```bash
find terraform/environments/gcp-dev -maxdepth 1 -type f | sort
```

- Helm 렌더 결과 점검

```bash
helm template k6-platform ./helm/k6-platform -f ./helm/k6-platform/values-gke-dev.yaml | head -40
```

## 4. 클라우드 접근이 있을 때 실행할 명령

> 아래 명령은 문서 기준으로만 정리했다. 이 세션에서는 클라우드 접근과 일부 CLI 부재 때문에 실행하지 못했다.

### GKE 인증

```bash
gcloud container clusters get-credentials <cluster-name> --zone asia-northeast3-a --project <project-id>
```

### 기본 상태 확인

```bash
kubectl get ns
kubectl get pods -A
kubectl get svc -A
```

### Control Panel DB migration 확인

`control-panel` Pod는 시작 전에 `control-panel-migrate` initContainer로
`apps/control-panel/scripts/migrate-db.sh` 를 실행한다.

확인 명령:

```bash
kubectl get pods -n k6-platform
kubectl get pod <control-panel-pod> -n k6-platform -o jsonpath="{.status.initContainerStatuses[*].state}"
kubectl logs <control-panel-pod> -n k6-platform -c control-panel-migrate
```

정상 기대값:

- initContainer 상태가 `terminated` + `exitCode: 0`
- 로그에 `Ensuring PostgreSQL extension uuid-ossp exists...`
- 로그에 `Applying Prisma migrations...`

### ArgoCD UI 접근

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

### ArgoCD 초기 패스워드 확인

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

## 5. GitOps 데모 흐름

### 정상 배포 흐름

1. 애플리케이션 변경 또는 이미지 태그 갱신
2. GitHub Actions(`.github/workflows/cd.yml`)가 Artifact Registry로 이미지 빌드/푸시
3. `helm/k6-platform/values-gke-dev.yaml`의 태그가 커밋되고 ArgoCD가 변경 감지 후 sync
4. `kubectl get pods -n k6-platform`로 rollout 확인
5. `control-panel-migrate` initContainer 성공 여부 확인

### 발표용 설명 포인트

- CI와 CD를 분리했다.
- Kubernetes 변경은 선언형으로 추적한다.
- ArgoCD가 drift를 줄이는 운영 포인트다.

## 6. 롤백 시연 흐름

> 현재 repo에는 ArgoCD app/project manifest가 포함되어 있다. 아래는 reviewed migration plan에 맞춘 최소 롤백 절차다.

1. 잘못된 변경 커밋을 `git revert` 한다.
2. GitOps 저장소의 원하는 상태가 이전 버전으로 돌아간다.
3. ArgoCD가 재동기화한다.
4. `kubectl rollout status deployment/<name> -n k6-platform`로 정상 복귀를 확인한다.

예시 명령:

```bash
git revert <bad-commit>
kubectl rollout status deployment/control-panel -n k6-platform
kubectl rollout status deployment/k6-runner -n k6-platform
kubectl rollout status deployment/mock-server -n k6-platform
```

## 7. DB 테이블 미생성 / Prisma migration 장애 대응

### 증상

- `control-panel` 은 떠 있지만 `/api/tests` 호출 시 500 발생
- `test_runs`, `test_results` 테이블이 없음
- Pod가 `Init:CrashLoopBackOff` 에 머무름
- `control-panel-migrate` 로그에 Prisma/extension 권한 오류 표시

### 1차 확인

```bash
kubectl get pods -n k6-platform
kubectl describe pod <control-panel-pod> -n k6-platform
kubectl logs <control-panel-pod> -n k6-platform -c control-panel-migrate
```

### DB 연결/테이블 확인

Cloud SQL 또는 외부 PostgreSQL에 접근 가능한 환경이라면:

```bash
psql "$DATABASE_URL" -c '\dt'
psql "$DATABASE_URL" -c 'select * from "_prisma_migrations" order by finished_at desc nulls last;'
```

기대 결과:

- `test_runs`, `test_results` 테이블 존재
- `_prisma_migrations` 테이블 존재
- 최신 migration이 `finished_at` 값을 가짐

### 자주 나는 원인

1. **migration initContainer 실패**
   - Helm은 배포됐지만 schema 생성 전에 Pod가 멈춤
2. **DB 권한 부족**
   - 특히 `CREATE EXTENSION "uuid-ossp"` 권한 없음
3. **외부 DB는 살아 있지만 빈 스키마**
   - 현재 구조에서는 앱 시작 전에 migration이 반드시 성공해야 함
4. **잘못된 DATABASE_URL / Secret**
   - `postgres-secret`, `DATABASE_URL` 주입값 불일치

### extension 권한 문제일 때

증상 예시:

- `permission denied to create extension "uuid-ossp"`

대응:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

이 작업은 DB 관리자 권한으로 **사전에** 수행해야 할 수 있다.

### Pod가 떠 있는데 테이블만 없는 것처럼 보일 때

`readiness` 는 현재 `SELECT 1` 수준의 DB 연결만 확인한다.  
즉, **DB 연결 성공 != migration 성공** 은 아니다.

반드시 아래를 같이 본다:

```bash
kubectl logs <control-panel-pod> -n k6-platform -c control-panel-migrate
psql "$DATABASE_URL" -c '\dt'
```

### 재시도 방법

Secret/DB 권한/네트워크 문제를 고친 뒤:

```bash
kubectl delete pod <control-panel-pod> -n k6-platform
kubectl rollout status deployment/control-panel -n k6-platform
kubectl logs deployment/control-panel -n k6-platform -c control-panel-migrate --tail=100
```

### Helm 렌더 단계에서 미리 확인

```bash
helm template k6-platform ./helm/k6-platform -f ./helm/k6-platform/values-gke-dev.yaml | grep -n "control-panel-migrate"
```

출력이 없으면 migration initContainer가 템플릿에 반영되지 않은 것이다.

## 8. 현재 한계

- 실 GKE / ArgoCD 환경에서의 최종 sync 성공 로그와 스크린샷은 아직 수집하지 못했다.
- `gcloud billing budgets create`, `kubectl get`, `argocd app` 류 명령은 실제 계정/클러스터가 필요하다.
- 따라서 이 runbook은 **저장소 산출물 + 검증 가능한 로컬 단계 + 실환경 검증 체크리스트**를 함께 담은 문서다.
