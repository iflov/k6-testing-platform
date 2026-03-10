# Monitoring assets

이 디렉토리는 Stage 3 운영 항목을 저장소에서 재현할 수 있도록 하는 모니터링 보조 산출물을 담습니다.

## 포함 항목

- `grafana-datasource.yaml` — Grafana가 InfluxDB와 Cloud Monitoring을 함께 바라볼 수 있도록 하는 예시 프로비저닝 리소스

## 의도

- **Grafana**: k6 메트릭을 InfluxDB에서 조회
- **Cloud Monitoring**: GKE 노드/Pod 메트릭을 기본 수집
- **포트폴리오 설명 포인트**: 애플리케이션 메트릭과 인프라 메트릭을 분리해 설명할 수 있게 함

> 실제 적용 전에는 `PROJECT_ID`, `INFLUXDB_VM_PRIVATE_IP`, `GRAFANA_API_KEY_SECRET_NAME` 같은 placeholder를 환경에 맞게 치환해야 합니다.
