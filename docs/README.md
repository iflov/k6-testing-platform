# Docs Guide

이 디렉터리는 **현재 참고해야 하는 문서**와 **의사결정 이력을 남긴 계획 문서**가 함께 들어 있습니다.  
빠르게 찾으려면 아래 기준으로 보시면 됩니다.

## 1. 현재 우선 참고할 문서

| 문서 | 용도 |
| --- | --- |
| `runbook/demo-gitops-runbook.md` | 데모/운영 절차, 실환경 검증 체크리스트 |
| `architecture/adr-001-why-gke.md` | 현재 기본 선택(GKE)과 이유 |
| `architecture/cost-comparison.md` | GKE / EKS / ECS 비용 비교 요약 |
| `architecture/multi-cloud-tradeoffs.md` | 멀티클라우드 의사결정 설명 |
| `interview-prep/gke-portfolio-qa.md` | 면접/발표용 Q&A |
| `work-plan-gke-migration-implementation-status.md` | 저장소 기준 구현 현황 스냅샷 |

## 2. 이력/참고용 계획 문서

이 문서들은 **현재 운영 런북**이라기보다, 왜 이런 결정을 했는지 보여주는 **히스토리/계획 산출물**입니다.

| 문서 | 상태 |
| --- | --- |
| `work-plan-gke-migration-reviewed.md` | GKE 전환 계획의 reviewed planning artifact |
| `work-plan-aws-migration.md` | AWS 대안 검토용 legacy planning artifact |

## 3. 읽는 순서 추천

### 운영/데모가 목적일 때
1. `runbook/demo-gitops-runbook.md`
2. `work-plan-gke-migration-implementation-status.md`
3. 필요 시 `architecture/*.md`

### 아키텍처 설명/면접 준비가 목적일 때
1. `architecture/adr-001-why-gke.md`
2. `architecture/cost-comparison.md`
3. `architecture/multi-cloud-tradeoffs.md`
4. `interview-prep/gke-portfolio-qa.md`

### 의사결정 히스토리가 궁금할 때
1. `work-plan-gke-migration-reviewed.md`
2. `work-plan-aws-migration.md`

## 4. 해석 원칙

- `runbook/`, `architecture/`, `interview-prep/`는 **현재 설명/운영 기준 문서**입니다.
- `work-plan-*.md`는 시점이 있는 문서이므로, **최신 실행 기준**은 `implementation-status`와 runbook을 우선합니다.
- 오래된 계획 문서는 삭제하지 않고 보존하지만, 현재 상태와 다를 수 있습니다.
