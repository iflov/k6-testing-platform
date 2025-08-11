import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');
const successfulOrders = new Counter('successful_orders');
const failedOrders = new Counter('failed_orders');

// Load Test: 예상 평균 부하로 시스템 성능 측정
// 목적: 일반적인 운영 상황에서 시스템 성능과 안정성 확인
export const options = {
  stages: [
    { duration: '2m', target: 20 },  // 2분간 20 VU로 증가
    { duration: '5m', target: 20 },  // 5분간 20 VU 유지
    { duration: '2m', target: 0 },   // 2분간 0으로 감소
  ],
  thresholds: {
    'http_req_duration': ['p(95)<800', 'p(99)<1500'], // 95%는 800ms, 99%는 1.5초 이내
    'http_req_failed': ['rate<0.05'], // 에러율 5% 미만
    'errors': ['rate<0.05'], // 커스텀 에러율 5% 미만
    'successful_orders': ['count>100'], // 최소 100개 이상 주문 성공
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://mock-server:3001';

export default function () {
  // Realistic user behavior simulation with weighted scenarios
  const scenario = Math.random();
  
  if (scenario < 0.35) {
    // 35% - Browse products
    group('Browse Products', () => {
      // List products with pagination
      const page = Math.floor(Math.random() * 5) + 1;
      const limit = 20;
      const res = http.get(`${BASE_URL}/api/products?page=${page}&limit=${limit}`);
      
      const success = check(res, {
        'products list status is 200': (r) => r.status === 200,
        'products list is array': (r) => Array.isArray(JSON.parse(r.body)),
        'products list has items': (r) => JSON.parse(r.body).length > 0,
        'products response time < 500ms': (r) => r.timings.duration < 500,
      });
      
      errorRate.add(!success);
      apiDuration.add(res.timings.duration);
      
      // View product details
      if (success && res.status === 200) {
        sleep(Math.random() * 2 + 1); // User reading product list
        
        const products = JSON.parse(res.body);
        if (products.length > 0) {
          const product = products[Math.floor(Math.random() * products.length)];
          const detailRes = http.get(`${BASE_URL}/api/products/${product.id}`);
          
          check(detailRes, {
            'product detail status is 200': (r) => r.status === 200,
            'product detail has data': (r) => JSON.parse(r.body).id !== undefined,
          });
          
          apiDuration.add(detailRes.timings.duration);
        }
      }
    });
    
  } else if (scenario < 0.60) {
    // 25% - User profile and activities
    group('User Activities', () => {
      const userId = Math.floor(Math.random() * 100) + 1;
      
      // Get user profile
      const userRes = http.get(`${BASE_URL}/api/users/${userId}`);
      
      const success = check(userRes, {
        'user profile status is 200': (r) => r.status === 200,
        'user profile has data': (r) => {
          const body = JSON.parse(r.body);
          return body.id && body.name && body.email;
        },
        'user response time < 300ms': (r) => r.timings.duration < 300,
      });
      
      errorRate.add(!success);
      apiDuration.add(userRes.timings.duration);
      
      // Get user's order history
      if (success) {
        sleep(0.5);
        const ordersRes = http.get(`${BASE_URL}/api/users/${userId}/orders`);
        
        check(ordersRes, {
          'user orders status is 200': (r) => r.status === 200,
          'user orders is array': (r) => Array.isArray(JSON.parse(r.body)),
        });
        
        apiDuration.add(ordersRes.timings.duration);
      }
    });
    
  } else if (scenario < 0.80) {
    // 20% - Purchase flow
    group('Purchase Flow', () => {
      // Add to cart and create order
      const payload = JSON.stringify({
        userId: Math.floor(Math.random() * 100) + 1,
        productIds: [
          Math.floor(Math.random() * 50) + 1,
          Math.floor(Math.random() * 50) + 1,
          Math.floor(Math.random() * 50) + 1,
        ],
        quantities: [1, 2, 1],
        paymentMethod: 'credit_card',
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          zipCode: '12345',
        },
      });
      
      const params = {
        headers: { 'Content-Type': 'application/json' },
      };
      
      const res = http.post(`${BASE_URL}/api/orders`, payload, params);
      
      const success = check(res, {
        'order created successfully': (r) => r.status === 201,
        'order has confirmation ID': (r) => JSON.parse(r.body).id !== undefined,
        'order response time < 1000ms': (r) => r.timings.duration < 1000,
      });
      
      if (success) {
        successfulOrders.add(1);
      } else {
        failedOrders.add(1);
      }
      
      errorRate.add(!success);
      apiDuration.add(res.timings.duration);
    });
    
  } else if (scenario < 0.95) {
    // 15% - Search operations
    group('Search', () => {
      const searchTerms = ['laptop', 'phone', 'tablet', 'watch', 'camera'];
      const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
      
      const res = http.get(`${BASE_URL}/api/search?q=${term}&limit=10`);
      
      const success = check(res, {
        'search status is 200': (r) => r.status === 200,
        'search returns results': (r) => Array.isArray(JSON.parse(r.body)),
        'search response time < 700ms': (r) => r.timings.duration < 700,
      });
      
      errorRate.add(!success);
      apiDuration.add(res.timings.duration);
    });
    
  } else {
    // 5% - Health check
    group('Health Check', () => {
      const res = http.get(`${BASE_URL}/health`);
      
      const success = check(res, {
        'health check OK': (r) => r.status === 200,
        'health check fast': (r) => r.timings.duration < 100,
      });
      
      errorRate.add(!success);
    });
  }
  
  // Realistic think time between actions (1-3 seconds)
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    '/tmp/load-test-summary.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const { metrics } = data;
  let summary = '\n========== LOAD TEST SUMMARY ==========\n';
  
  if (metrics) {
    summary += '\n📊 Performance Metrics:\n';
    summary += `  • Average Response Time: ${metrics.http_req_duration && metrics.http_req_duration.avg ? metrics.http_req_duration.avg.toFixed(2) : '0'}ms\n`;
    summary += `  • Median Response Time: ${metrics.http_req_duration && metrics.http_req_duration.med ? metrics.http_req_duration.med.toFixed(2) : '0'}ms\n`;
    summary += `  • P95 Response Time: ${metrics.http_req_duration && metrics.http_req_duration['p(95)'] ? metrics.http_req_duration['p(95)'].toFixed(2) : '0'}ms\n`;
    summary += `  • P99 Response Time: ${metrics.http_req_duration && metrics.http_req_duration['p(99)'] ? metrics.http_req_duration['p(99)'].toFixed(2) : '0'}ms\n`;
    
    summary += '\n📈 Throughput:\n';
    summary += `  • Total Requests: ${(metrics.http_reqs && metrics.http_reqs.count) || 0}\n`;
    summary += `  • Request Rate: ${metrics.http_reqs && metrics.http_reqs.rate ? metrics.http_reqs.rate.toFixed(2) : '0'} req/s\n`;
    summary += `  • Successful Orders: ${(metrics.successful_orders && metrics.successful_orders.count) || 0}\n`;
    summary += `  • Failed Orders: ${(metrics.failed_orders && metrics.failed_orders.count) || 0}\n`;
    
    summary += '\n✅ Success Metrics:\n';
    summary += `  • Checks Passed: ${(metrics.checks && metrics.checks.passes) || 0}\n`;
    summary += `  • Checks Failed: ${(metrics.checks && metrics.checks.fails) || 0}\n`;
    const passes = (metrics.checks && metrics.checks.passes) || 0;
    const fails = (metrics.checks && metrics.checks.fails) || 0;
    const successRate = passes + fails > 0 ? ((passes / (passes + fails)) * 100).toFixed(2) : '0.00';
    summary += `  • Success Rate: ${successRate}%\n`;
    
    summary += '\n❌ Error Metrics:\n';
    summary += `  • Error Rate: ${metrics.errors && metrics.errors.rate ? (metrics.errors.rate * 100).toFixed(2) : '0.00'}%\n`;
    summary += `  • Failed Requests: ${(metrics.http_req_failed && metrics.http_req_failed.passes) || 0}\n`;
    
    summary += '\n🌐 Network:\n';
    summary += `  • Data Received: ${metrics.data_received && metrics.data_received.count ? (metrics.data_received.count / 1024 / 1024).toFixed(2) : '0.00'} MB\n`;
    summary += `  • Data Sent: ${metrics.data_sent && metrics.data_sent.count ? (metrics.data_sent.count / 1024 / 1024).toFixed(2) : '0.00'} MB\n`;
    
    summary += '\n👥 Virtual Users:\n';
    summary += `  • Max VUs: ${(metrics.vus_max && metrics.vus_max.max) || 0}\n`;
    summary += `  • Iterations: ${(metrics.iterations && metrics.iterations.count) || 0}\n`;
  }
  
  summary += '\n=======================================\n';
  return summary;
}