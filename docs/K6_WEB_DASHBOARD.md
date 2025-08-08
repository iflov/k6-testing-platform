# k6 Web Dashboard 사용 가이드

## 개요
k6 Web Dashboard는 성능 테스트 실행 중 실시간으로 결과를 시각화하는 내장 기능입니다. 이 가이드는 Docker Compose 환경에서 k6 Web Dashboard를 설정하고 사용하는 방법을 설명합니다.

## 주요 기능
- 실시간 성능 메트릭 모니터링
- 시각적 차트와 그래프
- 테스트 진행 상황 추적
- HTML 리포트 생성 및 내보내기
- 다중 메트릭 동시 모니터링

## 설정 방법

### 1. Docker Compose 실행
```bash
# k6 테스트와 웹 대시보드 함께 실행
docker-compose --profile test up k6

# 백그라운드에서 실행
docker-compose --profile test up -d k6
```

### 2. 웹 대시보드 접속
- **URL**: http://localhost:5665
- 테스트가 시작되면 자동으로 대시보드가 활성화됩니다

### 3. 환경 변수 설정
현재 `docker-compose.yml`에 설정된 환경 변수:

| 환경 변수 | 값 | 설명 |
|----------|-----|------|
| `K6_WEB_DASHBOARD` | `true` | 대시보드 활성화 |
| `K6_WEB_DASHBOARD_HOST` | `0.0.0.0` | 모든 인터페이스에서 접근 허용 |
| `K6_WEB_DASHBOARD_PORT` | `5665` | 대시보드 포트 |
| `K6_WEB_DASHBOARD_PERIOD` | `1s` | 업데이트 주기 |
| `K6_WEB_DASHBOARD_EXPORT` | `/reports/test-report.html` | HTML 리포트 저장 경로 |

## 사용 예제

### 기본 로드 테스트 실행
```bash
# 10명의 가상 사용자로 30초간 테스트
docker-compose --profile test run \
  -e VUS=10 \
  -e DURATION=30s \
  k6
```

### 커스텀 시나리오 실행
```bash
# 스트레스 테스트 실행
docker-compose --profile test run \
  -e VUS=100 \
  -e DURATION=5m \
  k6 run --out influxdb=http://influxdb:8086/k6 \
  --out web-dashboard /scripts/scenarios/stress-test.js
```

### 특정 엔드포인트 테스트
```bash
docker-compose --profile test run \
  -e TARGET_URL=http://mock-server:3001 \
  -e ENDPOINT=/api/data \
  -e VUS=50 \
  -e DURATION=2m \
  k6
```

## 대시보드 UI 구성

### 실시간 메트릭
- **Request Rate**: 초당 요청 수
- **Request Duration**: 응답 시간 (평균, P95, P99)
- **Request Waiting**: 대기 시간
- **Request Failed**: 실패한 요청 비율
- **Data Received/Sent**: 네트워크 트래픽
- **Virtual Users**: 활성 가상 사용자 수

### 차트 타입
1. **Time Series**: 시간에 따른 메트릭 변화
2. **Distribution**: 응답 시간 분포
3. **Summary**: 주요 통계 요약

## HTML 리포트 생성

테스트 완료 후 자동으로 HTML 리포트가 생성됩니다:

```bash
# 리포트 확인
ls ./reports/

# 브라우저에서 리포트 열기
open ./reports/test-report.html  # macOS
xdg-open ./reports/test-report.html  # Linux
```

## 트러블슈팅

### 대시보드에 접속할 수 없는 경우
```bash
# 컨테이너 상태 확인
docker-compose ps

# 포트 바인딩 확인
docker-compose port k6 5665

# 로그 확인
docker-compose logs k6
```

### 리포트가 생성되지 않는 경우
```bash
# reports 디렉토리 권한 확인
ls -la ./reports/

# 필요시 권한 변경
chmod 755 ./reports/
```

### 메트릭이 표시되지 않는 경우
```bash
# InfluxDB 연결 확인
docker-compose exec k6 sh -c "curl http://influxdb:8086/ping"
```

## 고급 설정

### 대시보드 업데이트 주기 조정
```yaml
# docker-compose.yml
environment:
  - K6_WEB_DASHBOARD_PERIOD=500ms  # 더 빠른 업데이트
```

### 커스텀 포트 사용
```yaml
# docker-compose.yml
ports:
  - "8080:8080"
environment:
  - K6_WEB_DASHBOARD_PORT=8080
```

### 리포트 파일명 커스터마이징
```bash
docker-compose --profile test run \
  -e K6_WEB_DASHBOARD_EXPORT=/reports/load-test-$(date +%Y%m%d-%H%M%S).html \
  k6
```

## 참고 사항

### CI/CD 환경에서의 사용
CI/CD 파이프라인에서는 대시보드 창이 열려있는 동안 k6 프로세스가 계속 실행됩니다. 자동화된 환경에서는 다음과 같이 설정하세요:

```bash
# 대시보드 비활성화하고 리포트만 생성
docker-compose --profile test run \
  -e K6_WEB_DASHBOARD=false \
  -e K6_WEB_DASHBOARD_EXPORT=/reports/test-report.html \
  k6
```

### 성능 최적화
- 대시보드는 추가 리소스를 사용하므로 매우 큰 부하 테스트에서는 성능에 영향을 줄 수 있습니다
- 필요한 경우 업데이트 주기를 늘려 리소스 사용을 줄일 수 있습니다

## 관련 문서
- [k6 공식 문서](https://grafana.com/docs/k6/latest/)
- [k6 Web Dashboard 문서](https://grafana.com/docs/k6/latest/results-output/web-dashboard/)
- [프로젝트 README](../README.md)