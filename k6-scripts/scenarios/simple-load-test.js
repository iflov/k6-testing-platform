import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');

// Simple Load Test: 설정 가능한 부하 테스트
// VUs와 Duration을 환경변수로 조절 가능
export const options = {
  vus: __ENV.VUS ? parseInt(__ENV.VUS) : 10,
  duration: __ENV.DURATION || '1m',
  thresholds: {
    'http_req_duration': ['p(95)<2000'], // 95%가 2초 이내
    'http_req_failed': ['rate<0.1'],     // 에러율 10% 미만
    'errors': ['rate<0.1'],              // 커스텀 에러율 10% 미만
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://mock-server:3001';
const ENDPOINT = __ENV.ENDPOINT || '/';

export default function () {
  // Simple HTTP GET request
  const res = http.get(`${BASE_URL}${ENDPOINT}`, {
    timeout: '5s',
  });
  
  // Check response
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  // Update metrics
  errorRate.add(!success);
  requestDuration.add(res.timings.duration);
  
  // Think time
  sleep(1);
}

export function handleSummary(data) {
  const { metrics } = data;
  let summary = '\n========== LOAD TEST SUMMARY ==========\n';
  
  if (metrics) {
    summary += '\n📊 Test Configuration:\n';
    summary += `  • Virtual Users: ${__ENV.VUS || 10}\n`;
    summary += `  • Duration: ${__ENV.DURATION || '1m'}\n`;
    summary += `  • Target URL: ${BASE_URL}${ENDPOINT}\n`;
    
    summary += '\n⏱️ Response Times:\n';
    summary += `  • Average: ${metrics.http_req_duration?.avg?.toFixed(2)}ms\n`;
    summary += `  • Median: ${metrics.http_req_duration?.med?.toFixed(2)}ms\n`;
    summary += `  • P95: ${metrics.http_req_duration?.p95?.toFixed(2)}ms\n`;
    summary += `  • P99: ${metrics.http_req_duration?.p99?.toFixed(2)}ms\n`;
    
    summary += '\n📈 Throughput:\n';
    summary += `  • Total Requests: ${metrics.http_reqs?.count || 0}\n`;
    summary += `  • Request Rate: ${metrics.http_reqs?.rate?.toFixed(2)} req/s\n`;
    
    summary += '\n✅ Success Metrics:\n';
    summary += `  • Success Rate: ${((1 - metrics.errors?.rate) * 100).toFixed(2)}%\n`;
    summary += `  • Error Rate: ${(metrics.errors?.rate * 100).toFixed(2)}%\n`;
  }
  
  summary += '\n========================================\n';
  return {
    'stdout': summary,
    '/tmp/load-test-summary.json': JSON.stringify(data),
  };
}