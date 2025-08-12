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
  console.log("Starting test with config:", req.body);
  
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
      console.log("Cleaning up previous test:", currentTest.testId);
      
      // 프로세스가 아직 실행 중인지 확인
      if (currentTest.process && !currentTest.process.killed) {
        currentTest.process.kill("SIGTERM");
        
        // 프로세스가 종료될 때까지 대기 (최대 3초)
        let waitCount = 0;
        while (!currentTest.process.killed && waitCount < 30) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          waitCount++;
        }

        // 여전히 살아있으면 강제 종료
        if (!currentTest.process.killed) {
          console.log("Force killing k6 process");
          currentTest.process.kill("SIGKILL");
        }
      }

      // 임시 파일 삭제
      if (currentTest.scriptPath) {
        try {
          await fs.unlink(currentTest.scriptPath);
        } catch (err) {
          console.error("Failed to delete temp script:", err);
        }
      }

      // Dashboard가 활성화되어 있었다면 포트가 해제될 때까지 추가 대기
      if (currentTest.dashboardEnabled) {
        console.log("Waiting for dashboard port to be released...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      currentTest = null;
    } catch (error) {
      console.error("Error cleaning up previous test:", error);
      currentTest = null;
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
    targetUrl ||
    process.env.MOCK_SERVER_URL ||
    "http://host.docker.internal:3001"
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
        targetUrl ||
        process.env.MOCK_SERVER_URL ||
        "http://host.docker.internal:3001",
    };

    // Dashboard가 활성화된 경우에만 추가
    if (enableDashboard) {
      // 포트를 동적으로 할당하거나 고정 포트 사용
      const dashboardPort = process.env.K6_DASHBOARD_PORT || "5665";
      
      // web-dashboard output 설정을 파라미터로 전달
      k6Args.push("--out", `web-dashboard=host=0.0.0.0&port=${dashboardPort}`);

      // 환경변수도 설정 (백업)
      k6Env.K6_WEB_DASHBOARD = "true";
      k6Env.K6_WEB_DASHBOARD_HOST = "0.0.0.0";
      k6Env.K6_WEB_DASHBOARD_PORT = dashboardPort;
      
      console.log(`Dashboard will be available on port ${dashboardPort}`);
    }

    k6Args.push(scriptPath);

    console.log("Executing k6 with args:", k6Args);
    console.log("K6 environment TARGET_URL:", k6Env.TARGET_URL);
    console.log("Script path:", scriptPath);

    // k6 실행
    const k6Process = spawn("k6", k6Args, { env: k6Env });

    // k6 stdout/stderr 로깅
    k6Process.stdout.on('data', (data) => {
      console.log(`k6 stdout: ${data}`);
    });

    k6Process.stderr.on('data', (data) => {
      const errorMessage = data.toString();
      console.error(`k6 stderr: ${errorMessage}`);
      
      // Dashboard 포트 충돌 감지
      if (errorMessage.includes('bind: address already in use') && errorMessage.includes('5665')) {
        console.warn('Dashboard port 5665 is already in use. Test will continue without dashboard.');
      }
    });

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
    k6Process.on("exit", async (code, signal) => {
      console.log(`k6 process exited with code ${code} and signal ${signal}`);
      
      // 임시 파일 삭제 (커스텀 스크립트만)
      if (currentTest && currentTest.scriptPath) {
        try {
          await fs.unlink(currentTest.scriptPath);
          console.log("Temp script deleted:", currentTest.scriptPath);
        } catch (err) {
          console.error("Failed to delete temp script:", err);
        }
      }

      // Dashboard가 사용된 경우 포트 해제 대기
      if (currentTest && currentTest.dashboardEnabled) {
        console.log("Dashboard was enabled, waiting for port release...");
        await new Promise((resolve) => setTimeout(resolve, 1500));
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
    console.log("Stopping test:", currentTest.testId);
    const dashboardEnabled = currentTest.dashboardEnabled;
    
    // 프로세스가 아직 실행 중인지 확인
    if (currentTest.process && !currentTest.process.killed) {
      currentTest.process.kill("SIGTERM");

      // 프로세스가 종료될 때까지 대기 (최대 3초)
      let waitCount = 0;
      while (!currentTest.process.killed && waitCount < 30) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        waitCount++;
      }

      // 여전히 살아있으면 강제 종료
      if (!currentTest.process.killed) {
        console.log("Force killing k6 process");
        currentTest.process.kill("SIGKILL");
      }
    }

    // 임시 파일 삭제
    if (currentTest.scriptPath) {
      try {
        await fs.unlink(currentTest.scriptPath);
      } catch (err) {
        console.error("Failed to delete temp script:", err);
      }
    }

    // Dashboard가 활성화되어 있었다면 포트가 해제될 때까지 추가 대기
    if (dashboardEnabled) {
      console.log("Waiting for dashboard port to be released...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    currentTest = null;

    res.json({
      status: "stopped",
      message: "Test stopped successfully",
    });
  } catch (error) {
    console.error("Failed to stop test:", error);
    currentTest = null;
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
