import { SCENARIO, CONSTANTS } from '../../utils/constants';
import { RampPattern } from '../../types/scenario.types';

interface ExecutorConfigParams {
  scenario: string;
  vus?: number;
  duration?: string;
  iterations?: number;
  executionMode?: string;
  testId: string;
  urlPath?: string;
}

interface K6ScriptConfig {
  fullUrl: string;
  httpMethod: string;
  requestBody?: string;
  urlPath?: string;
  options: any;
}

export class ScenarioService {
  constructor() {}

  getScenarios() {
    return {
      scenarios: Object.keys(SCENARIO),
      description: Object.fromEntries(
        Object.entries(SCENARIO).map(([key, value]) => [key, value.description]),
      ),
      executors: Object.fromEntries(
        Object.entries(SCENARIO).map(([key, value]) => [key, value.executor]),
      ),
    };
  }

  getScenarioConfig(scenarioId: string) {
    const scenario = SCENARIO[scenarioId as keyof typeof SCENARIO];
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    return scenario;
  }

  calculateStages(pattern: RampPattern, vus: number, totalSeconds: number) {
    if (vus === 0 || totalSeconds === 0 || totalSeconds < 1 || vus < 1) {
      return null;
    }

    switch (pattern) {
      case 'none':
        return null;

      case 'standard': {
        const rampUpSeconds = Math.max(1, Math.floor(totalSeconds * 0.15));
        const rampDownSeconds = Math.max(1, Math.floor(totalSeconds * 0.15));
        const steadySeconds = totalSeconds - rampUpSeconds - rampDownSeconds;

        return [
          { duration: `${rampUpSeconds}s`, target: vus },
          { duration: `${steadySeconds}s`, target: vus },
          { duration: `${rampDownSeconds}s`, target: 0 },
        ];
      }

      case 'aggressive': {
        const spikeUpSeconds = Math.max(1, Math.floor(totalSeconds * 0.05));
        const spikeHoldSeconds = Math.floor(totalSeconds * 0.3);
        const normalSeconds = Math.floor(totalSeconds * 0.3);
        const spikeDownSeconds = Math.max(1, Math.floor(totalSeconds * 0.05));

        return [
          { duration: `${normalSeconds}s`, target: Math.floor(vus * 0.2) },
          { duration: `${spikeUpSeconds}s`, target: vus },
          { duration: `${spikeHoldSeconds}s`, target: vus },
          { duration: `${spikeDownSeconds}s`, target: Math.floor(vus * 0.2) },
          { duration: `${normalSeconds}s`, target: Math.floor(vus * 0.2) },
        ];
      }

      case 'gradual': {
        const steps = 4;
        const stepDuration = Math.floor(totalSeconds / (steps + 1));
        const stages = [];

        for (let i = 1; i <= steps; i++) {
          stages.push({
            duration: `${stepDuration}s`,
            target: Math.floor((vus * i) / steps),
          });
        }
        stages.push({ duration: `${stepDuration}s`, target: 0 });

        return stages;
      }

      default:
        return null;
    }
  }

  // K6 설정 생성
  getExecutorConfig(params: ExecutorConfigParams) {
    const { scenario, vus, duration, iterations, executionMode, testId, urlPath } = params;

    const scenarioConfig = SCENARIO[scenario as keyof typeof SCENARIO];

    if (!scenarioConfig) {
      throw new Error(`Scenario ${scenario} not found`);
    }

    const userVus = vus || scenarioConfig.defaultVus || CONSTANTS.DEFAULT_VUS;
    const userDuration = duration || scenarioConfig.defaultDuration || CONSTANTS.DEFAULT_DURATION;
    const userIterations = iterations || CONSTANTS.DEFAULT_ITERATIONS;

    const match = userDuration.match(/^(\d+)([smh])$/);
    const totalSeconds = match
      ? parseInt(match[1]) * { s: 1, m: 60, h: 3600 }[match[2] as 's' | 'm' | 'h']
      : 30;

    const stages = scenarioConfig.useStages
      ? this.calculateStages(scenarioConfig.rampPattern as RampPattern, userVus, totalSeconds)
      : null;

    const baseOptions: any = {
      tags: {
        testId,
        scenario,
        timestamp: new Date().toISOString(),
      },
    };

    // Chaos/shutdown endpoint일 경우 추가 설정
    if (urlPath && urlPath.includes('/chaos/shutdown')) {
      baseOptions.thresholds = {
        http_req_failed: [{ threshold: 'rate<0.5', abortOnFail: true }],
      };
    }

    let scenarios;

    if (executionMode === 'iterations' || executionMode === 'hybrid') {
      scenarios = {
        [`${scenario}_iterations`]: {
          executor: 'shared-iterations',
          vus: userVus,
          iterations: userIterations,
          maxDuration: userDuration,
        },
      };
    } else if (stages) {
      scenarios = {
        [`${scenario}_ramping`]: {
          executor: 'ramping-vus',
          startVUs: scenario === 'spike' ? Math.floor(userVus * 0.1) : 1,
          stages: stages.map((stage) => ({
            duration: stage.duration,
            target: stage.target,
          })),
        },
      };
    } else {
      scenarios = {
        [`${scenario}_constant`]: {
          executor: 'constant-vus',
          vus: userVus,
          duration: userDuration,
        },
      };
    }

    return { ...baseOptions, scenarios };
  }

  // K6 스크립트 생성
  generateK6Script(config: K6ScriptConfig): string {
    const { fullUrl, httpMethod, requestBody, urlPath, options } = config;
    const optionsConfig = JSON.stringify(options, null, 2);

    // HTTP request 생성
    const method = httpMethod.toLowerCase();
    let httpRequest = '';

    if (['POST', 'PUT', 'PATCH'].includes(httpMethod)) {
      let bodyData = requestBody || '{"message": "test"}';
      try {
        const parsedBody = JSON.parse(bodyData);
        bodyData = JSON.stringify(parsedBody);
      } catch {
        // Use as-is if not valid JSON
      }

      // Escape for K6 script
      const escapedBody = bodyData
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$');

      httpRequest = `
          const params = {
            headers: { 'Content-Type': 'application/json' },
          };
          const res = http.${method}('${fullUrl}', \`${escapedBody}\`, params);`;
    } else if (httpMethod === 'DELETE') {
      httpRequest = `
          const params = {
            headers: { 'Content-Type': 'application/json' },
          };
          const res = http.del('${fullUrl}', null, params);`;
    } else {
      httpRequest = `
          const res = http.get('${fullUrl}');`;
    }

    // Success check
    const successStatusCodes: Record<string, number[]> = {
      GET: [200],
      POST: [200, 201],
      PUT: [200, 204],
      PATCH: [200, 204],
      DELETE: [200, 202, 204],
    };

    const statusCodes = successStatusCodes[httpMethod] || [200];
    const statusDescription = statusCodes.join('/');

    let successCheck = '';
    if (httpMethod === 'POST') {
      successCheck = `
        // Response status logging for debugging
        if (res.status !== 200 && res.status !== 201) {
          console.log(\`POST request failed: Status=\${res.status}, Body=\${res.body}\`);
        }
  
        check(res, {
          'status is successful (${statusDescription})': (r) => ${statusCodes
            .map((code) => `r.status === ${code}`)
            .join(' || ')},
        });`;
    } else {
      successCheck = `
        check(res, {
          'status is successful (${statusDescription})': (r) => ${statusCodes
            .map((code) => `r.status === ${code}`)
            .join(' || ')},
        });`;
    }

    // Connection error handling
    const isShutdownEndpoint = urlPath?.includes('/chaos/shutdown');
    const connectionErrorHandling = isShutdownEndpoint
      ? `
          // Special handling for chaos/shutdown endpoint
          if (res.error_code) {
            console.error(\`Connection failed after shutdown: \${res.error} (Code: \${res.error_code})\`);
            console.log('Server shutdown detected as expected. Stopping test gracefully...');
            return; // Skip this iteration but don't fail the entire test
          }
          
          if (res.status === 0) {
            console.log('Server connection lost after shutdown request - this is expected');
            return; // Skip this iteration
          }`
      : `
          // Standard connection error handling
          if (res.error_code && res.error_code >= 1000 && res.error_code <= 1999) {
            console.error(\`Critical connection error: \${res.error} (Code: \${res.error_code})\`);
          }`;

    return `
        import http from 'k6/http';
        import { check, sleep, fail } from 'k6';

        export const options = ${optionsConfig};

        export default function () {${httpRequest}
        ${connectionErrorHandling}${successCheck}
          sleep(1);
        }
          `;
  }

  buildUrl(
    baseUrl: string,
    urlPath: string,
    enableErrorSimulation: boolean,
    errorRate?: number,
    errorTypes?: Record<string, boolean>,
  ): string {
    let fullUrl = urlPath ? `${baseUrl}${urlPath}` : baseUrl;

    // mock 서버인지 확인
    const isMockServer = baseUrl.includes('mock-server') || baseUrl.includes(':3001');

    if (enableErrorSimulation && isMockServer) {
      const enabledErrorTypes = Object.entries(errorTypes || {})
        .filter(([, enabled]) => enabled)
        .map(([code]) => code);

      const statusCodes =
        enabledErrorTypes.length > 0 ? enabledErrorTypes.join(',') : '400,500,503';

      const separator = fullUrl.includes('?') ? '&' : '?';
      fullUrl = `${fullUrl}${separator}chaos=true&errorRate=${
        (errorRate || 10) / 100
      }&statusCodes=${statusCodes}`;
    }

    return fullUrl;
  }
}
