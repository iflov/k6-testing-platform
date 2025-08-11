import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');

// Smoke Test: 최소한의 부하로 시스템 기본 동작 확인
// 목적: 스크립트가 올바르게 작동하는지, 시스템이 최소 부하를 처리할 수 있는지 확인
export const options = {
  vus: 1, // 1명의 가상 사용자
  duration: '1m', // 1분간 실행
  thresholds: {
    'http_req_duration': ['p(99)<1000'], // 99%가 1초 이내
    'http_req_failed': ['rate<0.01'], // 에러율 1% 미만
    'errors': ['rate<0.01'], // 커스텀 에러율 1% 미만
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://mock-server:3001';

export default function () {
  // Health Check
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`);
    
    const success = check(res, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time < 200ms': (r) => r.timings.duration < 200,
      'health check has valid response': (r) => {
        const body = JSON.parse(r.body);
        return body.status === 'healthy';
      },
    });
    
    errorRate.add(!success);
    apiDuration.add(res.timings.duration);
  });
  
  sleep(2);
  
  // User API Test
  group('User API', () => {
    const userId = Math.floor(Math.random() * 10) + 1;
    const res = http.get(`${BASE_URL}/api/users/${userId}`);
    
    const success = check(res, {
      'user API status is 200': (r) => r.status === 200,
      'user API response time < 500ms': (r) => r.timings.duration < 500,
      'user API returns user data': (r) => {
        const body = JSON.parse(r.body);
        return body.id && body.name && body.email;
      },
    });
    
    errorRate.add(!success);
    apiDuration.add(res.timings.duration);
  });
  
  sleep(2);
  
  // Products API Test
  group('Products API', () => {
    const res = http.get(`${BASE_URL}/api/products?limit=5`);
    
    const success = check(res, {
      'products API status is 200': (r) => r.status === 200,
      'products API response time < 500ms': (r) => r.timings.duration < 500,
      'products API returns array': (r) => Array.isArray(JSON.parse(r.body)),
      'products API returns items': (r) => JSON.parse(r.body).length > 0,
    });
    
    errorRate.add(!success);
    apiDuration.add(res.timings.duration);
  });
  
  sleep(2);
  
  // Simple Order Creation Test
  group('Order Creation', () => {
    const payload = JSON.stringify({
      userId: Math.floor(Math.random() * 10) + 1,
      productIds: [1, 2],
      quantity: 1,
    });
    
    const params = {
      headers: { 'Content-Type': 'application/json' },
    };
    
    const res = http.post(`${BASE_URL}/api/orders`, payload, params);
    
    const success = check(res, {
      'order creation status is 201': (r) => r.status === 201,
      'order creation response time < 1000ms': (r) => r.timings.duration < 1000,
      'order creation returns order ID': (r) => {
        const body = JSON.parse(r.body);
        return body.id !== undefined;
      },
    });
    
    errorRate.add(!success);
    apiDuration.add(res.timings.duration);
  });
  
  sleep(3); // 각 반복 간 3초 대기
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    '/tmp/smoke-test-summary.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const { metrics } = data;
  let summary = '\n========== SMOKE TEST SUMMARY ==========\n';
  
  if (metrics) {
    summary += '\n📊 Key Metrics:\n';
    summary += `  ✅ Checks Passed: ${(metrics.checks && metrics.checks.passes) || 0}\n`;
    summary += `  ❌ Checks Failed: ${(metrics.checks && metrics.checks.fails) || 0}\n`;
    const passes = (metrics.checks && metrics.checks.passes) || 0;
    const fails = (metrics.checks && metrics.checks.fails) || 0;
    const successRate = passes + fails > 0 ? ((passes / (passes + fails)) * 100).toFixed(2) : '0.00';
    summary += `  📈 Success Rate: ${successRate}%\n`;
    summary += `\n⏱️  Response Times:\n`;
    summary += `  • Average: ${metrics.http_req_duration && metrics.http_req_duration.avg ? metrics.http_req_duration.avg.toFixed(2) : '0'}ms\n`;
    summary += `  • Median: ${metrics.http_req_duration && metrics.http_req_duration.med ? metrics.http_req_duration.med.toFixed(2) : '0'}ms\n`;
    summary += `  • P95: ${metrics.http_req_duration && metrics.http_req_duration['p(95)'] ? metrics.http_req_duration['p(95)'].toFixed(2) : '0'}ms\n`;
    summary += `  • P99: ${metrics.http_req_duration && metrics.http_req_duration['p(99)'] ? metrics.http_req_duration['p(99)'].toFixed(2) : '0'}ms\n`;
    summary += `\n📊 Throughput:\n`;
    summary += `  • Total Requests: ${(metrics.http_reqs && metrics.http_reqs.count) || 0}\n`;
    summary += `  • Request Rate: ${metrics.http_reqs && metrics.http_reqs.rate ? metrics.http_reqs.rate.toFixed(2) : '0'} req/s\n`;
    summary += `  • Data Received: ${metrics.data_received && metrics.data_received.count ? (metrics.data_received.count / 1024).toFixed(2) : '0.00'} KB\n`;
    summary += `  • Data Sent: ${metrics.data_sent && metrics.data_sent.count ? (metrics.data_sent.count / 1024).toFixed(2) : '0.00'} KB\n`;
    summary += `\n❗ Errors:\n`;
    summary += `  • Error Rate: ${metrics.errors && metrics.errors.rate ? (metrics.errors.rate * 100).toFixed(2) : '0.00'}%\n`;
    summary += `  • Failed Requests: ${(metrics.http_req_failed && metrics.http_req_failed.passes) || 0}\n`;
  }
  
  summary += '\n========================================\n';
  return summary;
}