import { Request, Response, NextFunction } from 'express';

export function delayMiddleware(req: Request, res: Response, next: NextFunction) {
  const minDelay = parseInt(process.env.MIN_DELAY || '0');
  const maxDelay = parseInt(process.env.MAX_DELAY || '100');
  
  const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  
  if (delay > 0) {
    setTimeout(() => next(), delay);
  } else {
    next();
  }
}