# 🚀 Two Repository CI/CD 프로세스 (Webhook 포함)

## 📂 저장소 구조

- **Code Repository** (현재 저장소): 소스 코드, Dockerfile, CI Pipeline
- **Config Repository** (별도 팀 관리): Helm charts, K8s manifests, ArgoCD Apps

---

## 1️⃣ 코드 Push

```bash
git push origin main
```

- 개발자가 **Code Repository**의 main 브랜치에 코드 푸시
- Bitbucket이 Pipeline 트리거

## 2️⃣ 테스트 실행

```yaml
# K6 Runner에 대해서만 테스트 실행
- cd apps/k6-runner-v2
- npm ci
- npm run lint
- npm test
```

- 모든 브랜치에서 K6 Runner 테스트
- main 브랜치는 테스트 + 빌드/배포 진행

## 3️⃣ Docker 로그인

```bash
echo $DOCKER_HUB_PASSWORD | docker login -u $DOCKER_HUB_USERNAME --password-stdin
```

- Docker Hub 인증
- 환경변수는 Bitbucket Repository Settings에 저장

## 4️⃣ 멀티플랫폼 Docker 빌드 & 푸시

```bash
# Docker buildx로 멀티플랫폼 빌드
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag $DOCKER_HUB_USERNAME/k6-testing-platform-control-panel:$GIT_COMMIT \
  --tag $DOCKER_HUB_USERNAME/k6-testing-platform-control-panel:latest \
  --push \
  ./apps/control-panel
```

- ARM과 AMD64 동시 지원
- Git commit SHA를 태그로 사용 (abc123)
- Docker Hub에 자동 푸시

## 5️⃣ Config Repository 접근 ⚠️ **Two Repository**

```bash
# SSH 키 또는 OAuth 토큰으로 인증
git clone git@bitbucket.org:team/eks-infrastructure.git config-repo
cd config-repo
```

- **별도 Config Repository** 클론
- SSH 키 또는 App Password 필요
- 인프라팀이 관리하는 저장소

## 6️⃣ Helm values 수정 ⚠️ **Config Repository에서**

```bash
# Config Repository의 Helm values 수정
yq eval -i ".image.tag = \"$GIT_COMMIT\"" helm/control-panel/values-prod.yaml
yq eval -i ".image.tag = \"$GIT_COMMIT\"" helm/k6-runner/values-prod.yaml
```

- **다른 저장소**의 values.yaml 수정
- 인프라팀 규칙에 맞춰 수정

## 7️⃣ Config Repository에 커밋 & 푸시 ⚠️ **변경됨**

```bash
# Config Repository에 푸시
git add helm/*/values-*.yaml
git commit -m "[CI] Update image tags to $GIT_COMMIT from k6-testing-platform"
git push origin main

# 또는 PR 생성 (권장)
git checkout -b update-images-$GIT_COMMIT
git push origin update-images-$GIT_COMMIT
```

- **Config Repository**에 푸시
- PR 생성으로 인프라팀 리뷰 가능
- 자동 머지 또는 승인 프로세스

## 8️⃣ Config Repo Webhook 발동 ⚠️ **Config Repository에서**

```json
POST https://argocd-server/api/webhook
Headers:
  X-Event-Key: repo:push
  X-Hook-UUID: {webhook-id}
Body:
{
  "repository": "eks-infrastructure",
  "ref": "refs/heads/main",
  "after": "def456..."
}
```

- **Config Repository**의 Webhook이 ArgoCD로 전송
- Helm values 변경 알림
- 인프라 저장소에서 발동

## 9️⃣ ArgoCD Webhook 수신 & 처리

```yaml
# ArgoCD가 Config Repository 변경 감지
1. Config Repository 변경 감지
2. helm/control-panel/values-prod.yaml 확인
3. 새 이미지 태그 발견 (abc123)
4. Helm 템플릿 렌더링
```

- ArgoCD가 **Config Repository** 모니터링
- Helm 차트와 values 파일로 매니페스트 생성

## 🔟 ArgoCD 동기화 시작

```yaml
# ArgoCD Application 설정
spec:
  source:
    repoURL: git@bitbucket.org:team/eks-infrastructure.git # Config Repo
    path: helm/control-panel
    targetRevision: main
  syncPolicy:
    automated:
      prune: true # 불필요한 리소스 제거
      selfHeal: true # 자동 복구
```

- **Config Repository**에서 매니페스트 가져오기
- EKS 클러스터에 적용

## 1️⃣1️⃣ Kubernetes 롤링 업데이트

```bash
# EKS에서 실행되는 과정
1. 새 이미지 (abc123)로 Pod 생성
2. Health check 통과 확인
3. 트래픽 전환 (Rolling Update)
4. 기존 Pod 종료
5. 모든 Pod 업데이트 완료
```

- EKS 클러스터에서 롤링 업데이트
- 무중단 배포 (Zero Downtime)

---

## ⚙️ Two Repository Webhook 설정

### Config Repository Webhook 설정 (인프라팀)

```bash
# Config Repository Settings → Webhooks → Add webhook
Title: ArgoCD Sync
URL: https://your-argocd-server/api/webhook
Triggers: Repository push
Secret: your-webhook-secret
```

### ArgoCD Webhook 수신 설정

```yaml
# argocd-cm ConfigMap에 추가
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cm
  namespace: argocd
data:
  webhook.bitbucket.secret: "your-webhook-secret"
```

### Pipeline 환경변수 추가 (Code Repository)

```yaml
# Bitbucket Repository Settings → Repository variables
CONFIG_REPO_URL: git@bitbucket.org:team/eks-infrastructure.git
CONFIG_REPO_SSH_KEY: <base64-encoded-private-key>
DOCKER_HUB_USERNAME: leehyeontae
DOCKER_HUB_PASSWORD: <docker-hub-token>
```

---

## ⏱️ Two Repository 전체 소요 시간

### Webhook 사용 시:

- **전체**: 약 4-6분
  - Code Repo Pipeline: 2-3분
  - Config Repo 업데이트: 30초
  - Webhook 전달: 즉시
  - ArgoCD 동기화: 30초
  - K8s 롤링 업데이트: 1-2분

### Polling 방식:

- **전체**: 약 6-9분
  - Code Repo Pipeline: 2-3분
  - Config Repo 업데이트: 30초
  - ArgoCD 폴링 대기: 0-3분
  - ArgoCD 동기화: 30초
  - K8s 롤링 업데이트: 1-2분

---

## 📊 Two Repository 플로우 다이어그램

```
[Code Repository]          [Config Repository]         [ArgoCD]
Developer → Push     
     ↓
Pipeline 실행
     ↓
Docker Build/Push ──────→ Docker Hub
     ↓
     └──────────→ Values 수정
                      ↓
                  Git Push
                      ↓
                  Webhook ──────────→ Sync
                                        ↓
                                    EKS 배포
```

## 🔑 핵심 차이점 (Two Repository)

1. **저장소 분리**: 코드와 설정이 별도 저장소
2. **권한 분리**: 개발팀은 Code Repo, 인프라팀은 Config Repo
3. **추가 단계**: Config Repository 업데이트 단계 추가
4. **PR 프로세스**: Config Repo 변경 시 인프라팀 리뷰 가능
5. **ArgoCD Source**: Config Repository를 바라봄

## 📝 Summary

Two Repository 전략으로 Helm과 K8s manifest가 별도 저장소에서 관리되는 환경에서:
- 코드 변경 → Docker 이미지 빌드 → Config Repo 업데이트 → ArgoCD 동기화
- 전체 소요시간: 약 4-6분 (Webhook 사용 시)
- 보안과 권한 관리가 더 명확해짐

