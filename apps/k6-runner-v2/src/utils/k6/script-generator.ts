import { HttpMethod } from '../validation/http.validator';

export interface K6ScriptConfig {
  fullUrl: string;
  httpMethod: HttpMethod;
  requestBody?: string;
  urlPath?: string;
  testId: string;
  scenario: string;
  options: any;
}

export const escapeScriptContent = (content: string): string => {
  return content
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');
};

export const buildUrl = (
  baseUrl: string,
  urlPath: string,
  enableErrorSimulation: boolean,
  errorRate?: number,
  errorTypes?: Record<string, boolean>
): string => {
  let fullUrl = urlPath ? `${baseUrl}${urlPath}` : baseUrl;

  // Check if it's mock server (either by 'mock-server' or port 3001)
  const isMockServer = baseUrl.includes('mock-server') || baseUrl.includes(':3001');

  if (enableErrorSimulation && isMockServer) {
    const enabledErrorTypes = Object.entries(errorTypes || {})
      .filter(([, enabled]) => enabled)
      .map(([code]) => code);

    const statusCodes = enabledErrorTypes.length > 0
      ? enabledErrorTypes.join(',')
      : '400,500,503';

    const separator = fullUrl.includes('?') ? '&' : '?';
    fullUrl = `${fullUrl}${separator}chaos=true&errorRate=${
      (errorRate || 10) / 100
    }&statusCodes=${statusCodes}`;
  }

  return fullUrl;
};

export const createHttpRequest = (
  httpMethod: HttpMethod,
  fullUrl: string,
  requestBody?: string
): string => {
  const method = httpMethod.toLowerCase();
  const methodsWithBody: HttpMethod[] = ['POST', 'PUT', 'PATCH'];

  if (methodsWithBody.includes(httpMethod)) {
    let bodyData = requestBody || '{"message": "test"}';

    try {
      const parsedBody = JSON.parse(bodyData);
      bodyData = JSON.stringify(parsedBody);
    } catch {
      // Use as-is if not valid JSON
    }

    const escapedBody = escapeScriptContent(bodyData);

    return `
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };
  const res = http.${method}('${fullUrl}', \`${escapedBody}\`, params);`;
  } else if (httpMethod === 'DELETE') {
    return `
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };
  const res = http.del('${fullUrl}', null, params);`;
  } else {
    return `
  const res = http.get('${fullUrl}');`;
  }
};

export const createSuccessCheck = (httpMethod: HttpMethod): string => {
  const successStatusCodes: Record<HttpMethod, number[]> = {
    GET: [200],
    POST: [200, 201],
    PUT: [200, 204],
    PATCH: [200, 204],
    DELETE: [200, 202, 204],
  };

  const statusCodes = successStatusCodes[httpMethod];
  const statusDescription = statusCodes.join('/');

  if (httpMethod === 'POST') {
    return `
  // Response status logging for debugging
  if (res.status !== 200 && res.status !== 201) {
    console.log(\`POST request failed: Status=\${res.status}, Body=\${res.body}\`);
  }
  
  check(res, {
    'status is successful (${statusDescription})': (r) => ${statusCodes
      .map((code) => `r.status === ${code}`)
      .join(' || ')},
  });`;
  }

  return `
  check(res, {
    'status is successful (${statusDescription})': (r) => ${statusCodes
      .map((code) => `r.status === ${code}`)
      .join(' || ')},
  });`;
};

export const generateK6Script = (config: K6ScriptConfig): string => {
  const { fullUrl, httpMethod, requestBody, urlPath, options } = config;
  const optionsConfig = JSON.stringify(options, null, 2);
  const httpRequest = createHttpRequest(httpMethod, fullUrl, requestBody);
  const successCheck = createSuccessCheck(httpMethod);

  // Special handling for shutdown endpoint
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
};