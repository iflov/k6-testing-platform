import { SCENARIO } from './constants';

// URL validation
export const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
};

// Duration validation
export const isValidDuration = (duration: string): boolean => {
  return /^[1-9]\d*[smh]$/.test(duration);
};

// HTTP method validation
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
export type HttpMethod = typeof HTTP_METHODS[number];

export const isValidHttpMethod = (method: string): method is HttpMethod => {
  return HTTP_METHODS.includes(method as HttpMethod);
};

// Scenario validation
const AVAILABLE_SCENARIOS = Object.keys(SCENARIO);

export const isValidScenario = (scenario: string): boolean => {
  return AVAILABLE_SCENARIOS.includes(scenario);
};

// Validation error interface
export interface ValidationError {
  field: string;
  message: string;
}

// Test config validation
export const validateTestConfig = (config: any): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Validate VUs
  if (config.vus && (config.vus < 1 || config.vus > 1000)) {
    errors.push({
      field: 'vus',
      message: 'VUs must be between 1 and 1000'
    });
  }

  // Validate duration
  if (config.duration && !isValidDuration(config.duration)) {
    errors.push({
      field: 'duration',
      message: 'Invalid duration format. Use format like "30s", "5m", "1h"'
    });
  }

  // Validate iterations
  if (config.iterations && (config.iterations < 1 || config.iterations > 100000)) {
    errors.push({
      field: 'iterations',
      message: 'Iterations must be between 1 and 100000'
    });
  }

  // Validate URL
  if (config.targetUrl && !isValidUrl(config.targetUrl)) {
    errors.push({
      field: 'targetUrl',
      message: 'Invalid target URL'
    });
  }

  // Validate HTTP method
  if (config.httpMethod && !isValidHttpMethod(config.httpMethod)) {
    errors.push({
      field: 'httpMethod',
      message: 'Invalid HTTP method'
    });
  }

  // Validate scenario
  if (config.scenario && !isValidScenario(config.scenario)) {
    errors.push({
      field: 'scenario',
      message: 'Invalid scenario'
    });
  }

  // Validate error rate
  if (config.errorRate !== undefined && (config.errorRate < 0 || config.errorRate > 100)) {
    errors.push({
      field: 'errorRate',
      message: 'Error rate must be between 0 and 100'
    });
  }

  return errors;
};