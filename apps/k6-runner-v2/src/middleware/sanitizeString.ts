import { Request, Response, NextFunction } from 'express';

const sanitizeStringRegex = (str: string) => {
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

export const sanitizeString = (req: Request, _res: Response, next: NextFunction) => {
  const { urlPath = '', requestBody = null } = req.body;

  const sanitizedUrlPath = sanitizeStringRegex(urlPath);
  const sanitizedRequestBody = requestBody ? sanitizeStringRegex(requestBody) : null;

  req.body.urlPath = sanitizedUrlPath;
  req.body.requestBody = sanitizedRequestBody;

  next();
};
