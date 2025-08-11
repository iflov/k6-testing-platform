const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json());

let currentTest = null;

// CORS 설정 (Control Panel에서 접근 가능하도록)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  next();
});

// 사용 가능한 시나리오 목록
const availableScenarios = {
  smoke: "k6-scripts/scenarios/smoke-test.js",
  load: "k6-scripts/scenarios/load-test.js",
  stress: "k6-scripts/scenarios/stress-test.js",
  spike: "k6-scripts/scenarios/spike-test.js",
  soak: "k6-scripts/scenarios/soak-test.js",
  breakpoint: "k6-scripts/scenarios/breakpoint-test.js",
  "simple-load": "k6-scripts/scenarios/simple-load-test.js",
};

// 테스트 시작 API
app.post("/api/test/start", async (req, res) => {
  const {
    vus = 10,
    duration = "30s",
    iterations,
    executionMode = "duration",
    targetUrl,
    enableDashboard = false,
    scenario = "custom",
  } = req.body;

  // 이전 테스트가 있으면 정리
  if (currentTest) {
    try {
      currentTest.process.kill("SIGTERM");
      // 프로세스가 종료될 때까지 잠시 대기
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 강제 종료가 필요한 경우
      if (currentTest && currentTest.process) {
        currentTest.process.kill("SIGKILL");
      }

      // 임시 파일 삭제
      if (currentTest.scriptPath) {
        try {
          await fs.unlink(currentTest.scriptPath);
        } catch (err) {
          console.error("Failed to delete temp script:", err);
        }
      }

      currentTest = null;
    } catch (error) {
      console.error("Error cleaning up previous test:", error);
    }
  }

  const testId = uuidv4();
  let scriptPath;

  try {
    // 시나리오 선택 또는 커스텀 스크립트 생성
    if (scenario !== "custom" && availableScenarios[scenario]) {
      // 기존 시나리오 파일을 래핑하여 사용자 옵션 적용
      let optionsConfig;

      if (executionMode === "iterations") {
        optionsConfig = `{
  vus: ${vus},
  iterations: ${iterations || 100},
}`;
      } else if (executionMode === "hybrid") {
        optionsConfig = `{
  scenarios: {
    hybrid_scenario: {
      executor: 'shared-iterations',
      vus: ${vus},
      iterations: ${iterations || 100},
      maxDuration: '${duration}',
    },
  },
}`;
      } else {
        // Duration mode (default)
        optionsConfig = `{
  vus: ${vus},
  duration: '${duration}',
}`;
      }

      // 기존 시나리오를 래핑하여 옵션 오버라이드
      const wrappedScript = `
import { default as scenarioTest } from '${availableScenarios[scenario]}';

// Override options with user settings
export const options = ${optionsConfig};

export default function() {
  // Call the original scenario test function
  return scenarioTest();
}
      `;

      scriptPath = `/tmp/k6-test-${testId}.js`;
      await fs.writeFile(scriptPath, wrappedScript);
    } else {
      // 커스텀 K6 스크립트 생성
      let optionsConfig;

      if (executionMode === "iterations") {
        optionsConfig = `{
  vus: ${vus},
  iterations: ${iterations || 100},
}`;
      } else if (executionMode === "hybrid") {
        // Hybrid mode: scenarios를 사용하여 duration과 iterations를 모두 설정
        optionsConfig = `{
  scenarios: {
    hybrid_scenario: {
      executor: 'shared-iterations',
      vus: ${vus},
      iterations: ${iterations || 100},
      maxDuration: '${duration}',
    },
  },
}`;
      } else {
        // Duration mode (default)
        optionsConfig = `{
  vus: ${vus},
  duration: '${duration}',
}`;
      }

      const script = `
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = ${optionsConfig};

export default function () {
  const res = http.get('${
    targetUrl || process.env.MOCK_SERVER_URL || "http://mock-server:3001"
  }');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
      `;

      // 스크립트 파일 저장
      scriptPath = `/tmp/k6-test-${testId}.js`;
      await fs.writeFile(scriptPath, script);
    }

    // K6 실행 옵션 설정
    const influxdbUrl = process.env.INFLUXDB_URL || "http://influxdb:8086";

    const k6Args = ["run", "--out", `influxdb=${influxdbUrl}/k6`];

    const k6Env = {
      ...process.env,
      TARGET_URL:
        targetUrl || process.env.MOCK_SERVER_URL || "http://mock-server:3001",
    };

    // Dashboard가 활성화된 경우에만 추가
    if (enableDashboard) {
      // web-dashboard output 설정을 파라미터로 전달
      k6Args.push("--out", "web-dashboard=host=0.0.0.0&port=5665");

      // 환경변수도 설정 (백업)
      k6Env.K6_WEB_DASHBOARD = "true";
      k6Env.K6_WEB_DASHBOARD_HOST = "0.0.0.0";
      k6Env.K6_WEB_DASHBOARD_PORT = "5665";
    }

    k6Args.push(scriptPath);

    // k6 실행
    const k6Process = spawn("k6", k6Args, { env: k6Env });

    currentTest = {
      process: k6Process,
      testId,
      startTime: new Date(),
      vus,
      duration,
      iterations,
      executionMode,
      targetUrl,
      scriptPath:
        scenario !== "custom" && availableScenarios[scenario]
          ? null
          : scriptPath, // 기존 시나리오는 삭제하지 않음
      scenario,
      dashboardEnabled: enableDashboard,
    };

    // 프로세스 종료 처리
    k6Process.on("exit", async (code) => {
      // 임시 파일 삭제 (커스텀 스크립트만)
      if (currentTest && currentTest.scriptPath) {
        try {
          await fs.unlink(currentTest.scriptPath);
        } catch (err) {
          console.error("Failed to delete temp script:", err);
        }
      }

      // Dashboard가 사용된 경우 포트 해제 대기
      if (currentTest && currentTest.dashboardEnabled) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      currentTest = null;
    });

    const response = {
      status: "started",
      testId,
      scenario,
      message: "Test started successfully",
    };

    if (enableDashboard) {
      response.dashboardUrl = "http://localhost:5665";
      response.note = "Dashboard is available while test is running";
    } else {
      response.note = "Dashboard disabled. Metrics are being sent to InfluxDB";
    }

    res.json(response);
  } catch (error) {
    console.error("Failed to start test:", error);
    res.status(500).json({
      error: "Failed to start test",
      details: error.message,
    });
  }
});

// 테스트 중지 API
app.post("/api/test/stop", async (req, res) => {
  if (!currentTest) {
    return res.status(400).json({ error: "No test running" });
  }

  try {
    currentTest.process.kill("SIGTERM");

    // 강제 종료 타임아웃
    setTimeout(() => {
      if (currentTest && currentTest.process) {
        currentTest.process.kill("SIGKILL");
      }
    }, 5000);

    res.json({
      status: "stopped",
      message: "Test stopped successfully",
    });
  } catch (error) {
    console.error("Failed to stop test:", error);
    res.status(500).json({
      error: "Failed to stop test",
      details: error.message,
    });
  }
});

// 사용 가능한 시나리오 목록 API
app.get("/api/scenarios", (req, res) => {
  res.json({
    scenarios: Object.keys(availableScenarios),
    description: {
      smoke: "Quick test to verify system is working",
      load: "Standard load test with gradual ramp-up",
      stress: "Test system under heavy load",
      spike: "Sudden increase in traffic",
      soak: "Extended duration test for memory leaks",
      breakpoint: "Find system breaking point",
      "simple-load": "Simple constant load test",
    },
  });
});

// 테스트 상태 확인 API
app.get("/api/test/status", (req, res) => {
  res.json({
    running: !!currentTest,
    details: currentTest
      ? {
          testId: currentTest.testId,
          startTime: currentTest.startTime,
          vus: currentTest.vus,
          duration: currentTest.duration,
          iterations: currentTest.iterations,
          executionMode: currentTest.executionMode,
          targetUrl: currentTest.targetUrl,
          scenario: currentTest.scenario,
        }
      : null,
  });
});

// 헬스 체크
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "k6-runner",
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`K6 Runner Service listening on port ${PORT}`);
});
