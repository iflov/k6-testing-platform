# ADR-001: 왜 GKE를 선택했는가

- **상태**: Accepted
- **날짜**: 2026-03-10
- **근거 문서**: `docs/work-plan-gke-migration-reviewed.md`, `docs/work-plan-gke-migration-implementation-status.md`

## Context

포트폴리오 목표는 다음 네 가지를 동시에 만족하는 것이다.

1. 실제 Kubernetes 운영 경험을 보여준다.
2. 비용을 인터뷰/이력서 제출용 데모 수준에서 통제한다.
3. Terraform + Helm + GitOps로 이어지는 운영 서사를 만든다.
4. 멀티클라우드 관점의 비교 근거를 남긴다.

후보는 세 가지였다.

- GKE Standard Zonal
- AWS EKS
- AWS ECS Fargate

## Decision

**포트폴리오 데모 기본 타겟으로 GKE Standard Zonal을 선택한다.**

## Decision Drivers

- reviewed migration plan 기준으로 초기 3개월을 **GCP credit 안에서 관리할 가능성**이 높다.
- `helm/k6-platform/values-gke-dev.yaml`과 `terraform/environments/gcp-dev`가 이미 repo 안에 존재한다.
- Helm, NetworkPolicy, Workload Identity, ArgoCD라는 **Kubernetes-native 운영 이야기**를 한 플랫폼에서 묶어 설명할 수 있다.
- EKS는 기술적으로 유효하지만 데모 규모에 비해 고정비가 크다.
- ECS는 비용 효율적이지만 이번 포트폴리오의 핵심 메시지와 다르다.

## Alternatives Considered

### 1. AWS EKS

**장점**
- GKE와 동일한 Kubernetes 경험을 제공한다.
- AWS 중심 조직을 겨냥한 설명력이 있다.

**단점**
- reviewed/legacy plan 기준 비용이 가장 높다.
- 포트폴리오 데모의 간헐 운영 모델에 비해 control plane 고정비가 크다.

**판단**
- 이번 범위에서는 기각.

### 2. AWS ECS Fargate

**장점**
- 비용 효율이 좋다.
- 운영 단순성이 높다.

**단점**
- Kubernetes가 아니다.
- Helm/ArgoCD/RBAC/Workload Identity 서사를 직접 시연할 수 없다.

**판단**
- 비용 대안으로는 유지하되, 기본 타겟에서는 제외.

## Consequences

### Positive

- "왜 GKE인가"에 대해 비용과 운영 관점에서 일관된 답을 줄 수 있다.
- GCP Terraform + Helm values + reviewed migration plan이 한 방향으로 정렬된다.
- 면접에서 "실무형 K8s 데모를 어떻게 예산 안에서 구성했는가"를 설명하기 쉽다.

### Negative

- GCP 학습 비용이 생긴다.
- AWS 실배포 경험은 실제 운영이 아니라 비교 설계와 Terraform 문맥으로만 남는다.
- 실클라우드에서의 최종 ArgoCD sync / rollback 증빙은 별도 검증이 필요하다.

## Follow-up

- 비용 알림/종료 기준을 runbook에 반영한다.
- 실제 GKE 환경에서 ArgoCD sync / rollback 결과를 수집해 운영 증빙을 보강한다.
- credit 소진 이후에는 GKE 상시 운영이 아니라 간헐 운영 기준으로 재평가한다.
