const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const config = require("./config");

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

// 사용 가능한 시나리오 목록 (이제 파일 경로 대신 타입만 정의)
const availableScenarios = [
  "smoke",
  "load", 
  "stress",
  "spike",
  "soak",
  "breakpoint"
];

// Duration 문자열을 초 단위로 변환하는 함수
function parseDuration(duration) {
  const match = duration.match(/^(\d+)([smh])$/);
  if (!match) return 30; // 기본값 30초
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch(unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    default: return 30;
  }
}

// 초를 duration 문자열로 변환하는 함수
function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

// Executor 매핑 함수
function getExecutorConfig(scenario, vus, duration, iterations, executionMode) {
  // 사용자가 설정한 값 우선 적용
  const userVus = vus || 10;
  const userDuration = duration || "30s";
  const userIterations = iterations || 100;
  
  // Duration을 초 단위로 변환
  const totalSeconds = parseDuration(userDuration);
  
  // Ramp up/down 비율 (각각 15%)
  const rampUpSeconds = Math.floor(totalSeconds * 0.15);
  const rampDownSeconds = Math.floor(totalSeconds * 0.15);
  const steadySeconds = totalSeconds - rampUpSeconds - rampDownSeconds;
  
  // 시나리오별 executor 매핑
  const executorConfigs = {
    smoke: {
      // Smoke Test: 최소한의 부하로 빠른 검증 (ramp up/down 불필요)
      scenarios: {
        smoke_test: {
          executor: 'constant-vus',
          vus: userVus,
          duration: userDuration,
        },
      },
    },
    load: {
      // Load Test: 15% ramp up, 70% steady, 15% ramp down
      scenarios: {
        load_test: {
          executor: 'ramping-vus',
          startVUs: 0,
          stages: [
            { duration: formatDuration(rampUpSeconds), target: userVus }, // 15% 시간 동안 ramp up
            { duration: formatDuration(steadySeconds), target: userVus }, // 70% 시간 동안 유지
            { duration: formatDuration(rampDownSeconds), target: 0 }, // 15% 시간 동안 ramp down
          ],
        },
      },
    },
    stress: {
      // Stress Test: 단계적 증가 (총 시간을 6단계로 분할)
      scenarios: {
        stress_test: {
          executor: 'ramping-vus',
          startVUs: 0,
          stages: [
            { duration: formatDuration(Math.floor(totalSeconds * 0.1)), target: userVus }, // 10%: 1x 부하로 증가
            { duration: formatDuration(Math.floor(totalSeconds * 0.2)), target: userVus }, // 20%: 1x 부하 유지
            { duration: formatDuration(Math.floor(totalSeconds * 0.1)), target: userVus * 2 }, // 10%: 2x 부하로 증가
            { duration: formatDuration(Math.floor(totalSeconds * 0.2)), target: userVus * 2 }, // 20%: 2x 부하 유지
            { duration: formatDuration(Math.floor(totalSeconds * 0.1)), target: userVus * 3 }, // 10%: 3x 부하로 증가
            { duration: formatDuration(Math.floor(totalSeconds * 0.2)), target: userVus * 3 }, // 20%: 3x 부하 유지
            { duration: formatDuration(Math.floor(totalSeconds * 0.1)), target: 0 }, // 10%: 종료
          ],
        },
      },
    },
    soak: {
      // Soak Test: 장시간 일정 부하 (ramp up/down 불필요)
      scenarios: {
        soak_test: {
          executor: 'constant-vus',
          vus: userVus,
          duration: userDuration,
        },
      },
    },
    spike: {
      // Spike Test: 급격한 부하 증가 (총 시간 비율 배분)
      scenarios: {
        spike_test: {
          executor: 'ramping-vus',
          startVUs: Math.floor(userVus * 0.1),
          stages: [
            { duration: formatDuration(Math.floor(totalSeconds * 0.1)), target: Math.floor(userVus * 0.1) }, // 10%: 낮은 부하
            { duration: formatDuration(Math.floor(totalSeconds * 0.05)), target: userVus * 2 }, // 5%: 급격히 증가
            { duration: formatDuration(Math.floor(totalSeconds * 0.7)), target: userVus * 2 }, // 70%: 높은 부하 유지
            { duration: formatDuration(Math.floor(totalSeconds * 0.05)), target: Math.floor(userVus * 0.1) }, // 5%: 급격히 감소
            { duration: formatDuration(Math.floor(totalSeconds * 0.1)), target: 0 }, // 10%: 종료
          ],
        },
      },
    },
    breakpoint: {
      // Breakpoint Test: 시스템 한계점 찾기 (총 시간을 8단계로 분할)
      scenarios: {
        breakpoint_test: {
          executor: 'ramping-arrival-rate',
          startRate: 10,
          timeUnit: '1s',
          preAllocatedVUs: userVus,
          maxVUs: userVus * 10,
          stages: [
            { duration: formatDuration(Math.floor(totalSeconds * 0.1)), target: userVus * 5 }, // 10%: 첫 번째 레벨
            { duration: formatDuration(Math.floor(totalSeconds * 0.15)), target: userVus * 5 }, // 15%: 유지
            { duration: formatDuration(Math.floor(totalSeconds * 0.1)), target: userVus * 10 }, // 10%: 두 번째 레벨
            { duration: formatDuration(Math.floor(totalSeconds * 0.15)), target: userVus * 10 }, // 15%: 유지
            { duration: formatDuration(Math.floor(totalSeconds * 0.1)), target: userVus * 15 }, // 10%: 세 번째 레벨
            { duration: formatDuration(Math.floor(totalSeconds * 0.15)), target: userVus * 15 }, // 15%: 유지
            { duration: formatDuration(Math.floor(totalSeconds * 0.1)), target: userVus * 20 }, // 10%: 네 번째 레벨
            { duration: formatDuration(Math.floor(totalSeconds * 0.15)), target: userVus * 20 }, // 15%: 유지
          ],
        },
      },
    },
  };

  // 시나리오별 executor 반환
  if (executorConfigs[scenario]) {
    // executionMode가 iterations인 경우 shared-iterations executor 사용
    if (executionMode === 'iterations') {
      return {
        scenarios: {
          [`${scenario}_iterations`]: {
            executor: 'shared-iterations',
            vus: userVus,
            iterations: userIterations,
            maxDuration: userDuration,
          },
        },
      };
    }
    return executorConfigs[scenario];
  }

  // Custom 시나리오 또는 기본 설정
  if (executionMode === 'iterations') {
    return {
      scenarios: {
        custom_iterations: {
          executor: 'shared-iterations',
          vus: userVus,
          iterations: userIterations,
        },
      },
    };
  } else if (executionMode === 'hybrid') {
    return {
      scenarios: {
        hybrid_scenario: {
          executor: 'shared-iterations',
          vus: userVus,
          iterations: userIterations,
          maxDuration: userDuration,
        },
      },
    };
  } else {
    // Duration mode (default)
    return {
      scenarios: {
        custom_constant: {
          executor: 'constant-vus',
          vus: userVus,
          duration: userDuration,
        },
      },
    };
  }
}

// 테스트 시작 API
app.post("/api/test/start", async (req, res) => {
  console.log("Starting test with config:", req.body);
  
  const {
    vus = 10,
    duration = "30s",
    iterations,
    executionMode = "duration",
    targetUrl,
    urlPath = "",
    enableDashboard = false,
    scenario = "custom",
    httpMethod = "GET",
    requestBody = null,
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
    // 시나리오별 executor 설정 가져오기
    const executorConfig = getExecutorConfig(scenario, vus, duration, iterations, executionMode);
    const optionsConfig = JSON.stringify(executorConfig, null, 2);

    // 완전한 URL 구성 (baseUrl + path)
    const baseUrl = targetUrl || config.mockServerUrl;
    const fullUrl = urlPath ? `${baseUrl}${urlPath}` : baseUrl;

    // HTTP 메서드에 따른 스크립트 생성
    let httpRequest;
    if (httpMethod === "POST") {
      // POST 요청의 경우
      const bodyData = requestBody ? requestBody : '{"message": "test"}';
      httpRequest = `
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };
  const res = http.post('${fullUrl}', '${bodyData.replace(/'/g, "\\'")}', params);`;
    } else {
      // GET 요청의 경우 (기본값)
      httpRequest = `
  const res = http.get('${fullUrl}');`;
    }

    // 모든 시나리오에 대해 동일한 테스트 함수 사용
    const script = `
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = ${optionsConfig};

export default function () {${httpRequest}
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
    `;

    // 스크립트 파일 저장
    scriptPath = `/tmp/k6-test-${testId}.js`;
    await fs.writeFile(scriptPath, script);

    // K6 실행 옵션 설정
    const k6Args = ["run", "--out", `influxdb=${config.influxdbK6Url}`];

    const k6Env = {
      ...process.env,
      TARGET_URL: targetUrl || config.mockServerUrl,
    };

    // Dashboard가 활성화된 경우에만 추가
    if (enableDashboard) {
      // web-dashboard output 설정을 파라미터로 전달
      k6Args.push("--out", `web-dashboard=host=${config.k6DashboardHost}&port=${config.k6DashboardPort}`);

      // 환경변수도 설정 (백업)
      k6Env.K6_WEB_DASHBOARD = "true";
      k6Env.K6_WEB_DASHBOARD_HOST = config.k6DashboardHost;
      k6Env.K6_WEB_DASHBOARD_PORT = config.k6DashboardPort;
      
      console.log(`Dashboard will be available on port ${config.k6DashboardPort}`);
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
      scriptPath, // 모든 시나리오에 대해 임시 파일 사용
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
    scenarios: availableScenarios,
    description: {
      smoke: "Quick test to verify system is working (constant-vus executor)",
      load: "Standard load test with gradual ramp-up (ramping-vus executor)",
      stress: "Test system under heavy load with increasing stages (ramping-vus executor)",
      spike: "Sudden increase in traffic (ramping-vus executor)",
      soak: "Extended duration test for memory leaks (constant-vus executor)",
      breakpoint: "Find system breaking point (ramping-arrival-rate executor)",
    },
    executors: {
      smoke: "constant-vus",
      load: "ramping-vus",
      stress: "ramping-vus",
      spike: "ramping-vus",
      soak: "constant-vus",
      breakpoint: "ramping-arrival-rate",
      custom: "user-defined",
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
  res.json(config.getHealthInfo());
});

// Config 정보 엔드포인트 (디버깅용)
app.get("/config", (req, res) => {
  res.json(config.getConfigInfo());
});

const PORT = config.port;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`K6 Runner Service listening on port ${PORT}`);
  console.log(`Environment: ${config.environment}`);
});
