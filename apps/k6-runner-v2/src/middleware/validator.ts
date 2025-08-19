import { Request, Response, NextFunction } from 'express';
import _ from 'lodash';

import { SCENARIO } from '../utils/constants';

export const AVAILABLE_SCENARIOS = _.keys(SCENARIO);
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

export const validateTestConfig = (config: any) => {
  const errors = [];

  // 가상 유저의 수는 1~1000 사이여야 함
  if (config.vus && (config.vus < 1 || config.vus > 1000)) {
    errors.push('VUs must be between 1 and 1000');
  }

  // duration은 s, m, h 단위여야 함
  if (config.duration && !isValidDuration(config.duration)) {
    errors.push('Invalid duration format. Use format like "30s", "5m", "1h"');
  }

  // 반복 회수는 1~100000 사이여야 함
  if (config.iterations && (config.iterations < 1 || config.iterations > 100000)) {
    errors.push('Iterations must be between 1 and 100000');
  }

  // URL은 유효한 URL이어야 함
  if (config.targetUrl && !isValidUrl(config.targetUrl)) {
    errors.push('Invalid target URL');
  }

  // HTTP 메서드는 GET, POST, PUT, DELETE, PATCH 중 하나여야 함
  if (config.httpMethod && !isValidHttpMethod(config.httpMethod)) {
    errors.push('Invalid HTTP method');
  }

  // 시나리오는 smoke, load, stress, spike, soak, breakpoint 중 하나여야 함
  if (config.scenario && !isValidScenario(config.scenario)) {
    errors.push('Invalid scenario');
  }

  // 에러 비율은 0~100 사이여야 함
  if (config.errorRate !== undefined && (config.errorRate < 0 || config.errorRate > 100)) {
    errors.push('Error rate must be between 0 and 100');
  }

  return errors;
};

const isValidDuration = (duration: string) => {
  return /^[1-9]\d*[smh]$/.test(duration);
};

const isValidUrl = (url: string) => {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
};

const isValidHttpMethod = (method: string) => {
  return HTTP_METHODS.includes(method);
};

const isValidScenario = (scenario: string) => {
  return AVAILABLE_SCENARIOS.includes(scenario);
};

export const validateTestRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validateTestConfig(req.body);
  if (errors.length > 0) {
    res.status(400).json({
      error: 'Invalid test configuration',
      message: errors.join(', '),
      errors: errors,
    });
    return;
  }
  next();
};
