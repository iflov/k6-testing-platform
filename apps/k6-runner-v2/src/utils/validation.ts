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
const CONTENT_TYPES = ['json', 'form-data', 'x-www-form-urlencoded'] as const;
const FORM_FIELD_TYPES = ['text', 'file'] as const;

export type SupportedContentType = (typeof CONTENT_TYPES)[number];

export const isValidHttpMethod = (method: string): method is HttpMethod => {
  return HTTP_METHODS.includes(method as HttpMethod);
};

export const isValidContentType = (contentType: string): contentType is SupportedContentType => {
  return CONTENT_TYPES.includes(contentType as SupportedContentType);
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
  const resolvedContentType: SupportedContentType = config.contentType ?? 'json';

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

  // Content-Type 유효성 검사
  if (config.contentType && !isValidContentType(config.contentType)) {
    errors.push({
      field: 'contentType',
      message: `Invalid contentType. Allowed values: ${CONTENT_TYPES.join(', ')}`,
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

  // Form 필드 유효성 검사
  if (config.formFields !== undefined) {
    if (!Array.isArray(config.formFields)) {
      errors.push({
        field: 'formFields',
        message: 'formFields must be an array',
      });
    } else {
      config.formFields.forEach((formField: unknown, index: number) => {
        const fieldPrefix = `formFields[${index}]`;

        if (!formField || typeof formField !== 'object') {
          errors.push({
            field: fieldPrefix,
            message: `${fieldPrefix} must be an object`,
          });
          return;
        }

        const normalizedField = formField as Record<string, unknown>;
        const fieldKey = normalizedField.key;
        const fieldValue = normalizedField.value;
        const fieldType = normalizedField.type;
        const fieldFilename = normalizedField.filename;
        const fieldContentType = normalizedField.contentType;
        const hasStringValue = typeof fieldValue === 'string';

        if (typeof fieldKey !== 'string' || fieldKey.trim().length === 0) {
          errors.push({
            field: `${fieldPrefix}.key`,
            message: `${fieldPrefix}.key must be a non-empty string`,
          });
        }

        if (!hasStringValue) {
          errors.push({
            field: `${fieldPrefix}.value`,
            message: `${fieldPrefix}.value must be a string`,
          });
        }

        if (typeof fieldType !== 'string' || !FORM_FIELD_TYPES.includes(fieldType as 'text' | 'file')) {
          errors.push({
            field: `${fieldPrefix}.type`,
            message: `${fieldPrefix}.type must be one of: ${FORM_FIELD_TYPES.join(', ')}`,
          });
        }

        if (fieldType === 'file' && hasStringValue && fieldValue.trim().length === 0) {
          errors.push({
            field: `${fieldPrefix}.value`,
            message: `${fieldPrefix}.value is required for file fields`,
          });
        }

        if (fieldType === 'file' && resolvedContentType === 'x-www-form-urlencoded') {
          errors.push({
            field: `${fieldPrefix}.type`,
            message: 'File fields are not allowed with x-www-form-urlencoded',
          });
        }

        if (fieldFilename !== undefined && typeof fieldFilename !== 'string') {
          errors.push({
            field: `${fieldPrefix}.filename`,
            message: `${fieldPrefix}.filename must be a string`,
          });
        }

        if (fieldContentType !== undefined && typeof fieldContentType !== 'string') {
          errors.push({
            field: `${fieldPrefix}.contentType`,
            message: `${fieldPrefix}.contentType must be a string`,
          });
        }
      });
    }
  }

  return errors;
};
