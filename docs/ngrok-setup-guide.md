# ngrok 설정 가이드

## 문제 상황
ngrok 최신 버전은 무료 사용자도 계정 가입과 authtoken이 필요합니다.

## 해결 방법

### 1단계: ngrok 계정 가입
1. https://dashboard.ngrok.com/signup 접속
2. 무료 계정 가입 (GitHub 또는 Google 계정으로 가입 가능)
3. 이메일 인증 완료

### 2단계: Authtoken 설정
1. 가입 후 대시보드 접속: https://dashboard.ngrok.com/get-started/your-authtoken
2. Your Authtoken 복사
3. 터미널에서 authtoken 설정:
```bash
ngrok config add-authtoken <your-authtoken-here>
```

### 3단계: ngrok 터널 생성
```bash
# ArgoCD 포트 포워딩 먼저 실행
kubectl port-forward svc/argocd-server -n argocd 8080:443

# 새 터미널에서 ngrok 실행
ngrok http 8080
```

### 4단계: Webhook URL 확인
ngrok 실행 후 표시되는 URL 확인:
```
Forwarding  https://abc123def.ngrok-free.app -> http://localhost:8080
```

이 URL을 사용하여 Bitbucket webhook 설정:
- Webhook URL: `https://abc123def.ngrok-free.app/api/webhook`

## 대안: 로컬 테스트용 다른 방법들

### 방법 1: localtunnel 사용
```bash
# 설치
npm install -g localtunnel

# 실행
lt --port 8080 --subdomain argocd-test
# URL: https://argocd-test.loca.lt
```

### 방법 2: cloudflared tunnel 사용
```bash
# Mac 설치
brew install cloudflared

# 실행
cloudflared tunnel --url http://localhost:8080
```

### 방법 3: Webhook 없이 수동 동기화
로컬 테스트 중에는 webhook 대신 수동 동기화를 사용할 수 있습니다:

```bash
# ArgoCD CLI로 수동 동기화
argocd app sync control-panel
argocd app sync k6-runner
argocd app sync mock-server

# 또는 watch 모드로 자동 감지
watch -n 30 'argocd app sync --prune control-panel k6-runner mock-server'
```

### 방법 4: ArgoCD 자동 동기화 설정
Application YAML에 이미 자동 동기화가 설정되어 있으므로,
ArgoCD가 주기적으로(기본 3분) Git 저장소를 폴링합니다.

```yaml
syncPolicy:
  automated:
    prune: true
    selfHeal: true
```

이 경우 webhook 없이도 변경사항이 자동 반영됩니다.
단지 3분 정도의 지연이 있을 뿐입니다.

## 권장 사항

**로컬 테스트**: 
- 간단한 테스트: ArgoCD 자동 동기화 사용 (3분 대기)
- 즉시 반영 필요: 수동 동기화 명령어 사용
- 실제 webhook 테스트 필요: ngrok 무료 계정 가입

**프로덕션**:
- AWS EKS의 ArgoCD는 공개 URL이 있으므로 webhook 직접 설정 가능

## 포트 포워딩 관리 팁

### 포트 포워딩 확인
```bash
# 실행 중인 포트 포워딩 확인
ps aux | grep port-forward

# 특정 포트 사용 확인
lsof -i :8080
netstat -an | grep 8080
```

### 포트 포워딩 종료
```bash
# Ctrl+C로 종료되지 않을 때
# 프로세스 ID 찾기
ps aux | grep "kubectl port-forward"

# 프로세스 강제 종료
kill -9 <PID>
```

### 백그라운드 실행
```bash
# 백그라운드로 실행 (&)
kubectl port-forward svc/argocd-server -n argocd 8080:443 &

# nohup으로 터미널 종료 후에도 유지
nohup kubectl port-forward svc/argocd-server -n argocd 8080:443 > /dev/null 2>&1 &

# 종료하려면
jobs  # 백그라운드 작업 확인
kill %1  # 작업 번호로 종료
```