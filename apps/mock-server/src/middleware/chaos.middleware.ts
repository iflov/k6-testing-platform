import { Injectable, NestMiddleware, HttpException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ChaosMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Check if chaos is enabled via query parameters
    const chaosEnabled = req.query.chaos === 'true';
    const errorRate = req.query.errorRate
      ? parseFloat(req.query.errorRate as string)
      : 0;
    const statusCodes = req.query.statusCodes
      ? (req.query.statusCodes as string).split(',').map(Number)
      : [400, 500, 503];

    // Check if chaos is enabled via headers
    const headerChaosEnabled = req.headers['x-chaos-enabled'] === 'true';
    const headerErrorRate = req.headers['x-chaos-error-rate']
      ? parseFloat(req.headers['x-chaos-error-rate'] as string)
      : 0;
    const headerStatusCodes = req.headers['x-chaos-status-codes']
      ? (req.headers['x-chaos-status-codes'] as string).split(',').map(Number)
      : [400, 500, 503];

    // Use query params first, then headers
    const shouldApplyChaos = chaosEnabled || headerChaosEnabled;
    const finalErrorRate = chaosEnabled ? errorRate : headerErrorRate;
    const finalStatusCodes = chaosEnabled ? statusCodes : headerStatusCodes;

    if (shouldApplyChaos && finalErrorRate > 0) {
      const random = Math.random();

      if (random < finalErrorRate) {
        const statusCode =
          finalStatusCodes[Math.floor(Math.random() * finalStatusCodes.length)];
        const errorMessages = {
          400: 'Bad Request - Chaos Simulation',
          401: 'Unauthorized - Chaos Simulation',
          403: 'Forbidden - Chaos Simulation',
          404: 'Not Found - Chaos Simulation',
          429: 'Too Many Requests - Chaos Simulation',
          500: 'Internal Server Error - Chaos Simulation',
          502: 'Bad Gateway - Chaos Simulation',
          503: 'Service Unavailable - Chaos Simulation',
        };

        console.log(
          `[Chaos Middleware] Triggering error ${statusCode} for ${req.path}`,
        );

        throw new HttpException(
          {
            statusCode,
            error: true,
            message:
              errorMessages[statusCode] ||
              `Error ${statusCode} - Chaos Simulation`,
            timestamp: new Date(),
            chaos: true,
            originalPath: req.path,
          },
          statusCode,
        );
      }
    }

    next();
  }
}
