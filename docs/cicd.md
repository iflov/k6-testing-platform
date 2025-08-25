# CI/CD Pipeline Documentation

## Overview

K6 Testing Platform은 Bitbucket Pipelines (CI)와 ArgoCD (CD)를 사용하여 자동화된 배포 파이프라인을 구성합니다.

## Architecture

```
Developer → Push to main → Bitbucket Pipelines → Docker Hub → ArgoCD → Kubernetes
```

## Components

### 1. Bitbucket Pipelines (CI)

**파일**: `bitbucket-pipelines.yml`

#### 주요 기능
- main 브랜치 push 시 자동 실행
- Docker 이미지 빌드 및 Docker Hub 푸시
- Git commit SHA를 이미지 태그로 사용
- 병렬 빌드로 속도 최적화

#### 환경 변수 설정 (Repository Settings)
```
DOCKER_HUB_USERNAME=leehyeontae
DOCKER_HUB_PASSWORD=<your-docker-hub-access-token>
GIT_USER_EMAIL=<your-email>
GIT_USER_NAME=<your-name>
```

### 2. Docker Hub

#### 이미지 저장소
- `leehyeontae/k6-testing-platform-control-panel`
- `leehyeontae/k6-testing-platform-k6-runner`

#### 태그 전략
- `latest`: 최신 버전
- `<commit-sha>`: 특정 커밋 버전 (예: `a1b2c3d`)

### 3. ArgoCD (CD)

**설치 스크립트**: `scripts/setup-argocd.sh`

#### 설치 방법
```bash
# ArgoCD 설치
chmod +x scripts/setup-argocd.sh
./scripts/setup-argocd.sh

# 또는 수동 설치
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

#### 접속 정보
```bash
# Port forwarding
kubectl port-forward svc/argocd-server -n argocd 8080:443

# URL: https://localhost:8080
# Username: admin
# Password: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

#### Application 설정
- `k8s/argocd/applications/control-panel.yaml`
- `k8s/argocd/applications/k6-runner.yaml`

## Deployment Flow

### 1. 코드 변경 및 Push
```bash
git add .
git commit -m "feat: new feature"
git push origin main
```

### 2. Bitbucket Pipelines 실행
- 자동으로 트리거됨
- Docker 이미지 빌드
- Docker Hub에 푸시
- Helm values 업데이트

### 3. ArgoCD 동기화
- Git 저장소 변경 감지
- 새 이미지 태그로 Deployment 업데이트
- Kubernetes 클러스터에 자동 배포

## Local Testing

### 1. Kind 클러스터 준비
```bash
# 클러스터 생성
make k8s-setup

# 서비스 배포
make k8s-deploy
```

### 2. ArgoCD 설치
```bash
./scripts/setup-argocd.sh
```

### 3. Application 배포
```bash
# ArgoCD Application 생성
kubectl apply -f k8s/argocd/applications/

# 동기화 상태 확인
argocd app list
argocd app sync control-panel
argocd app sync k6-runner
```

### 4. 수동 이미지 빌드 및 푸시
```bash
# Makefile 사용
make push

# 또는 개별 푸시
make push-control
make push-runner
```

## Monitoring

### ArgoCD UI
```bash
# Port forward
kubectl port-forward svc/argocd-server -n argocd 8080:443

# 브라우저에서 접속
open https://localhost:8080
```

### Application 상태 확인
```bash
# CLI로 확인
argocd app get control-panel
argocd app get k6-runner

# 수동 동기화
argocd app sync control-panel
argocd app sync k6-runner

# 로그 확인
kubectl logs -f deployment/control-panel-deployment -n k6-platform
kubectl logs -f deployment/k6-runner-deployment -n k6-platform
```

## Troubleshooting

### 1. Bitbucket Pipeline 실패
- Docker Hub 인증 확인
- 환경 변수 설정 확인
- Docker 빌드 로그 확인

### 2. ArgoCD 동기화 실패
```bash
# Application 상태 확인
argocd app get <app-name>

# 수동 동기화
argocd app sync <app-name> --prune

# 리소스 재생성
argocd app sync <app-name> --force
```

### 3. 이미지 Pull 실패
```bash
# Secret 확인
kubectl get secret -n k6-platform

# Docker Hub 인증 추가 (필요시)
kubectl create secret docker-registry regcred \
  --docker-server=docker.io \
  --docker-username=leehyeontae \
  --docker-password=<token> \
  -n k6-platform
```

### 4. Pod 시작 실패
```bash
# Pod 상태 확인
kubectl describe pod <pod-name> -n k6-platform

# 이벤트 확인
kubectl get events -n k6-platform --sort-by='.lastTimestamp'
```

## Security Considerations

1. **Secrets 관리**
   - Docker Hub 토큰은 Bitbucket Repository Settings에 저장
   - Kubernetes Secrets으로 민감 정보 관리
   - Git에 절대 커밋하지 않음

2. **Network Policy**
   - 필요한 경우 NetworkPolicy 적용
   - Service간 통신 제한

3. **RBAC**
   - ArgoCD 권한 최소화
   - 필요한 namespace만 접근 허용

## Next Steps

1. **Production 환경 구성**
   - EKS 클러스터 연동
   - Production values 파일 분리
   - 환경별 브랜치 전략

2. **Monitoring 강화**
   - Prometheus/Grafana 연동
   - 알림 설정
   - 로그 수집 (ELK/Loki)

3. **Advanced Features**
   - Blue/Green 배포
   - Canary 배포
   - Rollback 자동화

## References

- [Bitbucket Pipelines Documentation](https://support.atlassian.com/bitbucket-cloud/docs/get-started-with-bitbucket-pipelines/)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [Helm Documentation](https://helm.sh/docs/)
- [Docker Hub Documentation](https://docs.docker.com/docker-hub/)