import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics for long-term stability monitoring
const errorRate = new Rate('errors');
const memoryLeakIndicator = new Trend('response_time_degradation');
const requestCounter = new Counter('total_requests');
const connectionErrors = new Counter('connection_errors');
const resourceExhaustion = new Counter('resource_exhaustion');
const performanceDegradation = new Gauge('performance_degradation_percentage');
const memoryUsageTrend = new Trend('memory_usage_mb');
const cpuUsageTrend = new Trend('cpu_usage_percentage');

// Soak Test: 장시간 운영 안정성 테스트
// 목적: 메모리 누수, 리소스 고갈, 성능 저하 등 장시간 운영 시 발생하는 문제 발견
export const options = {
  stages: [
    { duration: '5m', target: 30 },    // 5분간 30 VU로 증가 (warm-up)
    { duration: '2h', target: 30 },    // 2시간 동안 30 VU 유지 (soak period)
    { duration: '5m', target: 50 },    // 5분간 50 VU로 증가 (stress during soak)
    { duration: '30m', target: 50 },   // 30분간 50 VU 유지
    { duration: '5m', target: 30 },    // 5분간 30 VU로 감소
    { duration: '1h', target: 30 },    // 1시간 동안 30 VU 유지 (recovery observation)
    { duration: '5m', target: 0 },     // 5분간 0으로 감소 (cool-down)
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1500', 'p(99)<3000'], // 성능이 저하되지 않아야 함
    'http_req_failed': ['rate<0.02'],                   // 에러율 2% 미만
    'errors': ['rate<0.02'],                            // 커스텀 에러율 2% 미만
    'response_time_degradation': ['avg<200'],           // 평균 응답 시간 증가 200ms 이내
    'connection_errors': ['count<100'],                 // 연결 에러 100개 미만
    'resource_exhaustion': ['count<50'],                // 리소스 고갈 50회 미만
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://mock-server:3001';

// Performance tracking variables
let baselineMetrics = {
  responseTime: null,
  memoryUsage: null,
  cpuUsage: null,
  errorRate: 0,
};
let requestCount = 0;
let hourlyMetrics = [];
let performanceHistory = [];

export default function () {
  requestCount++;
  const currentTime = Date.now();
  
  // Simulate realistic traffic patterns
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  const isBusinessHours = hour >= 9 && hour <= 17;
  const isPeakTime = (hour === 12 || hour === 15); // Lunch and afternoon peak
  
  let loadMultiplier = 1;
  if (isPeakTime) loadMultiplier = 2;
  else if (isBusinessHours) loadMultiplier = 1.5;
  
  const scenario = Math.random() * loadMultiplier;
  
  if (scenario < 0.35) {
    // 35% - User operations (continuous load)
    group('User Operations', () => {
      const operation = Math.random();
      let res;
      
      if (operation < 0.7) {
        // Get user profile with related data
        const userId = Math.floor(Math.random() * 1000) + 1;
        const batch = http.batch([
          ['GET', `${BASE_URL}/api/users/${userId}`],
          ['GET', `${BASE_URL}/api/users/${userId}/orders`],
          ['GET', `${BASE_URL}/api/users/${userId}/preferences`],
        ]);
        
        batch.forEach((batchRes) => {
          const success = check(batchRes, {
            'user data retrieved': (r) => r.status === 200,
            'no timeout': (r) => r.status !== 0,
            'response time stable': (r) => r.timings.duration < 1500,
          });
          
          if (!success) {
            if (batchRes.status === 0) connectionErrors.add(1);
            errorRate.add(1);
          }
          trackDegradation(batchRes.timings.duration);
        });
      } else {
        // Create/Update user (write operation)
        const payload = JSON.stringify({
          name: `SoakUser_${requestCount}`,
          email: `soak_${currentTime}@test.com`,
          preferences: {
            theme: 'dark',
            notifications: true,
            language: 'en',
          },
          metadata: {
            testRun: requestCount,
            timestamp: currentTime,
          },
        });
        
        res = http.post(`${BASE_URL}/api/users`, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: '5s',
        });
        
        const success = check(res, {
          'user created/updated': (r) => r.status === 201 || r.status === 200,
          'no resource exhaustion': (r) => r.status !== 503,
        });
        
        if (res.status === 503) resourceExhaustion.add(1);
        errorRate.add(!success);
        trackDegradation(res.timings.duration);
      }
    });
    
  } else if (scenario < 0.60) {
    // 25% - Product catalog operations (read-heavy)
    group('Product Operations', () => {
      const operations = [
        () => http.get(`${BASE_URL}/api/products?page=${Math.floor(Math.random() * 10) + 1}&limit=50`),
        () => http.get(`${BASE_URL}/api/products/search?q=laptop&filters=true`),
        () => http.get(`${BASE_URL}/api/categories/electronics/products`),
      ];
      
      const operation = operations[Math.floor(Math.random() * operations.length)];
      const res = operation();
      
      const success = check(res, {
        'products loaded': (r) => r.status === 200,
        'no memory leak signs': (r) => r.timings.duration < 2000,
        'data integrity': (r) => {
          try {
            const body = JSON.parse(r.body);
            return Array.isArray(body) || (body.products && Array.isArray(body.products));
          } catch {
            return false;
          }
        },
      });
      
      errorRate.add(!success);
      trackDegradation(res.timings.duration);
    });
    
  } else if (scenario < 0.80) {
    // 20% - Complex transactions (database-intensive)
    group('Complex Transactions', () => {
      // Simulate complex order with inventory check, payment, and shipping
      const orderData = {
        userId: Math.floor(Math.random() * 1000) + 1,
        items: Array.from(
          { length: Math.floor(Math.random() * 5) + 1 },
          () => ({
            productId: Math.floor(Math.random() * 100) + 1,
            quantity: Math.floor(Math.random() * 3) + 1,
            price: Math.random() * 100 + 10,
          })
        ),
        payment: {
          method: 'credit_card',
          amount: Math.random() * 500 + 50,
        },
        shipping: {
          address: '123 Test St',
          city: 'Test City',
          priority: requestCount % 10 === 0 ? 'express' : 'standard',
        },
        metadata: {
          sessionId: `soak_${requestCount}`,
          timestamp: currentTime,
        },
      };
      
      const res = http.post(`${BASE_URL}/api/orders`, JSON.stringify(orderData), {
        headers: { 'Content-Type': 'application/json' },
        timeout: '10s',
      });
      
      const success = check(res, {
        'order processed': (r) => r.status === 201,
        'no timeout': (r) => r.status !== 0,
        'no resource issues': (r) => r.status !== 503 && r.status !== 507,
      });
      
      if (res.status === 503 || res.status === 507) {
        resourceExhaustion.add(1);
        console.log(`Resource exhaustion at request ${requestCount}: ${res.status}`);
      }
      if (res.status === 0) connectionErrors.add(1);
      
      errorRate.add(!success);
      trackDegradation(res.timings.duration);
    });
    
  } else if (scenario < 0.95) {
    // 15% - Report generation (resource-intensive)
    group('Report Generation', () => {
      const reportTypes = ['sales', 'inventory', 'users', 'performance'];
      const reportType = reportTypes[Math.floor(Math.random() * reportTypes.length)];
      
      const res = http.get(
        `${BASE_URL}/api/reports/${reportType}?startDate=2024-01-01&endDate=2024-12-31`,
        { timeout: '15s' }
      );
      
      const success = check(res, {
        'report generated': (r) => r.status === 200,
        'no timeout': (r) => r.status !== 0,
        'acceptable time': (r) => r.timings.duration < 10000,
      });
      
      if (res.status === 0) {
        connectionErrors.add(1);
        console.log(`Report generation timeout at request ${requestCount}`);
      }
      
      errorRate.add(!success);
      trackDegradation(res.timings.duration);
    });
    
  } else {
    // 5% - System health monitoring
    group('Health Monitoring', () => {
      const res = http.get(`${BASE_URL}/health`, { timeout: '2s' });
      
      const success = check(res, {
        'system healthy': (r) => r.status === 200,
        'memory usage normal': (r) => {
          try {
            const body = JSON.parse(r.body);
            if (body.memory) {
              const memoryMB = body.memory.heapUsed / 1024 / 1024;
              memoryUsageTrend.add(memoryMB);
              
              // Track CPU if available
              if (body.cpu) {
                cpuUsageTrend.add(body.cpu.usage || 0);
              }
              
              return memoryMB < 800; // 800MB threshold
            }
            return true;
          } catch {
            return false;
          }
        },
        'response time healthy': (r) => r.timings.duration < 200,
      });
      
      if (!success) {
        console.log(`Health check failed at request ${requestCount}`);
      }
      
      errorRate.add(!success);
    });
  }
  
  requestCounter.add(1);
  
  // Track hourly metrics
  if (requestCount % 1000 === 0) {
    const currentHour = Math.floor(requestCount / 1000);
    console.log(`Hour ${currentHour}: ${requestCount} requests processed`);
  }
  
  // Adaptive think time based on system state
  const baseThinkTime = isPeakTime ? 0.5 : 1;
  const thinkTime = baseThinkTime + Math.random() * 2;
  sleep(thinkTime);
}

function trackDegradation(responseTime) {
  // Establish baseline after warm-up (first 500 requests)
  if (requestCount === 500) {
    baselineMetrics.responseTime = responseTime;
    console.log(`Baseline established: ${responseTime.toFixed(2)}ms`);
  }
  
  // Track degradation after baseline established
  if (baselineMetrics.responseTime && requestCount > 500) {
    const degradation = responseTime - baselineMetrics.responseTime;
    memoryLeakIndicator.add(degradation);
    
    // Calculate degradation percentage
    const degradationPercentage = (degradation / baselineMetrics.responseTime) * 100;
    performanceDegradation.add(degradationPercentage);
    
    // Log significant degradation
    if (degradationPercentage > 50 && requestCount % 100 === 0) {
      console.log(
        `Performance degradation detected at request ${requestCount}: ` +
        `${degradationPercentage.toFixed(2)}% (${responseTime.toFixed(2)}ms)`
      );
    }
  }
  
  // Track performance history for trend analysis
  if (requestCount % 100 === 0) {
    performanceHistory.push({
      request: requestCount,
      responseTime: responseTime,
      timestamp: Date.now(),
    });
  }
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    '/tmp/soak-test-summary.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const { metrics } = data;
  let summary = '\n========== SOAK TEST SUMMARY ==========\n';
  
  if (metrics) {
    const testDurationHours = ((data.state && data.state.testRunDurationMs) || 0) / 1000 / 60 / 60;
    
    summary += '\n🕒 Test Duration & Volume:\n';
    summary += `  • Total Duration: ${testDurationHours.toFixed(2)} hours\n`;
    summary += `  • Total Requests: ${(metrics.total_requests && metrics.total_requests.count) || 0}\n`;
    summary += `  • Request Rate: ${metrics.http_reqs && metrics.http_reqs.rate ? metrics.http_reqs.rate.toFixed(2) : '0'} req/s\n`;
    summary += `  • Total Data Sent: ${metrics.data_sent && metrics.data_sent.count ? (metrics.data_sent.count / 1024 / 1024).toFixed(2) : '0.00'} MB\n`;
    summary += `  • Total Data Received: ${metrics.data_received && metrics.data_received.count ? (metrics.data_received.count / 1024 / 1024).toFixed(2) : '0.00'} MB\n`;
    
    summary += '\n📈 Performance Over Time:\n';
    summary += `  • Initial Response Time: ${baselineMetrics.responseTime ? baselineMetrics.responseTime.toFixed(2) : 'N/A'}ms\n`;
    summary += `  • Average Response Time: ${metrics.http_req_duration && metrics.http_req_duration.avg ? metrics.http_req_duration.avg.toFixed(2) : '0'}ms\n`;
    summary += `  • P95 Response Time: ${metrics.http_req_duration && metrics.http_req_duration['p(95)'] ? metrics.http_req_duration['p(95)'].toFixed(2) : '0'}ms\n`;
    summary += `  • P99 Response Time: ${metrics.http_req_duration && metrics.http_req_duration['p(99)'] ? metrics.http_req_duration['p(99)'].toFixed(2) : '0'}ms\n`;
    summary += `  • Max Response Time: ${metrics.http_req_duration && metrics.http_req_duration.max ? metrics.http_req_duration.max.toFixed(2) : '0'}ms\n`;
    
    summary += '\n📋 Degradation Analysis:\n';
    const avgDegradation = (metrics.response_time_degradation && metrics.response_time_degradation.avg) || 0;
    const maxDegradation = (metrics.response_time_degradation && metrics.response_time_degradation.max) || 0;
    const degradationPercentage = (metrics.performance_degradation_percentage && metrics.performance_degradation_percentage.value) || 0;
    
    summary += `  • Average Degradation: ${avgDegradation.toFixed(2)}ms\n`;
    summary += `  • Max Degradation: ${maxDegradation.toFixed(2)}ms\n`;
    summary += `  • Degradation Percentage: ${degradationPercentage.toFixed(2)}%\n`;
    
    summary += '\n💾 Resource Usage:\n';
    summary += `  • Average Memory: ${metrics.memory_usage_mb && metrics.memory_usage_mb.avg ? metrics.memory_usage_mb.avg.toFixed(2) : 'N/A'} MB\n`;
    summary += `  • Peak Memory: ${metrics.memory_usage_mb && metrics.memory_usage_mb.max ? metrics.memory_usage_mb.max.toFixed(2) : 'N/A'} MB\n`;
    summary += `  • Average CPU: ${metrics.cpu_usage_percentage && metrics.cpu_usage_percentage.avg ? metrics.cpu_usage_percentage.avg.toFixed(2) : 'N/A'}%\n`;
    summary += `  • Peak CPU: ${metrics.cpu_usage_percentage && metrics.cpu_usage_percentage.max ? metrics.cpu_usage_percentage.max.toFixed(2) : 'N/A'}%\n`;
    
    summary += '\n⚠️ Error & Stability Metrics:\n';
    summary += `  • Error Rate: ${metrics.errors && metrics.errors.rate ? (metrics.errors.rate * 100).toFixed(3) : '0.000'}%\n`;
    summary += `  • Failed Requests: ${(metrics.http_req_failed && metrics.http_req_failed.passes) || 0}\n`;
    summary += `  • Connection Errors: ${(metrics.connection_errors && metrics.connection_errors.count) || 0}\n`;
    summary += `  • Resource Exhaustion Events: ${(metrics.resource_exhaustion && metrics.resource_exhaustion.count) || 0}\n`;
    
    summary += '\n✅ Success Metrics:\n';
    summary += `  • Checks Passed: ${(metrics.checks && metrics.checks.passes) || 0}\n`;
    summary += `  • Checks Failed: ${(metrics.checks && metrics.checks.fails) || 0}\n`;
    const passes = (metrics.checks && metrics.checks.passes) || 0;
    const fails = (metrics.checks && metrics.checks.fails) || 0;
    const successRate = passes + fails > 0 ? ((passes / (passes + fails)) * 100).toFixed(2) : '0.00';
    summary += `  • Success Rate: ${successRate}%\n`;
    
    // Stability Assessment
    summary += '\n🎯 Stability Assessment:\n';
    
    const errorRate = (metrics.errors && metrics.errors.rate) || 0;
    const exhaustionCount = (metrics.resource_exhaustion && metrics.resource_exhaustion.count) || 0;
    
    if (avgDegradation < 50 && errorRate < 0.01 && exhaustionCount === 0) {
      summary += '  ✅ EXCELLENT: System is highly stable for long-term operation\n';
    } else if (avgDegradation < 100 && errorRate < 0.02 && exhaustionCount < 10) {
      summary += '  ✅ GOOD: System is stable with minor degradation\n';
    } else if (avgDegradation < 200 && errorRate < 0.05 && exhaustionCount < 50) {
      summary += '  ⚠️ FAIR: System shows moderate degradation over time\n';
    } else {
      summary += '  ❌ POOR: System has significant stability issues\n';
    }
    
    // Specific issues
    if (avgDegradation > 100) {
      summary += '  ⚠️ Possible memory leak detected (response time degradation)\n';
    }
    if ((metrics.connection_errors && metrics.connection_errors.count) > 50) {
      summary += '  ⚠️ Connection pooling issues detected\n';
    }
    if ((metrics.resource_exhaustion && metrics.resource_exhaustion.count) > 20) {
      summary += '  ⚠️ Resource management issues detected\n';
    }
    if (degradationPercentage > 30) {
      summary += `  ⚠️ Performance degraded by ${degradationPercentage.toFixed(1)}% over time\n`;
    }
  }
  
  summary += '\n=========================================\n';
  return summary;
}