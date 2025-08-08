import { Request, Response, NextFunction } from 'express';

export function errorSimulator(req: Request, res: Response, next: NextFunction) {
  const errorRate = parseFloat(process.env.ERROR_RATE || '0') / 100;
  
  if (Math.random() < errorRate) {
    const errorCodes = [400, 401, 403, 404, 500, 502, 503];
    const randomError = errorCodes[Math.floor(Math.random() * errorCodes.length)];
    
    return res.status(randomError).json({
      error: 'Simulated error',
      code: randomError,
      message: getErrorMessage(randomError),
    });
  }
  
  next();
}

function getErrorMessage(code: number): string {
  const messages: { [key: number]: string } = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  
  return messages[code] || 'Unknown Error';
}