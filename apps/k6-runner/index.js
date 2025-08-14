const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { exec } = require('child_process');
const { promisify } = require('util');
const config = require("./config");
const { getScenarioConfig, calculateStages } = require("./scenario-config");

const app = express();
app.use(express.json());

let currentTest = null;
let testProgress = {}; // Store progress for each test

// Constants
const CONSTANTS = {
  DEFAULT_VUS: 10,
  DEFAULT_DURATION: '30s',
  DEFAULT_ITERATIONS: 100,
  DEFAULT_EXECUTION_MODE: 'duration',
  DEFAULT_HTTP_METHOD: 'GET',
  DEFAULT_ERROR_RATE: 10,
  DEFAULT_ERROR_CODES: '400,500,503',
  PROCESS_TIMEOUT_BUFFER: 30, // seconds
  FORCE_KILL_TIMEOUT: 5000, // ms
  PORT_RELEASE_WAIT: 1500, // ms
  PROCESS_EXIT_WAIT: 500, // ms
  PROCESS_KILL_WAIT: 100, // ms
  MAX_KILL_ATTEMPTS: 30,
  LOG_BUFFER_SIZE: 1000, // chars
  SCRIPT_PREVIEW_SIZE: 500 // chars
};

// HTTP Status Codes
const HTTP_STATUS = {
  SUCCESS: { 
    GET: [200], 
    POST: [200, 201], 
    PUT: [200, 204], 
    PATCH: [200, 204], 
    DELETE: [200, 202, 204] 
  },
  METHODS_WITH_BODY: ['POST', 'PUT', 'PATCH']
};

// CORS Middleware
const corsMiddleware = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  next();
};

app.use(corsMiddleware);

// Available scenarios
const availableScenarios = [
  "smoke",
  "load", 
  "stress",
  "spike",
  "soak",
  "breakpoint"
];

// Utility Functions
const utils = {
  parseDuration(duration) {
    const match = duration.match(/^(\d+)([smh])$/);
    if (!match) return 30;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    const unitMultipliers = { s: 1, m: 60, h: 3600 };
    
    return value * (unitMultipliers[unit] || 1);
  },

  formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  },

  async isPortInUse(port) {
    const execAsync = promisify(exec);
    try {
      const result = await execAsync(`lsof -i :${port}`);
      return result.stdout.length > 0;
    } catch (error) {
      return false;
    }
  },

  async safeDeleteFile(filePath) {
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      console.log("File deleted:", filePath);
      return true;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error("Failed to delete file:", err);
      }
      return false;
    }
  },

  escapeScriptContent(content) {
    return content
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$');
  }
};

// K6 Configuration Builders
const k6Config = {
  createBaseTags(testId, scenario) {
    return {
      testId,
      scenario,
      timestamp: new Date().toISOString()
    };
  },

  createIterationsScenario(scenario, vus, iterations, duration) {
    return {
      [`${scenario}_iterations`]: {
        executor: 'shared-iterations',
        vus,
        iterations,
        maxDuration: duration,
      }
    };
  },

  createRampingScenario(scenario, vus, stages) {
    return {
      [`${scenario}_test`]: {
        executor: 'ramping-vus',
        startVUs: scenario === 'spike' ? Math.floor(vus * 0.1) : 1,
        stages: stages.map(stage => ({
          duration: stage.duration,
          target: stage.target,
        })),
      }
    };
  },

  createConstantScenario(scenario, vus, duration) {
    return {
      [`${scenario}_test`]: {
        executor: 'constant-vus',
        vus,
        duration,
      }
    };
  },

  getExecutorConfig(scenario, vus, duration, iterations, executionMode, testId) {
    const scenarioConfig = getScenarioConfig(scenario);
    
    const userVus = vus || scenarioConfig.defaultVus || CONSTANTS.DEFAULT_VUS;
    const userDuration = duration || scenarioConfig.defaultDuration || CONSTANTS.DEFAULT_DURATION;
    const userIterations = iterations || scenarioConfig.defaultIterations || CONSTANTS.DEFAULT_ITERATIONS;
    
    const totalSeconds = utils.parseDuration(userDuration);
    const stages = scenarioConfig.useStages ? 
      calculateStages(scenarioConfig.rampPattern, userVus, totalSeconds) : null;
    
    const baseOptions = {
      tags: this.createBaseTags(testId, scenario)
    };
    
    let scenarios;
    
    if (executionMode === 'iterations' || executionMode === 'hybrid') {
      scenarios = this.createIterationsScenario(scenario, userVus, userIterations, userDuration);
    } else if (stages) {
      scenarios = this.createRampingScenario(scenario, userVus, stages);
    } else {
      scenarios = this.createConstantScenario(scenario, userVus, userDuration);
    }
    
    return { ...baseOptions, scenarios };
  }
};

// Script Generation
const scriptGenerator = {
  buildUrl(baseUrl, urlPath, enableErrorSimulation, errorRate, errorTypes) {
    let fullUrl = urlPath ? `${baseUrl}${urlPath}` : baseUrl;
    
    // Check if it's mock server (either by 'mock-server' or port 3001)
    const isMockServer = baseUrl.includes('mock-server') || baseUrl.includes(':3001');
    
    if (enableErrorSimulation) {
      if (isMockServer) {
        const enabledErrorTypes = Object.entries(errorTypes)
          .filter(([code, enabled]) => enabled)
          .map(([code]) => code);
        
        const statusCodes = enabledErrorTypes.length > 0 
          ? enabledErrorTypes.join(',')
          : CONSTANTS.DEFAULT_ERROR_CODES;
        
        // Add chaos parameters to the original endpoint URL
        const separator = fullUrl.includes('?') ? '&' : '?';
        fullUrl = `${fullUrl}${separator}chaos=true&errorRate=${errorRate / 100}&statusCodes=${statusCodes}`;
        
        console.log(`[Error Simulation] Enabled with ${errorRate}% error rate`);
        console.log(`[Error Simulation] URL: ${fullUrl}`);
        console.log(`[Error Simulation] Will apply to endpoint: ${urlPath}`);
      } else {
        console.warn('[Error Simulation] Warning: Error simulation is only available with Mock Server (port 3001)');
        console.warn('[Error Simulation] Current URL:', baseUrl);
        console.warn('[Error Simulation] Error simulation will be ignored for this test');
      }
    }
    
    return fullUrl;
  },

  createHttpRequest(httpMethod, fullUrl, requestBody) {
    const method = httpMethod.toLowerCase();
    
    if (HTTP_STATUS.METHODS_WITH_BODY.includes(httpMethod)) {
      let bodyData = requestBody || '{"message": "test"}';
      
      try {
        const parsedBody = JSON.parse(bodyData);
        bodyData = JSON.stringify(parsedBody);
      } catch (e) {
        console.log("Invalid JSON in request body, using as-is:", bodyData);
      }
      
      const escapedBody = utils.escapeScriptContent(bodyData);
      
      return `
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };
  const res = http.${method}('${fullUrl}', \`${escapedBody}\`, params);`;
    } else if (httpMethod === "DELETE") {
      return `
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };
  const res = http.del('${fullUrl}', null, params);`;
    } else {
      return `
  const res = http.get('${fullUrl}');`;
    }
  },

  createSuccessCheck(httpMethod) {
    const statusCodes = HTTP_STATUS.SUCCESS[httpMethod] || HTTP_STATUS.SUCCESS.GET;
    const statusDescription = statusCodes.join('/');
    
    if (httpMethod === "POST") {
      return `
  // Response status logging for debugging
  if (res.status !== 200 && res.status !== 201) {
    console.log(\`POST request failed: Status=\${res.status}, Body=\${res.body}\`);
  }
  
  check(res, {
    'status is successful (${statusDescription})': (r) => ${statusCodes.map(code => `r.status === ${code}`).join(' || ')},
  });`;
    }
    
    return `
  check(res, {
    'status is successful (${statusDescription})': (r) => ${statusCodes.map(code => `r.status === ${code}`).join(' || ')},
  });`;
  },

  generateScript(config, executorConfig) {
    const { fullUrl, httpMethod, requestBody } = config;
    const optionsConfig = JSON.stringify(executorConfig, null, 2);
    const httpRequest = this.createHttpRequest(httpMethod, fullUrl, requestBody);
    const successCheck = this.createSuccessCheck(httpMethod);
    
    return `
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = ${optionsConfig};

export default function () {${httpRequest}${successCheck}
  sleep(1);
}
    `;
  }
};

// Test Management
const testManager = {
  async setupTimeout(k6Process, testId, duration) {
    const durationInSeconds = utils.parseDuration(duration);
    const maxExecutionTime = (durationInSeconds + CONSTANTS.PROCESS_TIMEOUT_BUFFER) * 1000;
    
    return setTimeout(() => {
      if (currentTest && currentTest.process === k6Process && !k6Process.killed) {
        console.warn(`Test ${testId} exceeded maximum execution time (${maxExecutionTime/1000}s), forcing termination`);
        k6Process.kill("SIGTERM");
        
        setTimeout(() => {
          if (!k6Process.killed) {
            console.error(`Test ${testId} not responding to SIGTERM, forcing SIGKILL`);
            k6Process.kill("SIGKILL");
          }
        }, CONSTANTS.FORCE_KILL_TIMEOUT);
      }
    }, maxExecutionTime);
  },

  async cleanupTest(test) {
    if (test.timeoutId) {
      clearTimeout(test.timeoutId);
    }
    
    if (test.scriptPath) {
      await utils.safeDeleteFile(test.scriptPath);
    }
    
    if (test.dashboardEnabled) {
      console.log("Dashboard was enabled, waiting for port release...");
      await new Promise(resolve => setTimeout(resolve, CONSTANTS.PORT_RELEASE_WAIT));
    }
  },

  async setupDashboard(enableDashboard, k6Args, k6Env) {
    if (!enableDashboard) return false;
    
    const portInUse = await utils.isPortInUse(config.k6DashboardPort);
    
    if (portInUse) {
      console.warn(`Dashboard port ${config.k6DashboardPort} is already in use. Running test without dashboard.`);
      return false;
    }
    
    k6Args.push("--out", `web-dashboard=host=${config.k6DashboardHost}&port=${config.k6DashboardPort}`);
    
    k6Env.K6_WEB_DASHBOARD = "true";
    k6Env.K6_WEB_DASHBOARD_HOST = config.k6DashboardHost;
    k6Env.K6_WEB_DASHBOARD_PORT = config.k6DashboardPort;
    
    console.log(`Dashboard will be available on port ${config.k6DashboardPort}`);
    return true;
  },

  parseK6Progress(output, testId) {
    // K6 progress output pattern examples:
    // running (05m00.0s), 000/100 VUs, 26 complete and 0 interrupted iterations
    // running (1m30.0s), 00/10 VUs, 5 complete and 0 interrupted iterations
    // ✓ status is successful
    
    // Parse running time and VUs
    const runningPattern = /running \(([0-9hms.]+)\), (\d+)\/(\d+) VUs/;
    const runningMatch = output.match(runningPattern);
    
    // Parse iterations
    const iterationPattern = /(\d+) complete and (\d+) interrupted iterations/;
    const iterationMatch = output.match(iterationPattern);
    
    // Parse percentage from progress bar if present
    const percentPattern = /\[(=*)>?\s*\]\s*(\d+)%/;
    const percentMatch = output.match(percentPattern);
    
    // Alternative percentage pattern (some k6 versions)
    const altPercentPattern = /(\d+)%\s+\[/;
    const altPercentMatch = output.match(altPercentPattern);
    
    if (runningMatch || iterationMatch || percentMatch || altPercentMatch) {
      if (!testProgress[testId]) {
        testProgress[testId] = {
          startTime: new Date(),
          currentTime: '0s',
          currentVUs: 0,
          totalVUs: 0,
          completedIterations: 0,
          interruptedIterations: 0,
          percentage: 0,
          status: 'running'
        };
      }
      
      if (runningMatch) {
        testProgress[testId].currentTime = runningMatch[1];
        testProgress[testId].currentVUs = parseInt(runningMatch[2]);
        testProgress[testId].totalVUs = parseInt(runningMatch[3]);
      }
      
      if (iterationMatch) {
        testProgress[testId].completedIterations = parseInt(iterationMatch[1]);
        testProgress[testId].interruptedIterations = parseInt(iterationMatch[2]);
      }
      
      if (percentMatch) {
        testProgress[testId].percentage = parseInt(percentMatch[2]);
      } else if (altPercentMatch) {
        testProgress[testId].percentage = parseInt(altPercentMatch[1]);
      }
      
      // Estimate percentage based on time if not explicitly provided
      if (!percentMatch && !altPercentMatch && currentTest && currentTest.duration) {
        const durationSeconds = utils.parseDuration(currentTest.duration);
        const currentSeconds = this.parseTimeString(testProgress[testId].currentTime);
        if (durationSeconds > 0) {
          testProgress[testId].percentage = Math.min(100, Math.round((currentSeconds / durationSeconds) * 100));
        }
      }
      
      console.log(`Test ${testId} progress:`, testProgress[testId]);
    }
    
    // Check for completion
    if (output.includes('✓') || output.includes('✗') || output.includes('done')) {
      if (testProgress[testId]) {
        testProgress[testId].status = 'completed';
        testProgress[testId].percentage = 100;
      }
    }
  },
  
  parseTimeString(timeStr) {
    // Parse time strings like "5m30.0s", "30s", "1h5m30s"
    if (!timeStr) return 0;
    
    let totalSeconds = 0;
    
    // Hours
    const hourMatch = timeStr.match(/(\d+)h/);
    if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;
    
    // Minutes
    const minMatch = timeStr.match(/(\d+)m/);
    if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
    
    // Seconds
    const secMatch = timeStr.match(/(\d+(?:\.\d+)?)s/);
    if (secMatch) totalSeconds += parseFloat(secMatch[1]);
    
    return totalSeconds;
  },

  handleProcessOutput(k6Process, testId) {
    let outputBuffer = '';
    let errorBuffer = '';
    
    k6Process.stdout.on('data', (data) => {
      const output = data.toString();
      outputBuffer += output;
      console.log(`k6 stdout: ${output}`);
      
      // Parse progress from output
      this.parseK6Progress(output, testId);
    });

    k6Process.stderr.on('data', (data) => {
      const errorMessage = data.toString();
      errorBuffer += errorMessage;
      console.error(`k6 stderr: ${errorMessage}`);
      
      // Sometimes progress is in stderr
      this.parseK6Progress(errorMessage, testId);
      
      if (errorMessage.includes('bind: address already in use') && errorMessage.includes('5665')) {
        console.warn('Dashboard port 5665 is already in use. Test will continue without dashboard.');
      }
      
      if (errorMessage.includes('SyntaxError') || errorMessage.includes('ReferenceError') || errorMessage.includes('TypeError')) {
        console.error('K6 Script Error Detected!');
        console.error('Full error:', errorMessage);
      }
    });
    
    return { outputBuffer, errorBuffer };
  },

  async handleProcessExit(code, signal, testId, scenario, httpMethod, fullUrl, errorBuffer, scriptPath) {
    console.log(`k6 process exited with code ${code} and signal ${signal}`);
    
    if (code !== 0) {
      console.error("K6 Test Failed!", {
        exitCode: code,
        signal,
        testId,
        scenario,
        httpMethod,
        targetUrl: fullUrl
      });
      
      if (errorBuffer) {
        console.error("Last errors:", errorBuffer.slice(-CONSTANTS.LOG_BUFFER_SIZE));
      }
      
      try {
        const scriptContent = await fs.readFile(scriptPath, 'utf8');
        console.error("Script preview:", scriptContent.substring(0, CONSTANTS.SCRIPT_PREVIEW_SIZE));
      } catch (err) {
        console.error("Could not read script file:", err);
      }
    }
  }
};

// API Routes
app.post("/api/test/start", async (req, res) => {
  console.log("Starting test with config:", req.body);
  
  const {
    vus = CONSTANTS.DEFAULT_VUS,
    duration = CONSTANTS.DEFAULT_DURATION,
    iterations,
    executionMode = CONSTANTS.DEFAULT_EXECUTION_MODE,
    targetUrl,
    urlPath = "",
    enableDashboard = false,
    scenario = "custom",
    httpMethod = CONSTANTS.DEFAULT_HTTP_METHOD,
    requestBody = null,
    enableErrorSimulation = false,
    errorRate = CONSTANTS.DEFAULT_ERROR_RATE,
    errorTypes = {},
  } = req.body;

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
    const executorConfig = k6Config.getExecutorConfig(scenario, vus, duration, iterations, executionMode, testId);
    
    const baseUrl = targetUrl || config.mockServerUrl;
    const fullUrl = scriptGenerator.buildUrl(baseUrl, urlPath, enableErrorSimulation, errorRate, errorTypes);
    
    const script = scriptGenerator.generateScript(
      { fullUrl, httpMethod, requestBody },
      executorConfig
    );

    console.log("Test configuration:", {
      scenario,
      vus,
      duration,
      iterations,
      executionMode,
      httpMethod,
      targetUrl: fullUrl,
      hasBody: HTTP_STATUS.METHODS_WITH_BODY.includes(httpMethod),
      bodyLength: requestBody ? requestBody.length : 0
    });

    scriptPath = `/tmp/k6-test-${testId}.js`;
    await fs.writeFile(scriptPath, script);

    const k6Args = ["run", "--out", `influxdb=${config.influxdbK6Url}`];
    const k6Env = {
      ...process.env,
      TARGET_URL: targetUrl || config.mockServerUrl,
    };

    const dashboardActuallyEnabled = await testManager.setupDashboard(enableDashboard, k6Args, k6Env);
    k6Args.push(scriptPath);

    console.log("Executing k6 with args:", k6Args);
    const k6Process = spawn("k6", k6Args, { env: k6Env });

    const { errorBuffer } = testManager.handleProcessOutput(k6Process, testId);

    currentTest = {
      process: k6Process,
      testId,
      startTime: new Date(),
      vus,
      duration,
      iterations,
      executionMode,
      targetUrl: fullUrl,
      scriptPath,
      scenario,
      dashboardEnabled: dashboardActuallyEnabled,
    };
    
    currentTest.timeoutId = await testManager.setupTimeout(k6Process, testId, duration);

    k6Process.on("exit", async (code, signal) => {
      await testManager.handleProcessExit(code, signal, testId, scenario, httpMethod, fullUrl, errorBuffer, scriptPath);
      
      await new Promise(resolve => setTimeout(resolve, CONSTANTS.PROCESS_EXIT_WAIT));
      
      if (currentTest && currentTest.process === k6Process) {
        await testManager.cleanupTest(currentTest);
        // Mark progress as completed and cleanup after a delay
        if (testProgress[testId]) {
          testProgress[testId].status = 'completed';
          testProgress[testId].percentage = 100;
          // Keep progress data for 5 minutes after completion
          setTimeout(() => {
            delete testProgress[testId];
          }, 5 * 60 * 1000);
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

app.post("/api/test/stop", async (req, res) => {
  if (!currentTest) {
    return res.status(400).json({ error: "No test running" });
  }

  try {
    console.log("Stopping test:", currentTest.testId);
    const stoppedTestId = currentTest.testId;
    
    if (currentTest.timeoutId) {
      clearTimeout(currentTest.timeoutId);
    }
    
    if (currentTest.process && !currentTest.process.killed) {
      currentTest.process.kill("SIGTERM");

      let waitCount = 0;
      while (!currentTest.process.killed && waitCount < CONSTANTS.MAX_KILL_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, CONSTANTS.PROCESS_KILL_WAIT));
        waitCount++;
      }

      if (!currentTest.process.killed) {
        console.log("Force killing k6 process");
        currentTest.process.kill("SIGKILL");
      }
    }

    await testManager.cleanupTest(currentTest);
    
    // Clean up progress data
    if (testProgress[stoppedTestId]) {
      testProgress[stoppedTestId].status = 'stopped';
      setTimeout(() => {
        delete testProgress[stoppedTestId];
      }, 60 * 1000); // Keep for 1 minute after stop
    }
    
    currentTest = null;

    res.json({
      status: "stopped",
      message: "Test stopped successfully",
      testId: stoppedTestId,
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

app.get("/api/test/status", (req, res) => {
  const testId = currentTest?.testId;
  const progress = testId ? testProgress[testId] : null;
  
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
    progress: progress || null
  });
});

// New endpoint specifically for progress
app.get("/api/test/progress/:testId?", (req, res) => {
  const { testId } = req.params;
  
  if (testId) {
    // Get progress for specific test
    res.json({
      testId,
      progress: testProgress[testId] || null
    });
  } else {
    // Get progress for current test
    const currentTestId = currentTest?.testId;
    res.json({
      testId: currentTestId,
      progress: currentTestId ? testProgress[currentTestId] : null
    });
  }
});

app.get("/health", (req, res) => {
  res.json(config.getHealthInfo());
});

app.get("/config", (req, res) => {
  res.json(config.getConfigInfo());
});

const PORT = config.port;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`K6 Runner Service listening on port ${PORT}`);
  console.log(`Environment: ${config.environment}`);
});