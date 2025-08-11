# 아키텍처 개선 제안

## 현재 구조의 한계

현재 Docker-in-Docker 방식은 프로토타입에는 적합하지만, 다음과 같은 한계가 있습니다:

1. **보안 이슈**: Docker Socket을 마운트하는 것은 보안 위험
2. **복잡도**: 컨테이너 내부에서 컨테이너 관리
3. **확장성**: 동시 테스트 실행 시 포트 충돌
4. **모니터링**: 테스트 상태 추적 어려움

## 권장 아키텍처

### Option 1: Job Queue 기반 (추천)

```
Control Panel → Redis Queue → Worker → k6 실행
                     ↓
                InfluxDB/Grafana
```

**장점:**
- 비동기 처리로 확장성 확보
- 여러 테스트 동시 실행 가능
- 실패 시 재시도 가능
- 테스트 이력 관리 용이

**구현 예시:**
```javascript
// Bull Queue 사용
const Queue = require('bull');
const testQueue = new Queue('k6-tests');

// Control Panel에서
testQueue.add('run-test', {
  vus: 50,
  duration: '5m',
  scenario: 'load-test'
});

// Worker에서
testQueue.process('run-test', async (job) => {
  const { vus, duration } = job.data;
  // k6 실행
});
```

### Option 2: k6 Operator (Kubernetes)

Kubernetes 환경이라면 k6 Operator 사용:

```yaml
apiVersion: k6.io/v1alpha1
kind: K6
metadata:
  name: k6-test
spec:
  parallelism: 4
  script:
    configMap:
      name: k6-test-script
```

### Option 3: k6 as a Service

k6를 항상 실행 중인 서비스로 만들고 REST API로 제어:

```yaml
k6-service:
  image: custom-k6-api
  ports:
    - "8080:8080"  # API
    - "5665:5665"  # Dashboard
  command: ["k6-api-server"]
```

## 마이그레이션 계획

### Phase 1: 현재 구조 유지 (완료)
- Docker-in-Docker로 MVP 구현
- 기본 기능 검증

### Phase 1.5: K6 Runner 서비스 도입 (완료)
- 독립적인 k6-runner 서비스 구현
- k6를 child process로 실행
- REST API를 통한 테스트 관리
- Web Dashboard 통합 유지

### Phase 2: Job Queue 도입
1. Redis 추가
2. Bull Queue 구현
3. Worker 서비스 구현
4. Control Panel 수정

### Phase 3: 모니터링 강화
1. Grafana 대시보드 구성
2. 알림 시스템 구축
3. 테스트 이력 저장

## 결론

현재 구조는 **프로토타입이나 개발 환경**에서는 충분하지만, **프로덕션 환경**에서는 Job Queue 기반이나 k6 Operator를 사용하는 것이 권장됩니다.

### 선택 기준
- **소규모/개발**: 현재 구조 유지
- **중규모/스테이징**: Job Queue 방식
- **대규모/프로덕션**: k6 Operator 또는 k6 Cloud