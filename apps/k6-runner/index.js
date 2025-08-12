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
  // 최소 1초 보장 (너무 짧은 duration에서 0초가 되는 것 방지)
  // totalSeconds가 10초 미만이면 최소 1초, 그 이상이면 15% 적용
  const rampUpSeconds = totalSeconds < 10 ? Math.max(1, Math.floor(totalSeconds * 0.15)) : Math.floor(totalSeconds * 0.15);
  const rampDownSeconds = totalSeconds < 10 ? Math.max(1, Math.floor(totalSeconds * 0.15)) : Math.floor(totalSeconds * 0.15);
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
          startVUs: 1,
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
          startVUs: 1,
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

// 포트가 사용 중인지 확인하는 함수
async function isPortInUse(port) {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    const result = await execAsync(`lsof -i :${port}`);
    return result.stdout.length > 0;
  } catch (error) {
    // lsof 명령이 실패하면 포트가 사용되지 않는 것으로 간주
    return false;
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

  // 이전 테스트가 있으면 에러 반환 (동시에 여러 테스트 실행 방지)
  if (currentTest) {
    console.log("Test already running:", currentTest.testId);
    return res.status(400).json({
      error: "Another test is already running",
      message: "Please stop the current test before starting a new one",
      currentTestId: currentTest.testId,
      startTime: currentTest.startTime,
    });
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

    // Dashboard 활성화 여부 결정
    let dashboardActuallyEnabled = false;
    
    if (enableDashboard) {
      // 포트가 사용 중인지 확인
      const portInUse = await isPortInUse(config.k6DashboardPort);
      
      if (portInUse) {
        console.warn(`Dashboard port ${config.k6DashboardPort} is already in use. Running test without dashboard.`);
      } else {
        // 포트가 사용 가능한 경우에만 대시보드 활성화
        dashboardActuallyEnabled = true;
        
        // web-dashboard output 설정을 파라미터로 전달
        k6Args.push("--out", `web-dashboard=host=${config.k6DashboardHost}&port=${config.k6DashboardPort}`);

        // 환경변수도 설정 (백업)
        k6Env.K6_WEB_DASHBOARD = "true";
        k6Env.K6_WEB_DASHBOARD_HOST = config.k6DashboardHost;
        k6Env.K6_WEB_DASHBOARD_PORT = config.k6DashboardPort;
        
        console.log(`Dashboard will be available on port ${config.k6DashboardPort}`);
      }
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
    
    // duration을 기반으로 최대 실행 시간 설정 (duration + 30초 여유)
    const durationInSeconds = parseDuration(duration);
    const maxExecutionTime = (durationInSeconds + 30) * 1000; // 밀리초로 변환
    
    // 타임아웃 설정: 테스트가 예상 시간보다 오래 실행되면 강제 종료
    const timeoutId = setTimeout(() => {
      if (currentTest && currentTest.process === k6Process && !k6Process.killed) {
        console.warn(`Test ${testId} exceeded maximum execution time (${maxExecutionTime/1000}s), forcing termination`);
        k6Process.kill("SIGTERM");
        
        // 5초 후에도 종료되지 않으면 SIGKILL
        setTimeout(() => {
          if (!k6Process.killed) {
            console.error(`Test ${testId} not responding to SIGTERM, forcing SIGKILL`);
            k6Process.kill("SIGKILL");
          }
        }, 5000);
      }
    }, maxExecutionTime);
    
    // 프로세스가 정상 종료되면 타임아웃 취소
    currentTest.timeoutId = timeoutId;

    // 프로세스 종료 처리
    k6Process.on("exit", async (code, signal) => {
      console.log(`k6 process exited with code ${code} and signal ${signal}`);
      
      // 타임아웃 취소
      if (currentTest && currentTest.timeoutId) {
        clearTimeout(currentTest.timeoutId);
      }
      
      // 약간의 지연을 추가하여 k6가 완전히 종료되도록 보장
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // currentTest가 현재 프로세스와 일치하는 경우에만 정리
      // (stop API에서 이미 정리된 경우 방지)
      if (currentTest && currentTest.process === k6Process) {
        // 임시 파일 삭제 (아직 존재하는 경우에만)
        if (currentTest.scriptPath) {
          try {
            // 파일이 존재하는지 먼저 확인
            await fs.access(currentTest.scriptPath);
            await fs.unlink(currentTest.scriptPath);
            console.log("Temp script deleted:", currentTest.scriptPath);
          } catch (err) {
            // 파일이 이미 삭제되었거나 접근할 수 없는 경우는 무시
            if (err.code !== 'ENOENT') {
              console.error("Failed to delete temp script:", err);
            }
          }
        }

        // Dashboard가 사용된 경우 포트 해제 대기
        if (currentTest.dashboardEnabled) {
          console.log("Dashboard was enabled, waiting for port release...");
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        currentTest = null;
      }
    });

    const response = {
      status: "started",
      testId,
      scenario,
      message: "Test started successfully",
      dashboardEnabled: dashboardActuallyEnabled,
    };

    if (dashboardActuallyEnabled) {
      response.dashboardUrl = `http://${config.k6DashboardHost}:${config.k6DashboardPort}`;
      response.note = "Dashboard is available while test is running";
    } else if (enableDashboard && !dashboardActuallyEnabled) {
      response.note = `Dashboard was requested but port ${config.k6DashboardPort} is already in use. Test running without dashboard.`;
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
    
    // 타임아웃 취소
    if (currentTest.timeoutId) {
      clearTimeout(currentTest.timeoutId);
    }
    
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

    // 임시 파일 삭제 (파일이 존재하는 경우에만)
    if (currentTest.scriptPath) {
      try {
        // 파일이 존재하는지 먼저 확인
        await fs.access(currentTest.scriptPath);
        await fs.unlink(currentTest.scriptPath);
        console.log("Temp script deleted by stop API:", currentTest.scriptPath);
      } catch (err) {
        // 파일이 이미 삭제되었거나 접근할 수 없는 경우는 무시
        if (err.code !== 'ENOENT') {
          console.error("Failed to delete temp script:", err);
        }
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
