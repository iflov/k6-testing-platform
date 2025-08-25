# ArgoCD SSH 설정 가이드

## 개요

ArgoCD가 Bitbucket 저장소에 SSH로 접근하기 위한 설정 가이드입니다.

## SSH vs HTTPS 비교

### SSH 방식 (현재 설정)
- **URL**: `git@bitbucket.org:inhuman-z/k6-test-platform.git`
- **장점**: 
  - 더 안전한 인증 방식
  - 토큰 만료 걱정 없음
  - 한 번 설정하면 유지 관리 편함
- **단점**: 
  - 초기 설정이 복잡함
  - SSH 키 관리 필요

### HTTPS 방식 (대안)
- **URL**: `https://bitbucket.org/inhuman-z/k6-test-platform.git`
- **장점**: 
  - 설정이 간단함
  - 방화벽 친화적
- **단점**: 
  - 액세스 토큰 주기적 갱신 필요
  - 토큰 노출 위험

## SSH 설정 방법

### 1. SSH 키 생성

```bash
# SSH 키 생성 (ArgoCD 전용)
ssh-keygen -t ed25519 -C "argocd@k6-platform" -f ~/.ssh/argocd_bitbucket

# 또는 RSA 키 사용 (호환성이 더 좋음)
ssh-keygen -t rsa -b 4096 -C "argocd@k6-platform" -f ~/.ssh/argocd_bitbucket
```

### 2. Bitbucket에 공개키 등록

#### 방법 1: Repository Access Key (권장)
1. Bitbucket 저장소로 이동
2. Repository settings → Access keys
3. "Add key" 클릭
4. Label: "ArgoCD"
5. Key: 공개키 내용 붙여넣기
   ```bash
   cat ~/.ssh/argocd_bitbucket.pub
   ```

#### 방법 2: Personal SSH Key
1. Personal settings → SSH keys
2. "Add key" 클릭
3. 공개키 내용 붙여넣기

### 3. ArgoCD에 비밀키 등록

#### 방법 1: UI를 통한 등록
```bash
# ArgoCD UI 접속
kubectl port-forward svc/argocd-server -n argocd 8080:443

# 브라우저에서 https://localhost:8080 접속
# Settings → Repositories → Connect Repo using SSH
```

#### 방법 2: CLI를 통한 등록
```bash
# ArgoCD CLI 로그인
argocd login localhost:8080 --username admin --password <password> --insecure

# Repository 추가
argocd repo add git@bitbucket.org:inhuman-z/k6-test-platform.git \
  --ssh-private-key-path ~/.ssh/argocd_bitbucket \
  --insecure-skip-server-verification
```

#### 방법 3: Kubernetes Secret으로 등록
```bash
# Secret 생성
kubectl create secret generic argocd-bitbucket-ssh \
  --from-file=sshPrivateKey=~/.ssh/argocd_bitbucket \
  -n argocd

# Repository Secret 생성
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: bitbucket-repo
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repository
stringData:
  type: git
  url: git@bitbucket.org:inhuman-z/k6-test-platform.git
  sshPrivateKey: |
$(cat ~/.ssh/argocd_bitbucket | sed 's/^/    /')
EOF
```

### 4. 연결 테스트

```bash
# Repository 연결 상태 확인
argocd repo list

# 수동으로 SSH 연결 테스트
ssh -T git@bitbucket.org -i ~/.ssh/argocd_bitbucket
```

## HTTPS 대안 설정

SSH 설정이 어려운 경우 HTTPS + 액세스 토큰 사용:

### 1. Bitbucket App Password 생성
1. Personal settings → App passwords
2. "Create app password"
3. Label: "ArgoCD"
4. Permissions: Repository Read 선택
5. 생성된 비밀번호 복사

### 2. ArgoCD에 HTTPS 저장소 추가

```bash
# CLI로 추가
argocd repo add https://bitbucket.org/inhuman-z/k6-test-platform.git \
  --username <bitbucket-username> \
  --password <app-password>

# 또는 Secret으로 추가
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: bitbucket-https-repo
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repository
stringData:
  type: git
  url: https://bitbucket.org/inhuman-z/k6-test-platform.git
  username: <bitbucket-username>
  password: <app-password>
EOF
```

### 3. Application 매니페스트 수정

```yaml
# k8s/argocd/applications/control-panel.yaml
spec:
  source:
    repoURL: https://bitbucket.org/inhuman-z/k6-test-platform.git  # HTTPS URL로 변경
```

## 문제 해결

### SSH 연결 실패
```bash
# SSH 연결 디버깅
ssh -vT git@bitbucket.org -i ~/.ssh/argocd_bitbucket

# Known hosts 문제 해결
ssh-keyscan bitbucket.org >> ~/.ssh/known_hosts
```

### ArgoCD 동기화 실패
```bash
# Repository 재등록
argocd repo rm git@bitbucket.org:inhuman-z/k6-test-platform.git
argocd repo add git@bitbucket.org:inhuman-z/k6-test-platform.git \
  --ssh-private-key-path ~/.ssh/argocd_bitbucket

# Application 재동기화
argocd app sync control-panel --force
argocd app sync k6-runner --force
```

### 권한 문제
```bash
# SSH 키 권한 확인
chmod 600 ~/.ssh/argocd_bitbucket
chmod 644 ~/.ssh/argocd_bitbucket.pub

# ArgoCD ServiceAccount 권한 확인
kubectl get clusterrolebinding -n argocd
```

## 보안 권장사항

1. **SSH 키 관리**
   - 전용 SSH 키 사용 (개인 키와 분리)
   - 정기적으로 키 로테이션
   - 키를 Git에 커밋하지 않음

2. **Repository 접근 제한**
   - Read-only 권한만 부여
   - 필요한 저장소만 접근 허용

3. **Secret 관리**
   - Kubernetes Secret 암호화 (encryption at rest)
   - RBAC으로 Secret 접근 제한
   - Sealed Secrets 또는 External Secrets Operator 고려

## 자동화 스크립트

```bash
#!/bin/bash
# setup-argocd-ssh.sh

# SSH 키 생성
ssh-keygen -t ed25519 -C "argocd@k6-platform" -f ~/.ssh/argocd_bitbucket -N ""

# 공개키 출력
echo "========================================="
echo "Bitbucket에 다음 공개키를 등록하세요:"
echo "========================================="
cat ~/.ssh/argocd_bitbucket.pub
echo "========================================="

# ArgoCD에 Secret 생성
kubectl create secret generic argocd-bitbucket-ssh \
  --from-file=sshPrivateKey=~/.ssh/argocd_bitbucket \
  -n argocd --dry-run=client -o yaml | kubectl apply -f -

# Repository Secret 생성
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: bitbucket-repo
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repository
stringData:
  type: git
  url: git@bitbucket.org:inhuman-z/k6-test-platform.git
  sshPrivateKey: |
$(cat ~/.ssh/argocd_bitbucket | sed 's/^/    /')
EOF

echo "✅ ArgoCD SSH 설정 완료!"
echo "Bitbucket에 공개키를 등록한 후 동기화를 시작하세요."
```

## 참고 링크

- [ArgoCD Repository Credentials](https://argo-cd.readthedocs.io/en/stable/user-guide/private-repositories/)
- [Bitbucket SSH Keys](https://support.atlassian.com/bitbucket-cloud/docs/set-up-an-ssh-key/)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)