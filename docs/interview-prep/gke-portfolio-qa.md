# GKE 포트폴리오 면접 Q&A

## 1) 왜 EKS가 아니라 GKE였나요?

**짧은 답변**

GKE와 EKS 모두 Kubernetes 경험을 줄 수 있지만, 이 포트폴리오는 데모/간헐 운영이 전제라 비용 구조가 더 중요했습니다. reviewed plan 기준으로 EKS는 control plane 고정비가 커서 초기에 비효율적이었고, GKE는 credit을 활용해 같은 Kubernetes 경험을 더 낮은 리스크로 확보할 수 있었습니다.

## 2) 왜 ECS를 쓰지 않았나요?

ECS는 비용 면에서는 매력적이지만, 이번 포트폴리오의 핵심은 Kubernetes 운영 경험을 직접 증명하는 것이었습니다. Helm, ArgoCD, NetworkPolicy, Workload Identity를 실제 운영 서사로 묶으려면 GKE가 더 적합했습니다.

## 3) 이 프로젝트에서 보여주려는 운영 역량은 무엇인가요?

- Terraform으로 인프라를 선언적으로 관리한 점
- Helm values를 환경별로 분리한 점
- GKE용 values에서 Workload Identity annotation과 external DB 연결을 분리한 점
- GitHub Actions + ArgoCD 형태의 GitOps 운영 계획을 문서화한 점
- 비용과 아키텍처 대안을 비교해서 선택한 점

## 4) 멀티클라우드라고 말할 수 있나요?

네. 다만 "양쪽 클라우드 실운영"이 아니라 **GCP 실배포 중심 + AWS 비교 설계 문서화**에 가깝습니다. 저는 이 점을 숨기지 않고, 어떤 부분이 실행됐고 어떤 부분이 설계 수준인지 구분해서 설명합니다.

## 5) GitOps는 실제로 어디까지 되어 있나요?

현재 repo 기준으로는 **GitHub Actions 워크플로우, ArgoCD Application/AppProject, 운영 스크립트, demo/runbook**까지 모두 갖춰져 있습니다. 다만 이 세션에서는 실제 GKE 클러스터와 ArgoCD 서버에 접속해 sync/rollback을 끝까지 실행하지는 못했습니다. 그래서 "GitOps 운영 경로는 저장소에 구현돼 있고, 실환경 검증만 남았다"라고 설명하는 것이 가장 정확합니다.

## 6) 왜 InfluxDB를 GKE 안에 넣지 않았나요?

reviewed plan 기준으로 InfluxDB 3.x Core는 전용 VM에 두는 쪽이 단순했습니다. 공식 Helm 부재, Stateful workload 복잡도, 파일 기반 저장소 제약 때문에 데모 안정성과 운영 단순성을 우선했습니다.

## 7) 이 선택의 가장 큰 트레이드오프는 무엇이었나요?

GKE를 고르면서 Kubernetes 운영 스토리는 강해졌지만, AWS 실배포 경험은 약해졌습니다. 대신 AWS는 EKS/ECS 비용 비교와 대안 설계로 보완했습니다.

## 8) 한 문장으로 이 프로젝트를 소개하면?

"비용 제약 안에서 GKE를 중심으로 Terraform, Helm, GitOps, 관측 스택을 묶어 실제 Kubernetes 운영 의사결정을 설명할 수 있게 만든 k6 테스트 플랫폼 포트폴리오입니다."
