import { Request, Response, NextFunction } from 'express';

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
  return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
};

const availableScenarios = ['smoke', 'load', 'stress', 'spike', 'soak', 'breakpoint'];

const isValidScenario = (scenario: string) => {
  return availableScenarios.includes(scenario);
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

export const sanitizeString = (str: string) => {
  if (typeof str !== 'string') return '';
  // Remove potential script injection patterns
  // 보안상 제어 문자 제거가 필요하므로 ESLint 규칙 비활성화
  return (
    str
      .replace(/[<>]/g, '') // Remove HTML brackets
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/`/g, "'") // Replace backticks
      .substring(0, 10000)
  ); // Limit length
};
