import { ContentType, FormDataField } from '../../types/test.types';
import { RampPattern } from '../../types/scenario.types';
import { SCENARIO, CONSTANTS } from '../../utils/constants';

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
  contentType?: ContentType;
  formFields?: FormDataField[];
  urlPath?: string;
  options: Record<string, unknown>;
  useHeaderForChaos?: boolean;
  chaosHeaders?: {
    enabled: boolean;
    errorRate: number;
    statusCodes: string;
  };
}

interface FormDataScriptResult {
  initContextDeclarations: string;
  requestSnippet: string;
}

export class ScenarioService {
  constructor() {}

  getScenarios() {
    return {
      scenarios: Object.keys(SCENARIO),
      description: Object.fromEntries(
        Object.entries(SCENARIO).map(([scenarioKey, scenarioValue]) => [
          scenarioKey,
          scenarioValue.description,
        ]),
      ),
      executors: Object.fromEntries(
        Object.entries(SCENARIO).map(([scenarioKey, scenarioValue]) => [
          scenarioKey,
          scenarioValue.executor,
        ]),
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

        for (let stepIndex = 1; stepIndex <= steps; stepIndex++) {
          stages.push({
            duration: `${stepDuration}s`,
            target: Math.floor((vus * stepIndex) / steps),
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

    const baseOptions: Record<string, unknown> = {
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

    let scenarios: Record<string, unknown>;

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

  private normalizeContentType(contentType?: ContentType): ContentType {
    return contentType ?? 'json';
  }

  private getMethodSuccessStatusCodes(httpMethod: string): number[] {
    const successStatusCodesByMethod: Record<string, number[]> = {
      GET: [200],
      POST: [200, 201],
      PUT: [200, 204],
      PATCH: [200, 204],
      DELETE: [200, 202, 204],
    };

    return successStatusCodesByMethod[httpMethod] || [200];
  }

  private buildChaosHeaders(
    useHeaderForChaos?: boolean,
    chaosHeaders?: K6ScriptConfig['chaosHeaders'],
  ): Record<string, string> {
    if (!useHeaderForChaos || !chaosHeaders) {
      return {};
    }

    return {
      'X-Chaos-Enabled': String(chaosHeaders.enabled),
      'X-Chaos-Error-Rate': String(chaosHeaders.errorRate),
      'X-Chaos-Status-Codes': chaosHeaders.statusCodes,
    };
  }

  private normalizeFormFields(formFields?: FormDataField[]): FormDataField[] {
    if (!formFields || formFields.length === 0) {
      return [];
    }

    return formFields
      .map((formField) => ({
        ...formField,
        key: formField.key.trim(),
      }))
      .filter((formField) => formField.key.length > 0);
  }

  private normalizeJsonRequestBody(requestBody?: string): string {
    const fallbackBody = '{"message": "test"}';
    const selectedBody = requestBody ?? fallbackBody;

    try {
      const parsedBody = JSON.parse(selectedBody);
      return JSON.stringify(parsedBody);
    } catch {
      return selectedBody;
    }
  }

  private resolveUploadFilename(formField: FormDataField): string {
    const providedFilename = formField.filename?.trim();
    if (providedFilename) {
      return providedFilename;
    }

    const filePath = formField.value.trim();
    if (filePath.length === 0) {
      return `${formField.key || 'file'}.bin`;
    }

    const pathSegments = filePath.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];

    return lastSegment || `${formField.key || 'file'}.bin`;
  }

  private buildJsonRequestSnippet(
    method: string,
    fullUrl: string,
    requestBody?: string,
    chaosHeaders?: Record<string, string>,
  ): string {
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(chaosHeaders || {}),
    };

    const requestUrlLiteral = JSON.stringify(fullUrl);
    const requestBodyLiteral = JSON.stringify(this.normalizeJsonRequestBody(requestBody));
    const paramsLiteral = JSON.stringify({ headers: requestHeaders }, null, 10);

    return `
          const requestBody = ${requestBodyLiteral};
          const requestParams = ${paramsLiteral};
          const res = http.${method}(${requestUrlLiteral}, requestBody, requestParams);`;
  }

  private buildUrlEncodedRequestSnippet(
    method: string,
    fullUrl: string,
    formFields?: FormDataField[],
    chaosHeaders?: Record<string, string>,
  ): string {
    const normalizedFields = this.normalizeFormFields(formFields).filter(
      (formField) => formField.type !== 'file',
    );
    const requestUrlLiteral = JSON.stringify(fullUrl);

    const formEntryLines =
      normalizedFields.length > 0
        ? normalizedFields.map((formField) => {
            const keyLiteral = JSON.stringify(formField.key);
            const valueLiteral = JSON.stringify(formField.value);
            return `            [${keyLiteral}, ${valueLiteral}]`;
          })
        : [];

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(chaosHeaders || {}),
    };
    const paramsLiteral = JSON.stringify({ headers: requestHeaders }, null, 10);
    const entriesLiteral = formEntryLines.length > 0 ? formEntryLines.join(',\n') : '';

    return `
          const formEntries = [
${entriesLiteral}
          ];
          const encodedFormBody = formEntries
            .map(([fieldKey, fieldValue]) => \`\${encodeURIComponent(fieldKey)}=\${encodeURIComponent(fieldValue)}\`)
            .join('&');
          const requestParams = ${paramsLiteral};
          const res = http.${method}(${requestUrlLiteral}, encodedFormBody, requestParams);`;
  }

  private buildFormDataRequestScript(
    method: string,
    fullUrl: string,
    formFields?: FormDataField[],
    chaosHeaders?: Record<string, string>,
  ): FormDataScriptResult {
    const normalizedFields = this.normalizeFormFields(formFields);
    const initContextLines: string[] = [];
    const payloadLines: string[] = [];

    normalizedFields.forEach((formField, fieldIndex) => {
      const fieldKeyLiteral = JSON.stringify(formField.key);

      if (formField.type === 'file') {
        const variableName = `fileData${fieldIndex}`;
        const filePathLiteral = JSON.stringify(formField.value);
        const filenameLiteral = JSON.stringify(this.resolveUploadFilename(formField));
        const mimeTypeLiteral = JSON.stringify(
          formField.contentType?.trim() || 'application/octet-stream',
        );

        initContextLines.push(`const ${variableName} = open(${filePathLiteral}, 'b');`);
        payloadLines.push(
          `            ${fieldKeyLiteral}: http.file(${variableName}, ${filenameLiteral}, ${mimeTypeLiteral})`,
        );

        return;
      }

      const fieldValueLiteral = JSON.stringify(formField.value);
      payloadLines.push(`            ${fieldKeyLiteral}: ${fieldValueLiteral}`);
    });

    const payloadLiteral = payloadLines.length > 0 ? payloadLines.join(',\n') : '';
    const requestUrlLiteral = JSON.stringify(fullUrl);
    const hasChaosHeaders = chaosHeaders && Object.keys(chaosHeaders).length > 0;

    if (hasChaosHeaders) {
      const paramsLiteral = JSON.stringify({ headers: chaosHeaders }, null, 10);
      return {
        initContextDeclarations: initContextLines.join('\n'),
        requestSnippet: `
          const payload = {
${payloadLiteral}
          };
          const requestParams = ${paramsLiteral};
          const res = http.${method}(${requestUrlLiteral}, payload, requestParams);`,
      };
    }

    return {
      initContextDeclarations: initContextLines.join('\n'),
      requestSnippet: `
          const payload = {
${payloadLiteral}
          };
          const res = http.${method}(${requestUrlLiteral}, payload);`,
    };
  }

  private buildDeleteRequestSnippet(
    fullUrl: string,
    chaosHeaders?: Record<string, string>,
  ): string {
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(chaosHeaders || {}),
    };

    const requestUrlLiteral = JSON.stringify(fullUrl);
    const paramsLiteral = JSON.stringify({ headers: requestHeaders }, null, 10);

    return `
          const requestParams = ${paramsLiteral};
          const res = http.del(${requestUrlLiteral}, null, requestParams);`;
  }

  private buildGetRequestSnippet(fullUrl: string, chaosHeaders?: Record<string, string>): string {
    const requestUrlLiteral = JSON.stringify(fullUrl);
    const hasChaosHeaders = chaosHeaders && Object.keys(chaosHeaders).length > 0;

    if (!hasChaosHeaders) {
      return `
          const res = http.get(${requestUrlLiteral});`;
    }

    const paramsLiteral = JSON.stringify({ headers: chaosHeaders }, null, 10);
    return `
          const requestParams = ${paramsLiteral};
          const res = http.get(${requestUrlLiteral}, requestParams);`;
  }

  private buildConnectionErrorHandling(urlPath?: string): string {
    const isShutdownEndpoint = urlPath?.includes('/chaos/shutdown');

    if (isShutdownEndpoint) {
      return `
          // Special handling for chaos/shutdown endpoint
          if (res.error_code) {
            console.error(\`Connection failed after shutdown: \${res.error} (Code: \${res.error_code})\`);
            console.log('Server shutdown detected as expected. Stopping test gracefully...');
            return; // Skip this iteration but don't fail the entire test
          }
          
          if (res.status === 0) {
            console.log('Server connection lost after shutdown request - this is expected');
            return; // Skip this iteration
          }`;
    }

    return `
          // Standard connection error handling
          if (res.error_code && res.error_code >= 1000 && res.error_code <= 1999) {
            console.error(\`Critical connection error: \${res.error} (Code: \${res.error_code})\`);
          }`;
  }

  private buildSuccessCheck(httpMethod: string): string {
    const successStatusCodes = this.getMethodSuccessStatusCodes(httpMethod);
    const statusDescription = successStatusCodes.join('/');
    const statusCheckExpression = successStatusCodes
      .map((statusCode) => `r.status === ${statusCode}`)
      .join(' || ');

    if (httpMethod === 'POST') {
      return `
        // Response status logging for debugging
        if (res.status !== 200 && res.status !== 201) {
          console.log(\`POST request failed: Status=\${res.status}, Body=\${res.body}\`);
        }
  
        check(res, {
          'status is successful (${statusDescription})': (r) => ${statusCheckExpression},
        });`;
    }

    return `
        check(res, {
          'status is successful (${statusDescription})': (r) => ${statusCheckExpression},
        });`;
  }

  // K6 스크립트 생성
  generateK6Script(config: K6ScriptConfig): string {
    const {
      fullUrl,
      httpMethod,
      requestBody,
      contentType,
      formFields,
      urlPath,
      options,
      useHeaderForChaos,
      chaosHeaders,
    } = config;

    const requestMethod = httpMethod.toLowerCase();
    const normalizedContentType = this.normalizeContentType(contentType);
    const chaosHeaderValues = this.buildChaosHeaders(useHeaderForChaos, chaosHeaders);
    const optionsConfig = JSON.stringify(options, null, 2);

    const methodSupportsBody = ['POST', 'PUT', 'PATCH'].includes(httpMethod);
    let initContextDeclarations = '';
    let httpRequestSnippet = '';

    if (methodSupportsBody) {
      if (normalizedContentType === 'form-data') {
        const formDataScript = this.buildFormDataRequestScript(
          requestMethod,
          fullUrl,
          formFields,
          chaosHeaderValues,
        );
        initContextDeclarations = formDataScript.initContextDeclarations;
        httpRequestSnippet = formDataScript.requestSnippet;
      } else if (normalizedContentType === 'x-www-form-urlencoded') {
        httpRequestSnippet = this.buildUrlEncodedRequestSnippet(
          requestMethod,
          fullUrl,
          formFields,
          chaosHeaderValues,
        );
      } else {
        httpRequestSnippet = this.buildJsonRequestSnippet(
          requestMethod,
          fullUrl,
          requestBody,
          chaosHeaderValues,
        );
      }
    } else if (httpMethod === 'DELETE') {
      httpRequestSnippet = this.buildDeleteRequestSnippet(fullUrl, chaosHeaderValues);
    } else {
      httpRequestSnippet = this.buildGetRequestSnippet(fullUrl, chaosHeaderValues);
    }

    const connectionErrorHandling = this.buildConnectionErrorHandling(urlPath);
    const successCheck = this.buildSuccessCheck(httpMethod);
    const initContextSection = initContextDeclarations ? `\n${initContextDeclarations}\n` : '\n';

    return `
        import http from 'k6/http';
        import { check, sleep } from 'k6';${initContextSection}
        export const options = ${optionsConfig};

        export default function () {${httpRequestSnippet}
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
        .map(([statusCode]) => statusCode);

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
