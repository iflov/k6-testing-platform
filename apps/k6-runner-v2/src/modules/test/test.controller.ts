import { Request, Response } from 'express';

import { TestService } from './test.service';
import { CONSTANTS } from '../../utils/constants';
import { sanitizeString } from '../../middleware/validator';

export class TestController {
  constructor(private readonly testService: TestService) {}

  startTest = async (req: Request, res: Response) => {
    try {
      const {
        vus = CONSTANTS.DEFAULT_VUS,
        duration = CONSTANTS.DEFAULT_DURATION,
        iterations,
        executionMode = CONSTANTS.DEFAULT_EXECUTION_MODE,
        targetUrl,
        urlPath = '',
        enableDashboard = false,
        scenario = 'custom',
        httpMethod = CONSTANTS.DEFAULT_HTTP_METHOD,
        requestBody = null,
        enableErrorSimulation = false,
        errorRate = CONSTANTS.DEFAULT_ERROR_RATE,
        errorTypes = {},
      } = req.body;

      const sanitizedUrlPath = sanitizeString(urlPath);
      const sanitizedRequestBody = requestBody ? sanitizeString(requestBody) : null;

      const result = await this.testService.startTest({
        vus,
        duration,
        iterations,
        executionMode,
        targetUrl,
        urlPath: sanitizedUrlPath,
        enableDashboard,
        scenario,
        httpMethod,
        requestBody: sanitizedRequestBody,
        enableErrorSimulation,
        errorRate,
        errorTypes,
      });

      res.status(200).json(result);
    } catch (error: any) {
      if (error.message === 'Another test is already running') {
        return res.status(400).json({
          error: 'Another test is already running',
          message: 'Please stop the current test before starting a new one',
        });
      }
      res.status(500).json({
        error: 'Failed to start test',
        message: error.message,
      });
    }
  };

  stopTest = async (_req: Request, res: Response) => {
    try {
    } catch (error: any) {}
  };

  getStatus = async (_req: Request, res: Response) => {
    try {
    } catch (error: any) {}
  };

  getProgress = async (req: Request, res: Response) => {
    try {
    } catch (error: any) {}
  };
}
