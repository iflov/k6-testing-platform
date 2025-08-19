import { Request, Response, NextFunction } from 'express';
import { validateTestConfig } from '../utils/validation';

export const validateTestRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validateTestConfig(req.body);
  if (errors.length > 0) {
    res.status(400).json({
      error: 'Invalid test configuration',
      message: errors.map(e => e.message).join(', '),
      errors: errors,
    });
    return;
  }
  next();
};
