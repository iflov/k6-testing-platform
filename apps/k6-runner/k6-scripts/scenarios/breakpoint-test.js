import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter, Gauge } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const successRate = new Rate("success_rate");
const responseTime = new Trend("response_time_trend");
const maxVUsReached = new Gauge("max_vus_reached");
const breakpointVUs = new Gauge("breakpoint_vus");
const totalRequests = new Counter("total_requests");

// Breakpoint Test: 시스템이 처리할 수 있는 최대 부하 찾기
// 목적: 시스템이 정상 작동하는 최대 동시 사용자 수 확인
export const options = {
  stages: [
    { duration: "2m", target: 100 }, // 2분간 100 VU로 증가
    { duration: "2m", target: 200 }, // 2분간 200 VU로 증가
    { duration: "2m", target: 300 }, // 2분간 300 VU로 증가
    { duration: "2m", target: 400 }, // 2분간 400 VU로 증가
    { duration: "2m", target: 500 }, // 2분간 500 VU로 증가
    { duration: "2m", target: 600 }, // 2분간 600 VU로 증가
    { duration: "2m", target: 700 }, // 2분간 700 VU로 증가
    { duration: "2m", target: 800 }, // 2분간 800 VU로 증가
    { duration: "2m", target: 900 }, // 2분간 900 VU로 증가
    { duration: "2m", target: 1000 }, // 2분간 1000 VU로 증가
  ],
  thresholds: {
    http_req_duration: ["p(95)<5000"], // 95%가 5초 이내 (느슨한 기준)
    http_req_failed: ["rate<0.50"], // 에러율 50% 미만 (breakpoint 찾기 위함)
  },
};

const BASE_URL = __ENV.TARGET_URL || "http://mock-server:3001";

// Track breakpoint
let breakpointFound = false;
let lastSuccessRate = 1.0;
let consecutiveFailures = 0;

export default function () {
  const currentVUs = __VU;

  // Simple HTTP request - 범용적인 엔드포인트
  const endpoint = __ENV.ENDPOINT || "/";
  const res = http.get(`${BASE_URL}${endpoint}`, {
    timeout: "10s",
  });

  // Check response
  const success = check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 5s": (r) => r.timings.duration < 5000,
    "no timeout": (r) => r.status !== 0,
  });

  // Update metrics
  totalRequests.add(1);
  errorRate.add(!success);
  successRate.add(success ? 1 : 0);
  responseTime.add(res.timings.duration);
  maxVUsReached.add(currentVUs);

  // Detect breakpoint (when success rate drops below 80%)
  if (success) {
    consecutiveFailures = 0;
  } else {
    consecutiveFailures++;
  }

  // If we have 10 consecutive failures, we've likely hit the breakpoint
  if (consecutiveFailures >= 10 && !breakpointFound) {
    breakpointFound = true;
    breakpointVUs.add(currentVUs);
  }

  // Think time - shorter under higher load
  const thinkTime = Math.max(0.1, 1 - currentVUs / 1000);
  sleep(thinkTime);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    "/tmp/breakpoint-test-summary.json": JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const { metrics } = data;
  let summary = "\n========== BREAKPOINT TEST SUMMARY ==========\n";

  if (metrics) {
    summary += "\n🎯 Breakpoint Analysis:\n";
    summary += `  • Maximum VUs Tested: ${
      (metrics.vus_max && metrics.vus_max.max) || 0
    }\n`;
    summary += `  • Breakpoint VUs: ${
      (metrics.breakpoint_vus && metrics.breakpoint_vus.value) || "Not reached"
    }\n`;
    summary += `  • Max Successful VUs: ${
      (metrics.max_vus_reached && metrics.max_vus_reached.value) || 0
    }\n`;

    summary += "\n⏱️ Response Times:\n";
    summary += `  • Average: ${
      metrics.http_req_duration && metrics.http_req_duration.avg
        ? metrics.http_req_duration.avg.toFixed(2)
        : "0"
    }ms\n`;
    summary += `  • Median: ${
      metrics.http_req_duration && metrics.http_req_duration.med
        ? metrics.http_req_duration.med.toFixed(2)
        : "0"
    }ms\n`;
    summary += `  • P95: ${
      metrics.http_req_duration && metrics.http_req_duration["p(95)"]
        ? metrics.http_req_duration["p(95)"].toFixed(2)
        : "0"
    }ms\n`;
    summary += `  • P99: ${
      metrics.http_req_duration && metrics.http_req_duration["p(99)"]
        ? metrics.http_req_duration["p(99)"].toFixed(2)
        : "0"
    }ms\n`;
    summary += `  • Max: ${
      metrics.http_req_duration && metrics.http_req_duration.max
        ? metrics.http_req_duration.max.toFixed(2)
        : "0"
    }ms\n`;

    summary += "\n📊 Load Capacity:\n";
    summary += `  • Total Requests: ${
      (metrics.total_requests && metrics.total_requests.count) || 0
    }\n`;
    summary += `  • Request Rate: ${
      metrics.http_reqs && metrics.http_reqs.rate
        ? metrics.http_reqs.rate.toFixed(2)
        : "0"
    } req/s\n`;
    summary += `  • Success Rate: ${
      metrics.success_rate && metrics.success_rate.rate
        ? (metrics.success_rate.rate * 100).toFixed(2)
        : "0.00"
    }%\n`;
    summary += `  • Error Rate: ${
      metrics.errors && metrics.errors.rate
        ? (metrics.errors.rate * 100).toFixed(2)
        : "0.00"
    }%\n`;
    summary += `  • Failed Requests: ${
      (metrics.http_req_failed && metrics.http_req_failed.passes) || 0
    }\n`;

    summary += "\n💾 Data Transfer:\n";
    summary += `  • Data Received: ${
      metrics.data_received && metrics.data_received.count
        ? (metrics.data_received.count / 1024 / 1024).toFixed(2)
        : "0.00"
    } MB\n`;
    summary += `  • Data Sent: ${
      metrics.data_sent && metrics.data_sent.count
        ? (metrics.data_sent.count / 1024 / 1024).toFixed(2)
        : "0.00"
    } MB\n`;

    // Capacity assessment
    const errorRate = (metrics.errors && metrics.errors.rate) || 0;
    const avgResponseTime =
      (metrics.http_req_duration && metrics.http_req_duration.avg) || 0;
    const breakpointVUs =
      (metrics.breakpoint_vus && metrics.breakpoint_vus.value) || 0;

    summary += "\n🏁 Capacity Assessment:\n";
    if (breakpointVUs > 0) {
      summary += `  ⚠️ System breakpoint found at ${breakpointVUs} concurrent users\n`;
      summary += `  • Recommended max load: ${Math.floor(
        breakpointVUs * 0.8
      )} VUs (80% of breakpoint)\n`;
      summary += `  • Safe operating range: ${Math.floor(
        breakpointVUs * 0.6
      )} VUs (60% of breakpoint)\n`;
    } else if (errorRate < 0.05) {
      summary += "  ✅ System handled maximum test load successfully\n";
      summary += `  • Can safely handle ${
        (metrics.vus_max && metrics.vus_max.max) || 0
      } concurrent users\n`;
    } else {
      summary += "  ⚠️ System showed degradation but no clear breakpoint\n";
      summary += `  • Review response times and error patterns for capacity planning\n`;
    }
  }

  summary += "\n===========================================\n";
  return summary;
}
