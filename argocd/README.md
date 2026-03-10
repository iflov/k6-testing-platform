# ArgoCD GitOps Assets

이 디렉토리는 `helm/k6-platform` 차트를 GitOps 방식으로 배포하기 위한 ArgoCD 산출물을 담습니다.

## 구성

- `values.yaml` — ArgoCD 자체 리소스 튜닝 값
- `projects/k6-platform.yaml` — AppProject 정의
- `applications/k6-platform.yaml` — `helm/k6-platform` 차트를 배포하는 Application

## 적용 순서

```bash
./scripts/setup-argocd.sh
kubectl apply -f argocd/projects/k6-platform.yaml
kubectl apply -f argocd/applications/k6-platform.yaml
```

> 기본 `repoURL`은 템플릿 값입니다. 실제 저장소 URL로 바꾼 뒤 적용하세요.
