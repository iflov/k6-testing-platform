import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter, Gauge } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const spikeErrors = new Counter("spike_errors");
const recoveryTime = new Trend("recovery_time");
const spikeResponseTime = new Trend("spike_response_time");
const peakVUs = new Gauge("peak_vus");
const systemRecovered = new Rate("system_recovered");

// Spike Test: 갑작스러운 트래픽 증가 대응 능력 테스트
// 목적: 시스템이 갑작스러운 부하 증가와 감소를 얼마나 잘 처리하는지 확인
export const options = {
  stages: [
    { duration: "1m", target: 10 }, // 1분간 정상 부하
    { duration: "30s", target: 10 }, // 30초간 유지 (baseline)
    { duration: "10s", target: 200 }, // 10초만에 200 VU로 급증 (spike)
    { duration: "3m", target: 200 }, // 3분간 spike 수준 유지
    { duration: "10s", target: 10 }, // 10초만에 정상 수준으로 복귀
    { duration: "3m", target: 10 }, // 3분간 회복 관찰
    { duration: "10s", target: 300 }, // 두 번째 더 큰 spike
    { duration: "2m", target: 300 }, // 2분간 최대 spike 유지
    { duration: "10s", target: 10 }, // 급격한 복귀
    { duration: "2m", target: 10 }, // 최종 회복 확인
    { duration: "30s", target: 0 }, // 종료
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"], // 95%가 2초 이내 (spike 중에도)
    http_req_failed: ["rate<0.15"], // 에러율 15% 미만
    errors: ["rate<0.15"], // 커스텀 에러율 15% 미만
    recovery_time: ["avg<5000"], // 평균 회복 시간 5초 이내
    spike_response_time: ["p(90)<3000"], // spike 중 90%가 3초 이내
  },
};

const BASE_URL = __ENV.TARGET_URL || "http://mock-server:3001";

// Track spike periods and recovery
let spikeStartTime = null;
let recoveryStartTime = null;
let inSpike = false;
let recovering = false;
let baselinePerformance = null;

export default function () {
  const currentVUs = __VU;
  const currentTime = Date.now();

  // Track spike and recovery phases
  if (currentVUs > 50 && !inSpike) {
    spikeStartTime = currentTime;
    inSpike = true;
    recovering = false;
    peakVUs.add(currentVUs);
  } else if (currentVUs <= 20 && inSpike) {
    recoveryStartTime = currentTime;
    inSpike = false;
    recovering = true;
    const spikeDuration = currentTime - spikeStartTime;
  } else if (recovering && currentVUs <= 15) {
    const recoveryDuration = currentTime - recoveryStartTime;
    recoveryTime.add(recoveryDuration);
    recovering = false;
  }

  const scenario = Math.random();

  if (scenario < 0.4) {
    // 40% - Critical path operations (must work during spike)
    group("Critical Operations", () => {
      // Authentication check
      const authRes = http.get(`${BASE_URL}/api/auth/verify`, {
        headers: { Authorization: "Bearer test-token" },
        timeout: "3s",
      });

      const authSuccess = check(authRes, {
        "auth works during spike": (r) => r.status === 200 || r.status === 401,
        "auth response time < 1s": (r) => r.timings.duration < 1000,
      });

      if (!authSuccess && inSpike) {
        spikeErrors.add(1);
      }

      // Critical data fetch
      const userId = Math.floor(Math.random() * 100) + 1;
      const userRes = http.get(`${BASE_URL}/api/users/${userId}`, {
        timeout: "3s",
      });

      const userSuccess = check(userRes, {
        "user fetch during spike": (r) => r.status === 200,
        "user response acceptable": (r) => r.timings.duration < 2000,
      });

      errorRate.add(!authSuccess || !userSuccess);

      if (inSpike) {
        spikeResponseTime.add(authRes.timings.duration);
        spikeResponseTime.add(userRes.timings.duration);
      }
    });
  } else if (scenario < 0.65) {
    // 25% - Product browsing (should degrade gracefully)
    group("Product Browsing", () => {
      const batch = http.batch([
        ["GET", `${BASE_URL}/api/products?page=1&limit=10`],
        ["GET", `${BASE_URL}/api/products?featured=true`],
        ["GET", `${BASE_URL}/api/categories`],
      ]);

      let successCount = 0;
      batch.forEach((res) => {
        const success = check(res, {
          "browsing works": (r) => r.status === 200,
          "browsing speed": (r) => r.timings.duration < (inSpike ? 3000 : 1000),
        });
        if (success) successCount++;

        if (inSpike) {
          spikeResponseTime.add(res.timings.duration);
        }
      });

      const browsingSuccess = successCount >= 2; // At least 2 of 3 should work
      errorRate.add(!browsingSuccess);

      if (!browsingSuccess && inSpike) {
        spikeErrors.add(batch.length - successCount);
      }
    });
  } else if (scenario < 0.85) {
    // 20% - Order processing (may fail during spike)
    group("Order Processing", () => {
      const orderPayload = JSON.stringify({
        userId: Math.floor(Math.random() * 100) + 1,
        productIds: [1, 2, 3],
        quantities: [1, 1, 2],
        totalAmount: 299.99,
        priority: inSpike ? "high" : "normal",
      });

      const res = http.post(`${BASE_URL}/api/orders`, orderPayload, {
        headers: { "Content-Type": "application/json" },
        timeout: inSpike ? "5s" : "3s",
      });

      const success = check(res, {
        "order processed": (r) =>
          r.status === 201 || (inSpike && r.status === 503),
        "order response time": (r) =>
          r.timings.duration < (inSpike ? 5000 : 2000),
      });

      if (!success && inSpike) {
        spikeErrors.add(1);
      }

      errorRate.add(!success && res.status !== 503); // Don't count 503s as errors

      if (inSpike) {
        spikeResponseTime.add(res.timings.duration);
      }
    });
  } else if (scenario < 0.95) {
    // 10% - Search operations (lower priority)
    group("Search Operations", () => {
      const searchTerms = ["laptop", "phone", "tablet"];
      const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];

      const res = http.get(`${BASE_URL}/api/search?q=${term}`, {
        timeout: inSpike ? "4s" : "2s",
      });

      const success = check(res, {
        "search works": (r) =>
          r.status === 200 || (inSpike && r.status === 503),
        "search speed": (r) => r.timings.duration < (inSpike ? 4000 : 1500),
      });

      if (inSpike && res.status === 503) {
        // Search degraded gracefully during spike
        systemRecovered.add(1);
      }

      errorRate.add(!success && res.status !== 503);

      if (inSpike) {
        spikeResponseTime.add(res.timings.duration);
      }
    });
  } else {
    // 5% - Health monitoring
    group("Health Monitoring", () => {
      const res = http.get(`${BASE_URL}/health`, {
        timeout: "1s",
      });

      const success = check(res, {
        "health check OK": (r) => r.status === 200,
        "health check fast": (r) => r.timings.duration < 200,
      });

      if (!success && inSpike) {
        console.log(
          `Health check degraded during spike: ${res.timings.duration}ms`
        );
      }

      // Track baseline performance
      if (!inSpike && !recovering && success) {
        baselinePerformance = res.timings.duration;
      }

      // Check if system recovered to baseline
      if (
        recovering &&
        baselinePerformance &&
        res.timings.duration < baselinePerformance * 1.2
      ) {
        systemRecovered.add(1);
      }

      errorRate.add(!success);
    });
  }

  // Adaptive think time based on system state
  let thinkTime;
  if (inSpike) {
    thinkTime = 0.1 + Math.random() * 0.3; // Very short during spike
  } else if (recovering) {
    thinkTime = 0.5 + Math.random() * 0.5; // Moderate during recovery
  } else {
    thinkTime = 1 + Math.random(); // Normal operations
  }
  sleep(thinkTime);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    "/tmp/spike-test-summary.json": JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const { metrics } = data;
  let summary = "\n========== SPIKE TEST SUMMARY ==========\n";

  if (metrics) {
    summary += "\n⚡ Spike Test Results:\n";
    summary += `  • Peak VUs Reached: ${
      (metrics.peak_vus && metrics.peak_vus.value) ||
      (metrics.vus_max && metrics.vus_max.max) ||
      0
    }\n`;
    summary += `  • Spike Errors Count: ${
      (metrics.spike_errors && metrics.spike_errors.count) || 0
    }\n`;
    summary += `  • System Recovery Rate: ${
      metrics.system_recovered && metrics.system_recovered.rate
        ? (metrics.system_recovered.rate * 100).toFixed(2)
        : "0.00"
    }%\n`;

    summary += "\n⏱️ Response Times During Spike:\n";
    summary += `  • Average (Overall): ${
      metrics.http_req_duration && metrics.http_req_duration.avg
        ? metrics.http_req_duration.avg.toFixed(2)
        : "0"
    }ms\n`;
    summary += `  • Average (Spike): ${
      metrics.spike_response_time && metrics.spike_response_time.avg
        ? metrics.spike_response_time.avg.toFixed(2)
        : "0"
    }ms\n`;
    summary += `  • P90 (Spike): ${
      metrics.spike_response_time && metrics.spike_response_time["p(90)"]
        ? metrics.spike_response_time["p(90)"].toFixed(2)
        : "0"
    }ms\n`;
    summary += `  • P95 (Overall): ${
      metrics.http_req_duration && metrics.http_req_duration["p(95)"]
        ? metrics.http_req_duration["p(95)"].toFixed(2)
        : "0"
    }ms\n`;
    summary += `  • P99 (Overall): ${
      metrics.http_req_duration && metrics.http_req_duration["p(99)"]
        ? metrics.http_req_duration["p(99)"].toFixed(2)
        : "0"
    }ms\n`;
    summary += `  • Max Response Time: ${
      metrics.http_req_duration && metrics.http_req_duration.max
        ? metrics.http_req_duration.max.toFixed(2)
        : "0"
    }ms\n`;

    summary += "\n🔄 Recovery Metrics:\n";
    summary += `  • Average Recovery Time: ${
      metrics.recovery_time && metrics.recovery_time.avg
        ? metrics.recovery_time.avg.toFixed(2)
        : "0"
    }ms\n`;
    summary += `  • P95 Recovery Time: ${
      metrics.recovery_time && metrics.recovery_time["p(95)"]
        ? metrics.recovery_time["p(95)"].toFixed(2)
        : "0"
    }ms\n`;
    summary += `  • Max Recovery Time: ${
      metrics.recovery_time && metrics.recovery_time.max
        ? metrics.recovery_time.max.toFixed(2)
        : "0"
    }ms\n`;

    summary += "\n📈 Performance Under Load:\n";
    summary += `  • Total Requests: ${
      (metrics.http_reqs && metrics.http_reqs.count) || 0
    }\n`;
    summary += `  • Peak Request Rate: ${
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

    summary += "\n🌊 Spike Analysis:\n";
    const spikeErrorRate =
      metrics.spike_errors &&
      metrics.spike_errors.count &&
      metrics.http_reqs &&
      metrics.http_reqs.count
        ? metrics.spike_errors.count / metrics.http_reqs.count
        : 0;
    const recoveryRate =
      (metrics.system_recovered && metrics.system_recovered.rate) || 0;

    if (spikeErrorRate < 0.05 && recoveryRate > 0.8) {
      summary +=
        "  ✅ Excellent: System handled spikes very well with quick recovery\n";
    } else if (spikeErrorRate < 0.15 && recoveryRate > 0.6) {
      summary +=
        "  ⚠️ Good: System handled spikes with acceptable degradation\n";
    } else if (spikeErrorRate < 0.3 && recoveryRate > 0.4) {
      summary += "  ⚠️ Fair: System struggled but recovered from spikes\n";
    } else {
      summary += "  ❌ Poor: System failed to handle spikes effectively\n";
    }

    summary += `  • Spike Error Rate: ${(spikeErrorRate * 100).toFixed(2)}%\n`;
    summary += `  • Recovery Success Rate: ${(recoveryRate * 100).toFixed(
      2
    )}%\n`;
  }

  summary += "\n=========================================\n";
  return summary;
}
