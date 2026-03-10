# 멀티클라우드 트레이드오프

> 기준: reviewed migration plan의 "GCP 실배포 + AWS 문서형 설계" 방향을 문서화한다.

## 한 줄 요약

- **실행 환경은 GCP(GKE) 중심**으로 가져가고,
- **설계 역량은 AWS(EKS/ECS) 비교 문서와 Terraform 모듈 맥락**으로 보완한다.

## 왜 멀티클라우드 문서를 남기는가

이 포트폴리오의 목표는 단순히 "한 클라우드에서 띄워봤다"가 아니다. 아래 두 질문에 답하는 것이다.

1. **왜 이 클라우드를 골랐는가?**
2. **다른 클라우드로 바꾸면 무엇이 달라지는가?**

## 비교표

| 항목 | GKE | EKS | ECS Fargate |
|---|---|---|---|
| 오케스트레이션 모델 | 완전한 Kubernetes | 완전한 Kubernetes | AWS 전용 컨테이너 오케스트레이션 |
| GitOps 적합성 | ArgoCD/Helm 직결 | ArgoCD/Helm 가능 | ArgoCD/Helm 직접 적용 어려움 |
| IAM 연동 | Workload Identity가 비교적 단순 | IRSA 구성 필요 | Task Role 사용 |
| 비용 구조 | credit 활용 시 초기 방어 가능 | control plane 고정비 큼 | 운영비는 상대적으로 낮음 |
| 데모 설명력 | "실제 K8s 운영" 서사 강함 | 기술적으로 강하지만 비용 부담 | "비용 최적화" 서사는 강함 |
| 현재 repo 정합성 | `terraform/modules/gcp/*`, `values-gke-dev.yaml`와 직접 연결 | 문서형 비교 대상으로 적합 | 이전 AWS migration plan 맥락 유지 |

## 선택한 방향

### 1. 운영 기준점은 GKE

- 현재 repo에는 GCP Terraform 환경(`terraform/environments/gcp-dev`)과 GKE 전용 Helm values(`helm/k6-platform/values-gke-dev.yaml`)가 있다.
- reviewed plan도 GKE를 기준으로 CI/CD, ArgoCD, Workload Identity 서사를 묶고 있다.

### 2. AWS는 "설계 대안"으로 유지

- EKS는 **동일한 Kubernetes skill set**을 설명할 수 있는 비교군이다.
- ECS는 **비용 최적화 대안**으로 설명 가치가 있다.
- 즉, AWS는 실배포 타겟이 아니라 **의사결정의 반례와 대안 설계** 역할을 한다.

## 면접에서 설명할 포인트

### GKE를 택한 이유

- 비용 리스크가 낮다.
- Kubernetes-native 경험을 직접 보여줄 수 있다.
- Helm, GitOps, identity, network policy를 한 흐름으로 설명할 수 있다.

### EKS를 안 택한 이유

- 기술적으로는 맞지만, 포트폴리오 데모 규모에서는 고정비가 과하다.
- 같은 학습 효과를 더 낮은 초기 비용으로 GKE에서 얻을 수 있었다.

### ECS를 안 택한 이유

- 더 저렴하지만, 이번 포트폴리오의 핵심은 "컨테이너 운영"이 아니라 "Kubernetes 운영"이다.
- GitOps/Helm/RBAC/Workload Identity 얘기가 약해진다.

## 현재 범위와 한계

- 이 repo에는 이제 ArgoCD `Application` / `AppProject`, GitHub Actions 워크플로우, GKE 운영 스크립트가 포함된다.
- 다만 **실클라우드에서의 최종 apply / sync / rollback 성공 기록은 별도 런타임 검증이 필요**하다.
- 따라서 이 문서는 운영 결과 보고서가 아니라 **설계 + 저장소 구현 상태를 설명하는 문서**로 읽는 것이 정확하다.
