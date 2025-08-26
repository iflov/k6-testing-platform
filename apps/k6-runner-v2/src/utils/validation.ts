import { SCENARIO } from './constants';

// URL 유효성 검사
export const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
};

// 기간 유효성 검사
export const isValidDuration = (duration: string): boolean => {
  return /^[1-9]\d*[smh]$/.test(duration);
};

// HTTP 메서드 유효성 검사
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const isValidHttpMethod = (method: string): method is HttpMethod => {
  return HTTP_METHODS.includes(method as HttpMethod);
};

// 시나리오 유효성 검사
const AVAILABLE_SCENARIOS = Object.keys(SCENARIO);

export const isValidScenario = (scenario: string): boolean => {
  return AVAILABLE_SCENARIOS.includes(scenario);
};

// 유효성 검사 오류 인터페이스
export interface ValidationError {
  field: string;
  message: string;
}

// 테스트 설정 유효성 검사
export const validateTestConfig = (config: any): ValidationError[] => {
  const errors: ValidationError[] = [];

  // VUs 유효성 검사
  if (config.vus && (config.vus < 1 || config.vus > 1000)) {
    errors.push({
      field: 'vus',
      message: 'VUs must be between 1 and 1000',
    });
  }

  // 기간 유효성 검사
  if (config.duration && !isValidDuration(config.duration)) {
    errors.push({
      field: 'duration',
      message: 'Invalid duration format. Use format like "30s", "5m", "1h"',
    });
  }

  // 반복 횟수 유효성 검사
  if (config.iterations && (config.iterations < 1 || config.iterations > 100000)) {
    errors.push({
      field: 'iterations',
      message: 'Iterations must be between 1 and 100000',
    });
  }

  // URL 유효성 검사
  if (config.targetUrl && !isValidUrl(config.targetUrl)) {
    errors.push({
      field: 'targetUrl',
      message: 'Invalid target URL',
    });
  }

  // HTTP 메서드 유효성 검사
  if (config.httpMethod && !isValidHttpMethod(config.httpMethod)) {
    errors.push({
      field: 'httpMethod',
      message: 'Invalid HTTP method',
    });
  }

  // 시나리오 유효성 검사
  if (config.scenario && !isValidScenario(config.scenario)) {
    errors.push({
      field: 'scenario',
      message: 'Invalid scenario',
    });
  }

  // 에러 비율 유효성 검사
  if (config.errorRate !== undefined && (config.errorRate < 0 || config.errorRate > 100)) {
    errors.push({
      field: 'errorRate',
      message: 'Error rate must be between 0 and 100',
    });
  }

  return errors;
};
