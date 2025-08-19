import { Request, Response, NextFunction } from 'express';
import { sanitizeString as sanitizeStr } from '../utils';

export const sanitizeString = (req: Request, _res: Response, next: NextFunction) => {
  const { urlPath = '', requestBody = null } = req.body;

  const sanitizedUrlPath = sanitizeStr(urlPath);
  const sanitizedRequestBody = requestBody ? sanitizeStr(requestBody) : null;

  req.body.urlPath = sanitizedUrlPath;
  req.body.requestBody = sanitizedRequestBody;

  next();
};
