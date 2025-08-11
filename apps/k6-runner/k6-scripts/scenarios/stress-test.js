import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const apiDuration = new Trend("api_duration");
const systemBreakingPoint = new Counter("breaking_point_reached");
const maxSuccessfulVUs = new Trend("max_successful_vus");

// Stress Test: 시스템의 한계점 찾기
// 목적: 시스템이 어느 시점에서 성능이 저하되거나 실패하는지 확인
export const options = {
  stages: [
    { duration: "2m", target: 50 }, // 2분간 50 VU로 증가
    { duration: "3m", target: 50 }, // 3분간 50 VU 유지
    { duration: "2m", target: 100 }, // 2분간 100 VU로 증가
    { duration: "3m", target: 100 }, // 3분간 100 VU 유지
    { duration: "2m", target: 200 }, // 2분간 200 VU로 증가
    { duration: "3m", target: 200 }, // 3분간 200 VU 유지
    { duration: "2m", target: 300 }, // 2분간 300 VU로 증가
    { duration: "3m", target: 300 }, // 3분간 300 VU 유지
    { duration: "5m", target: 0 }, // 5분간 0으로 감소 (recovery 확인)
  ],
  thresholds: {
    http_req_duration: ["p(90)<2000"], // 90%가 2초 이내 (느슨한 기준)
    http_req_failed: ["rate<0.20"], // 에러율 20% 미만 (stress 상황 고려)
    errors: ["rate<0.20"], // 커스텀 에러율 20% 미만
  },
};

const BASE_URL = __ENV.TARGET_URL || "http://mock-server:3001";

// Track breaking point
let breakingPointDetected = false;
let lastSuccessRate = 1.0;

export default function () {
  const currentVUs = __VU;
  const scenario = Math.random();

  if (scenario < 0.3) {
    // 30% - Heavy read operations (Product browsing)
    group("Heavy Read Operations", () => {
      const batch = http.batch([
        ["GET", `${BASE_URL}/api/products?page=1&limit=50`],
        ["GET", `${BASE_URL}/api/products?page=2&limit=50`],
        ["GET", `${BASE_URL}/api/products?page=3&limit=50`],
      ]);

      let successCount = 0;
      batch.forEach((res) => {
        const success = check(res, {
          "batch read status is 200": (r) => r.status === 200,
          "batch read response time < 3000ms": (r) => r.timings.duration < 3000,
        });
        if (success) successCount++;
        apiDuration.add(res.timings.duration);
      });

      const batchSuccess = successCount === batch.length;
      errorRate.add(!batchSuccess);

      // Detect breaking point
      const currentSuccessRate = successCount / batch.length;
      if (
        currentSuccessRate < 0.5 &&
        lastSuccessRate >= 0.5 &&
        !breakingPointDetected
      ) {
        systemBreakingPoint.add(1);
        breakingPointDetected = true;
      }
      lastSuccessRate = currentSuccessRate;
    });
  } else if (scenario < 0.5) {
    // 20% - Heavy write operations (Multiple orders)
    group("Heavy Write Operations", () => {
      const orders = [];
      for (let i = 0; i < 3; i++) {
        orders.push({
          userId: Math.floor(Math.random() * 1000) + 1,
          productIds: Array.from(
            { length: 5 },
            () => Math.floor(Math.random() * 100) + 1
          ),
          quantities: Array.from(
            { length: 5 },
            () => Math.floor(Math.random() * 3) + 1
          ),
          paymentMethod: "credit_card",
          totalAmount: Math.random() * 1000 + 100,
        });
      }

      let successCount = 0;
      orders.forEach((order) => {
        const res = http.post(`${BASE_URL}/api/orders`, JSON.stringify(order), {
          headers: { "Content-Type": "application/json" },
        });

        const success = check(res, {
          "heavy write status is 201": (r) => r.status === 201,
          "heavy write response time < 5000ms": (r) =>
            r.timings.duration < 5000,
        });

        if (success) successCount++;
        apiDuration.add(res.timings.duration);
      });

      const writeSuccess = successCount === orders.length;
      errorRate.add(!writeSuccess);

      if (writeSuccess) {
        maxSuccessfulVUs.add(currentVUs);
      }
    });
  } else if (scenario < 0.7) {
    // 20% - Complex queries (Search with filters)
    group("Complex Queries", () => {
      const complexQueries = [
        `/api/search?q=laptop&minPrice=500&maxPrice=2000&category=electronics&sort=price&limit=50`,
        `/api/products?category=electronics&inStock=true&minRating=4&sort=popularity&limit=100`,
        `/api/analytics/sales?startDate=2024-01-01&endDate=2024-12-31&groupBy=month`,
      ];

      complexQueries.forEach((query) => {
        const res = http.get(`${BASE_URL}${query}`);

        const success = check(res, {
          "complex query status is 200": (r) => r.status === 200,
          "complex query response time < 4000ms": (r) =>
            r.timings.duration < 4000,
        });

        errorRate.add(!success);
        apiDuration.add(res.timings.duration);
      });
    });
  } else if (scenario < 0.85) {
    // 15% - Database intensive operations
    group("Database Intensive", () => {
      // Simulate report generation or data export
      const res = http.get(
        `${BASE_URL}/api/reports/generate?type=sales&format=json`,
        {
          timeout: "10s",
        }
      );

      const success = check(res, {
        "report generation status is 200": (r) => r.status === 200,
        "report generation response time < 8000ms": (r) =>
          r.timings.duration < 8000,
      });

      errorRate.add(!success);
      apiDuration.add(res.timings.duration);
    });
  } else if (scenario < 0.95) {
    // 10% - Concurrent user operations
    group("Concurrent User Operations", () => {
      const userId = Math.floor(Math.random() * 100) + 1;

      // Simulate multiple operations for same user
      const batch = http.batch([
        ["GET", `${BASE_URL}/api/users/${userId}`],
        ["GET", `${BASE_URL}/api/users/${userId}/orders`],
        ["GET", `${BASE_URL}/api/users/${userId}/cart`],
        ["GET", `${BASE_URL}/api/users/${userId}/wishlist`],
      ]);

      batch.forEach((res) => {
        const success = check(res, {
          "concurrent operation status is 200": (r) => r.status === 200,
        });
        errorRate.add(!success);
        apiDuration.add(res.timings.duration);
      });
    });
  } else {
    // 5% - Health check under stress
    group("Health Check", () => {
      const res = http.get(`${BASE_URL}/health`, {
        timeout: "5s",
      });

      const success = check(res, {
        "health check under stress OK": (r) => r.status === 200,
        "health check under stress fast": (r) => r.timings.duration < 500,
      });

      errorRate.add(!success);

      // If health check fails, system is definitely stressed
      if (!success && currentVUs > 100) {
      }
    });
  }

  // Shorter think time under stress (0.5-1.5 seconds)
  sleep(Math.random() + 0.5);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    "/tmp/stress-test-summary.json": JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const { metrics } = data;
  let summary = "\n========== STRESS TEST SUMMARY ==========\n";

  if (metrics) {
    summary += "\n🔥 Stress Test Results:\n";
    summary += `  • Maximum VUs Reached: ${
      (metrics.vus_max && metrics.vus_max.max) || 0
    }\n`;
    summary += `  • Breaking Points Detected: ${
      (metrics.breaking_point_reached &&
        metrics.breaking_point_reached.count) ||
      0
    }\n`;
    summary += `  • Max Successful VUs: ${
      (metrics.max_successful_vus && metrics.max_successful_vus.max) || "N/A"
    }\n`;

    summary += "\n⏱️ Response Times Under Stress:\n";
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
    summary += `  • P90: ${
      metrics.http_req_duration && metrics.http_req_duration["p(90)"]
        ? metrics.http_req_duration["p(90)"].toFixed(2)
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

    summary += "\n📊 Performance Degradation:\n";
    summary += `  • Total Requests: ${
      (metrics.http_reqs && metrics.http_reqs.count) || 0
    }\n`;
    summary += `  • Request Rate: ${
      metrics.http_reqs && metrics.http_reqs.rate
        ? metrics.http_reqs.rate.toFixed(2)
        : "0"
    } req/s\n`;
    summary += `  • Failed Requests: ${
      (metrics.http_req_failed && metrics.http_req_failed.passes) || 0
    }\n`;
    summary += `  • Error Rate: ${
      metrics.errors && metrics.errors.rate
        ? (metrics.errors.rate * 100).toFixed(2)
        : "0.00"
    }%\n`;

    summary += "\n✅ Success Metrics:\n";
    summary += `  • Checks Passed: ${
      (metrics.checks && metrics.checks.passes) || 0
    }\n`;
    summary += `  • Checks Failed: ${
      (metrics.checks && metrics.checks.fails) || 0
    }\n`;
    const passes = (metrics.checks && metrics.checks.passes) || 0;
    const fails = (metrics.checks && metrics.checks.fails) || 0;
    const successRate =
      passes + fails > 0
        ? ((passes / (passes + fails)) * 100).toFixed(2)
        : "0.00";
    summary += `  • Success Rate: ${successRate}%\n`;

    summary += "\n💾 Resource Usage:\n";
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
    summary += `  • Total Iterations: ${
      (metrics.iterations && metrics.iterations.count) || 0
    }\n`;

    // Stress analysis
    const errorRate = (metrics.errors && metrics.errors.rate) || 0;
    const p99Duration =
      (metrics.http_req_duration && metrics.http_req_duration["p(99)"]) || 0;

    summary += "\n🎯 Stress Analysis:\n";
    if (errorRate < 0.05 && p99Duration < 2000) {
      summary += "  ✅ System handled stress well\n";
    } else if (errorRate < 0.15 && p99Duration < 5000) {
      summary += "  ⚠️ System showed signs of stress but remained functional\n";
    } else {
      summary += "  ❌ System severely degraded under stress\n";
    }
  }

  summary += "\n=========================================\n";
  return summary;
}
