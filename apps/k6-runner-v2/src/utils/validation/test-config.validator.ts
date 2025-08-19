import { isValidUrl } from './url.validator';
import { isValidDuration } from './duration.validator';
import { isValidHttpMethod } from './http.validator';
import { SCENARIO } from '../../utils/constants';

const AVAILABLE_SCENARIOS = Object.keys(SCENARIO);

export const isValidScenario = (scenario: string): boolean => {
  return AVAILABLE_SCENARIOS.includes(scenario);
};

export interface ValidationError {
  field: string;
  message: string;
}

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