# GKE vs EKS vs ECS 비용 비교

> 기준 문서: `docs/work-plan-gke-migration-reviewed.md`(2026-03-09), `docs/work-plan-aws-migration.md`
> 목적: 포트폴리오 데모 기준에서 왜 GKE를 기본 선택으로 두었는지 비용 관점으로 빠르게 설명한다.

## 결론

- **기본 데모 환경**: GKE Standard Zonal
- **무효화된 대안 1**: EKS — Kubernetes 경험은 동일하지만 고정 관리비가 큼
- **무효화된 대안 2**: ECS Fargate — 가장 저렴한 축에 가깝지만 Kubernetes/GitOps 경험을 직접 보여주지 못함

## 월간 비용 비교

| 옵션 | 월 비용(문서 기준) | 핵심 포함 항목 | 포트폴리오 관점 판단 |
|---|---:|---|---|
| **GKE Standard Zonal** | **~$39-46/월 상시**, **~$11-19/월 간헐 운영** | GKE 노드 1대, Cloud SQL, GCE InfluxDB, Artifact Registry | **선택** |
| AWS EKS | ~$128/월 | EKS control plane, Fargate profile, ALB/NAT/ECR | 비용 대비 과함 |
| AWS ECS Fargate | ~$27-34/월 | ECS Fargate Spot, EC2 InfluxDB, RDS, ALB, NAT/ECR | K8s 경험 증명 한계 |

## 비용 해석

### GKE

- 클러스터 관리비는 발생하지만 reviewed plan 기준으로 **free tier credit 상쇄를 전제**한다.
- 비용의 대부분은 control plane이 아니라 **노드, Cloud SQL, InfluxDB VM**에서 나온다.
- 평소에는 클러스터/VM을 내리고, 데모 시점에만 올리는 운영 패턴이 가능하다.

### EKS

- 문서 기준으로 **control plane만 약 $73/월**이 먼저 발생한다.
- 여기에 Fargate, ALB, NAT/ECR가 붙어 **데모성 간헐 운영에도 고정비가 무겁다**.
- 같은 Kubernetes 경험을 보여줘도 초기 실험 비용을 GCP credit처럼 흡수하기 어렵다.

### ECS

- 월간 추정치는 가장 현실적이다.
- 다만 Helm, ArgoCD, Kubernetes RBAC, Workload Identity 같은 이야기를 **실제 운영 경험으로 연결하기 어렵다**.
- 비용 최적화 사례로는 좋지만, 이번 포트폴리오의 핵심 질문인 "왜 Kubernetes를 운영했는가"에 약하다.

## 3개월 포트폴리오 데모 기준 판단

| 시나리오 | 3개월 비용 | 해석 |
|---|---:|---|
| GKE 상시 운영 | ~$117-138 | $300 credit 범위 안 |
| GKE 간헐 운영 | ~$33-57 | credit 소모가 가장 느림 |
| EKS 상시 운영 | ~$384 전후 | credit 완충 없음, 데모 목적 대비 비쌈 |
| ECS 상시 운영 | ~$81-102 | 비용은 좋지만 K8s 데모 목표와 불일치 |

## 추천 문장

- "**EKS 대신 GKE를 고른 이유는 Kubernetes 경험은 유지하면서 초기 3개월 비용 리스크를 낮출 수 있었기 때문입니다.**"
- "**ECS는 더 저렴했지만, 이번 포트폴리오의 핵심 산출물인 Helm + ArgoCD + GitOps 운영 경험을 직접 증명하지 못해 제외했습니다.**"

## 근거 메모

- GKE 비용 수치는 `docs/work-plan-gke-migration-reviewed.md`의 reviewed estimate를 따른다.
- EKS/ECS 비용 수치는 `docs/work-plan-aws-migration.md`의 migration estimate를 따른다.
- 실제 청구액은 리전, 트래픽, 스토리지, 실행 시간에 따라 달라질 수 있다.
